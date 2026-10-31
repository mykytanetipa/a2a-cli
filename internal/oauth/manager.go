// Copyright 2026 The A2A Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package oauth

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/a2aproject/a2a-go/v2/a2a"
)

const lockTimeout = 10 * time.Second

// ErrRevocationUnsupported is returned by [Manager.Revoke] when the
// authorization server has no revocation endpoint.
var ErrRevocationUnsupported = errRevocationUnsupported

// Manager finds, refreshes and obtains grants for agent requests.
type Manager struct {
	// Clients are the configured client registrations.
	Clients []Registration
	// Store keeps grants.
	Store Store
	// HTTPClient makes metadata, token and revocation requests. It must not add
	// agent credentials.
	HTTPClient *http.Client
	// Logf, if set, receives diagnostics. Tokens are never logged.
	Logf func(format string, args ...any)
	// Now, if set, replaces time.Now.
	Now func() time.Time

	mu       sync.Mutex
	cardReqs map[cardReqKey]*Requirement
	learned  map[string]GrantKey
}

type cardReqKey struct {
	card    *a2a.AgentCard
	baseURL string
}

// AcquireOptions control an interactive authorization.
type AcquireOptions struct {
	// Device forces the device authorization grant.
	Device bool
	// Scopes replace the scopes from the requirement and the registration.
	Scopes []string
	// Prompter shows the user what to do.
	Prompter Prompter
	// Sleep, if set, replaces the wait between device flow polls.
	Sleep func(ctx context.Context, d time.Duration) error
}

func (m *Manager) fetcher() fetcher {
	client := m.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	return fetcher{client: client}
}

func (m *Manager) now() time.Time {
	if m.Now != nil {
		return m.Now()
	}
	return time.Now()
}

func (m *Manager) logf(format string, args ...any) {
	if m.Logf != nil {
		m.Logf(format, args...)
	}
}

// RequirementForCard returns the OAuth requirement the card declares for calls to
// baseURL, or nil when it declares none. Results are cached per card and URL.
func (m *Manager) RequirementForCard(ctx context.Context, card *a2a.AgentCard, baseURL string) (*Requirement, error) {
	key := cardReqKey{card: card, baseURL: baseURL}
	m.mu.Lock()
	r, ok := m.cardReqs[key]
	m.mu.Unlock()
	if ok {
		return r, nil
	}
	r, err := m.fetcher().requirementFromCard(ctx, card, baseURL)
	if err != nil {
		return nil, failure("reading the authorization requirements of %s: %w", card.Name, err)
	}
	if r != nil {
		m.logf("agent card requires authorization at %s for %s", r.Endpoints.Issuer, r.Resource)
	}
	m.mu.Lock()
	if m.cardReqs == nil {
		m.cardReqs = map[cardReqKey]*Requirement{}
	}
	m.cardReqs[key] = r
	m.mu.Unlock()
	return r, nil
}

// RequirementForChallenge follows the Bearer challenges of a 401 response for
// target to its Protected Resource Metadata and the first listed authorization
// server whose metadata validates and that has a usable client. It returns
// (nil, nil) when the resource publishes no metadata.
func (m *Manager) RequirementForChallenge(ctx context.Context, target *url.URL, chs []Challenge) (*Requirement, error) {
	f := m.fetcher()
	ct, err := f.discoverFromChallenge(ctx, target, chs)
	if errors.Is(err, errNoResourceMetadata) {
		return nil, nil
	}
	if err != nil {
		return nil, failure("discovering authorization for %s: %w", target.Redacted(), err)
	}
	m.logf("resource %s uses authorization servers %v", ct.resource.Resource, ct.resource.AuthorizationServers)
	var errs []error
	var noClient []string
	for _, issuer := range ct.resource.AuthorizationServers {
		md, err := f.serverMetadata(ctx, issuer)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		e := md.endpoints()
		if err := e.validate(); err != nil {
			errs = append(errs, err)
			continue
		}
		if _, err := selectClient(m.Clients, e); err != nil {
			var nc *NoClientError
			if errors.As(err, &nc) {
				noClient = append(noClient, issuer)
				continue
			}
			return nil, err
		}
		return &Requirement{Endpoints: e, Resource: NormalizeResource(ct.resource.Resource), Scopes: ct.scopes}, nil
	}
	if len(noClient) > 0 {
		return nil, &NoClientError{Issuers: noClient}
	}
	return nil, failure("no usable authorization server for %s: %w", ct.resource.Resource, errors.Join(errs...))
}

// Key returns the grant key and client for a requirement. Scopes come from
// override, else the requirement, else the registration.
func (m *Manager) Key(req *Requirement, override []string) (GrantKey, ClientChoice, error) {
	choice, err := selectClient(m.Clients, req.Endpoints)
	if err != nil {
		return GrantKey{}, ClientChoice{}, err
	}
	scopes := override
	if len(scopes) == 0 {
		scopes = req.Scopes
	}
	if len(scopes) == 0 {
		scopes = choice.Scopes
	}
	return NewGrantKey(req.Endpoints.Issuer, choice.ClientID, req.Resource, scopes), choice, nil
}

// Grant returns the stored grant for a requirement, refreshed when it is about to
// expire, or nil when there is none that can be used without interaction.
func (m *Manager) Grant(ctx context.Context, req *Requirement) (*Grant, error) {
	key, _, err := m.Key(req, nil)
	if err != nil {
		return nil, err
	}
	return m.grant(ctx, key)
}

func (m *Manager) grant(ctx context.Context, key GrantKey) (*Grant, error) {
	g, err := m.Store.Get(key)
	if err != nil || g == nil {
		return nil, err
	}
	if !g.needsRefresh(m.now()) {
		return g, nil
	}
	return m.refresh(ctx, key, "")
}

// refresh refreshes the grant for key under the store lock. With rejected set,
// the token was refused by the agent and is refreshed even if not expired, unless
// another process has already replaced it. It returns nil when a new
// authorization is needed.
func (m *Manager) refresh(ctx context.Context, key GrantKey, rejected string) (*Grant, error) {
	unlock, err := m.lock(ctx)
	if err != nil {
		return nil, err
	}
	defer unlock()

	g, err := m.Store.Get(key)
	if err != nil || g == nil {
		return nil, err
	}
	now := m.now()
	if rejected == "" && !g.needsRefresh(now) {
		return g, nil
	}
	if rejected != "" && g.AccessToken != rejected && !g.needsRefresh(now) {
		return g, nil
	}
	if g.RefreshToken == "" {
		if rejected == "" && !g.expired(now) {
			return g, nil
		}
		return nil, nil
	}
	m.logf("refreshing the access token for %s", g.Key.Resource)
	t, err := m.fetcher().refresh(ctx, g)
	if isOAuthError(err, "invalid_grant") {
		m.logf("the refresh token for %s was rejected; a new authorization is needed", g.Key.Resource)
		if err := m.Store.Delete(key); err != nil {
			return nil, err
		}
		return nil, nil
	}
	if err != nil {
		if rejected == "" && !g.expired(now) {
			m.logf("refreshing the access token for %s failed, using the current one: %v", g.Key.Resource, err)
			return g, nil
		}
		return nil, failure("refreshing the access token for %s: %w", g.Key.Resource, err)
	}
	g.apply(t, now)
	if err := m.Store.Put(*g); err != nil {
		return nil, err
	}
	return g, nil
}

// Acquire obtains a new grant interactively and stores it: with the device flow
// when requested or when the server or card offers no other, otherwise with the
// authorization code flow.
func (m *Manager) Acquire(ctx context.Context, req *Requirement, opts AcquireOptions) (*Grant, error) {
	key, choice, err := m.Key(req, opts.Scopes)
	if err != nil {
		return nil, err
	}
	m.logf("authorizing %s at %s as client %s (%s)", req.Resource, req.Endpoints.Issuer, choice.ClientID, choice.Source)
	f := m.fetcher()
	var t *tokenResponse
	if opts.Device || req.PreferDevice || req.Endpoints.Authorization == "" {
		sleep := sleepFunc(sleepContext)
		if opts.Sleep != nil {
			sleep = opts.Sleep
		}
		t, err = f.deviceCode(ctx, req.Endpoints, choice, key.Resource, key.Scopes, opts.Prompter, sleep)
	} else {
		t, err = f.authorizationCode(ctx, req.Endpoints, choice, key.Resource, key.Scopes, opts.Prompter)
	}
	if err != nil {
		return nil, err
	}
	now := m.now()
	g := Grant{Key: key, Endpoints: req.Endpoints, CreatedAt: now.UTC(), ClientSource: choice.Source}
	g.apply(t, now)
	unlock, err := m.lock(ctx)
	if err != nil {
		return nil, err
	}
	defer unlock()
	if err := m.Store.Put(g); err != nil {
		return nil, err
	}
	m.learn(g.Key)
	return &g, nil
}

// GrantForResource returns the single stored grant for a resource, refreshed when
// needed, or nil when there is none or more than one.
func (m *Manager) GrantForResource(ctx context.Context, resource string) (*Grant, error) {
	resource = NormalizeResource(resource)
	m.mu.Lock()
	key, ok := m.learned[resource]
	m.mu.Unlock()
	if ok {
		return m.grant(ctx, key)
	}
	grants, err := m.Store.List()
	if err != nil {
		return nil, err
	}
	var found *GrantKey
	for _, g := range grants {
		if g.Key.Resource != resource {
			continue
		}
		if found != nil {
			m.logf("several grants for %s; not choosing one", resource)
			return nil, nil
		}
		k := g.Key
		found = &k
	}
	if found == nil {
		return nil, nil
	}
	return m.grant(ctx, *found)
}

// learnedGrant returns a grant learned in this process for a resource covering target.
func (m *Manager) learnedGrant(ctx context.Context, target *url.URL) (*Grant, error) {
	m.mu.Lock()
	var key *GrantKey
	for resource, k := range m.learned {
		if resourceCovers(resource, target.String()) {
			k := k
			key = &k
			break
		}
	}
	m.mu.Unlock()
	if key == nil {
		return nil, nil
	}
	return m.grant(ctx, *key)
}

func (m *Manager) learn(key GrantKey) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.learned == nil {
		m.learned = map[string]GrantKey{}
	}
	m.learned[key.Resource] = key
}

// List returns every stored grant.
func (m *Manager) List() ([]Grant, error) {
	return m.Store.List()
}

// Revoke revokes a grant at its authorization server.
func (m *Manager) Revoke(ctx context.Context, g *Grant) error {
	return m.fetcher().revoke(ctx, g)
}

// Delete removes a grant from the store.
func (m *Manager) Delete(ctx context.Context, key GrantKey) error {
	unlock, err := m.lock(ctx)
	if err != nil {
		return err
	}
	defer unlock()
	return m.Store.Delete(key)
}

func (m *Manager) lock(ctx context.Context) (func(), error) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), lockTimeout)
	defer cancel()
	return m.Store.Lock(ctx)
}
