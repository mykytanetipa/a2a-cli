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

package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/a2aproject/a2a-cli/internal/clicfg"
	"github.com/a2aproject/a2a-cli/internal/clierr"
	"github.com/a2aproject/a2a-cli/internal/oauth"
	"github.com/a2aproject/a2a-cli/internal/oauth/oauthtest"
	"github.com/a2aproject/a2a-cli/internal/polling"
)

const oauthTestMessage = "hello from oauth"

type oauthEnv struct {
	as    *oauthtest.AuthServer
	agent *oauthtest.ProtectedAgent
	deps  deps
}

func newOAuthEnv(t *testing.T, server oauthtest.ServerOptions, agent oauthtest.AgentOptions) *oauthEnv {
	t.Helper()
	as := oauthtest.NewAuthServer(t, server)
	return &oauthEnv{
		as:    as,
		agent: oauthtest.NewProtectedAgent(t, as, agent),
		deps: deps{
			poller:          polling.Stream,
			cfgLoader:       clicfg.LoadEmpty,
			authInteractive: func() bool { return true },
			openURL:         oauthtest.Browser(t),
			oauthDir:        t.TempDir(),
			authSleep:       func(context.Context, time.Duration) error { return nil },
		},
	}
}

func (e *oauthEnv) clients() string {
	return fmt.Sprintf(`--oauth-clients={"authority":%q,"client_id":"cli-test"}`, e.as.URL)
}

func (e *oauthEnv) run(t *testing.T, args ...string) (stdout, stderr string, err error) {
	t.Helper()
	return runCMDCapturingStderrWithConfig(t, e.deps, args...)
}

func (e *oauthEnv) mustRun(t *testing.T, args ...string) (stdout, stderr string) {
	t.Helper()
	stdout, stderr, err := e.run(t, args...)
	if err != nil {
		t.Fatalf("a2a %s error = %v\nstderr:\n%s", strings.Join(args, " "), err, stderr)
	}
	return stdout, stderr
}

func errCode(err error) string {
	if ce := clierr.Classify(err); ce != nil {
		return ce.Code
	}
	return ""
}

func TestOAuthSignInFromCard(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		agent oauthtest.AgentOptions
	}{
		{name: "metadata url", agent: oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL, Scopes: []string{"a2a.invoke"}}},
		{name: "inline authorization code", agent: oauthtest.AgentOptions{Card: oauthtest.CardAuthCode}},
		{name: "inline device code", agent: oauthtest.AgentOptions{Card: oauthtest.CardDeviceCode}},
		{name: "openid connect", agent: oauthtest.AgentOptions{Card: oauthtest.CardOIDC}},
		{name: "json-rpc", agent: oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL, JSONRPC: true}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			e := newOAuthEnv(t, oauthtest.ServerOptions{}, tc.agent)
			args := []string{"send", "-a", e.agent.URL, e.clients(), "-o", "json", oauthTestMessage}

			out, stderr := e.mustRun(t, args...)
			if !strings.Contains(stderr, "To authorize, open:") || !strings.Contains(stderr, "Authorized.") {
				t.Fatalf("first send stderr = %q, want sign-in instructions", stderr)
			}
			if !strings.Contains(out, oauthTestMessage) {
				t.Fatalf("first send output = %q, want the echoed message", out)
			}
			for _, h := range e.agent.AuthorizationHeaders() {
				if h == "" {
					t.Fatalf("the agent received a request without a token; the card requirement should be met before the first call")
				}
			}

			out, stderr = e.mustRun(t, args...)
			if strings.Contains(stderr, "To authorize") {
				t.Fatalf("second send stderr = %q, want the stored grant reused", stderr)
			}
			if !strings.Contains(out, oauthTestMessage) {
				t.Fatalf("second send output = %q, want the echoed message", out)
			}
		})
	}
}

func TestOAuthSignInFromChallenge(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		agent oauthtest.AgentOptions
		args  func(agentURL string) []string
	}{
		{name: "card without security", args: func(u string) []string { return []string{"send", "-a", u} }},
		{name: "protected card", agent: oauthtest.AgentOptions{ProtectCard: true}, args: func(u string) []string { return []string{"send", "-a", u} }},
		{name: "well-known probe", agent: oauthtest.AgentOptions{OmitResourceMetadata: true}, args: func(u string) []string { return []string{"send", "-a", u} }},
		{name: "endpoint", args: func(u string) []string { return []string{"send", "-e", u, "--transport", "rest"} }},
		{name: "json-rpc endpoint", agent: oauthtest.AgentOptions{JSONRPC: true}, args: func(u string) []string { return []string{"send", "-e", u, "--transport", "jsonrpc"} }},
		{name: "streaming", args: func(u string) []string { return []string{"send", "--stream", "-a", u} }},
		{name: "card get of a protected card", agent: oauthtest.AgentOptions{ProtectCard: true}, args: func(u string) []string { return []string{"card", "get", u} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			e := newOAuthEnv(t, oauthtest.ServerOptions{}, tc.agent)
			args := append(tc.args(e.agent.URL), e.clients(), oauthTestMessage)
			if tc.args(e.agent.URL)[0] == "card" {
				args = append(tc.args(e.agent.URL), e.clients())
			}
			out, stderr := e.mustRun(t, args...)
			if !strings.Contains(stderr, "Authorized.") {
				t.Fatalf("stderr = %q, want a sign-in", stderr)
			}
			if !strings.Contains(out, oauthTestMessage) && !strings.Contains(out, "Protected Echo") {
				t.Fatalf("output = %q, want the agent's answer", out)
			}
			if _, stderr = e.mustRun(t, args...); strings.Contains(stderr, "To authorize") {
				t.Fatalf("second run stderr = %q, want the stored grant reused", stderr)
			}
		})
	}
}

func TestOAuthSignInNotAllowed(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		interactive bool
		extra       []string
	}{
		{name: "cached mode", interactive: true, extra: []string{"--oauth", "cached"}},
		{name: "no terminal", interactive: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
			e.deps.authInteractive = func() bool { return tc.interactive }
			args := append([]string{"send", "-a", e.agent.URL, e.clients(), oauthTestMessage}, tc.extra...)
			_, stderr, err := e.run(t, args...)
			if got := errCode(err); got != clierr.CodeAuthRequired {
				t.Fatalf("a2a send error = %v (code %s), want %s", err, got, clierr.CodeAuthRequired)
			}
			if hint := clierr.Classify(err).Hint; !strings.Contains(hint, "a2a auth login "+e.agent.URL) {
				t.Fatalf("a2a send hint = %q, want it to suggest a2a auth login", hint)
			}
			if strings.Contains(stderr, "To authorize") || e.as.Hits("/authorize") != 0 {
				t.Fatalf("a sign-in started although it is not allowed; stderr = %q", stderr)
			}

			e.deps.authInteractive = func() bool { return false }
			e.mustRun(t, "auth", "login", e.agent.URL, e.clients())
			e.mustRun(t, args...)
		})
	}
}

func TestOAuthSkipped(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		extra      []string
		wantHeader string
	}{
		{name: "explicit --auth", extra: []string{"--auth", "Bearer user-supplied"}, wantHeader: "Bearer user-supplied"},
		{name: "explicit --svc-param", extra: []string{"--svc-param", "Authorization=Bearer from-param"}, wantHeader: "Bearer from-param"},
		{name: "oauth off", extra: []string{"--oauth", "off"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
			args := append([]string{"send", "-a", e.agent.URL, e.clients(), oauthTestMessage}, tc.extra...)
			_, stderr, err := e.run(t, args...)
			if err == nil {
				t.Fatalf("a2a send error = nil, want the agent to reject the request")
			}
			if code := errCode(err); code == clierr.CodeAuthRequired || code == clierr.CodeAuthFailed {
				t.Fatalf("a2a send error code = %s, want OAuth not involved", code)
			}
			if strings.Contains(stderr, "To authorize") || e.as.Hits("/.well-known/oauth-authorization-server") != 0 {
				t.Fatalf("OAuth discovery ran; stderr = %q", stderr)
			}
			if tc.wantHeader != "" && !slices.Contains(e.agent.AuthorizationHeaders(), tc.wantHeader) {
				t.Fatalf("agent Authorization headers = %q, want %q", e.agent.AuthorizationHeaders(), tc.wantHeader)
			}
		})
	}
}

func TestOAuthClientSelection(t *testing.T) {
	t.Parallel()
	t.Run("no client", func(t *testing.T) {
		t.Parallel()
		e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{})
		_, _, err := e.run(t, "send", "-a", e.agent.URL, oauthTestMessage)
		if got := errCode(err); got != clierr.CodeUsage {
			t.Fatalf("a2a send error = %v (code %s), want %s", err, got, clierr.CodeUsage)
		}
		if !strings.Contains(err.Error(), `"authority":"`+e.as.URL+`"`) {
			t.Fatalf("a2a send error = %v, want a ready-to-paste oauth-clients entry", err)
		}
	})
	t.Run("CIMD fallback", func(t *testing.T) {
		t.Parallel()
		e := newOAuthEnv(t, oauthtest.ServerOptions{CIMD: true}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
		e.mustRun(t, "send", "-a", e.agent.URL, oauthTestMessage)
		if got := e.as.LastAuthorizeQuery().Get("client_id"); got != oauth.DefaultClientID {
			t.Fatalf("client_id = %q, want %q", got, oauth.DefaultClientID)
		}
	})
	t.Run("from a yaml config file", func(t *testing.T) {
		t.Parallel()
		e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
		path := filepath.Join(t.TempDir(), "a2a.yaml")
		yaml := fmt.Sprintf("oauth-clients:\n  - authority: %s\n    client_id: from-yaml\n    scopes: [a2a.invoke]\n", e.as.URL)
		if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
			t.Fatal(err)
		}
		e.deps.cfgLoader = clicfg.Load
		e.mustRun(t, "send", "-a", e.agent.URL, "--config", path, oauthTestMessage)
		if got := e.as.LastAuthorizeQuery().Get("client_id"); got != "from-yaml" {
			t.Fatalf("client_id = %q, want %q", got, "from-yaml")
		}
	})
}

func TestOAuthRequests(t *testing.T) {
	t.Parallel()
	e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
	e.mustRun(t, "send", "-a", e.agent.URL, e.clients(), "--svc-param", "X-Trace=1", oauthTestMessage)

	if got := e.as.LastForm("/token").Get("resource"); got != e.agent.URL {
		t.Fatalf("resource sent to the token endpoint = %q, want %q", got, e.agent.URL)
	}
	if got := e.as.LastAuthorizeQuery().Get("resource"); got != e.agent.URL {
		t.Fatalf("resource sent to the authorization endpoint = %q, want %q", got, e.agent.URL)
	}
	if e.as.SawAuthorizationHeader() {
		t.Fatalf("the authorization server received an Authorization header")
	}

	e.as.Invalidate()
	_, stderr := e.mustRun(t, "send", "-a", e.agent.URL, e.clients(), oauthTestMessage)
	if strings.Contains(stderr, "To authorize") {
		t.Fatalf("send after the token was invalidated stderr = %q, want a silent refresh", stderr)
	}
}

func TestAuthCommands(t *testing.T) {
	t.Parallel()
	e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL, Scopes: []string{"a2a.invoke"}})

	out, stderr := e.mustRun(t, "auth", "login", e.agent.URL, e.clients(), "-o", "json")
	if !strings.Contains(stderr, "To authorize, open:") {
		t.Fatalf("auth login stderr = %q, want sign-in instructions", stderr)
	}
	var login grantView
	if err := json.Unmarshal([]byte(out), &login); err != nil {
		t.Fatalf("json.Unmarshal(auth login output %q) error = %v", out, err)
	}
	want := grantView{Resource: e.agent.URL, Issuer: e.as.URL, ClientID: "cli-test", ClientSource: oauth.ClientSourceConfig, Scopes: []string{"a2a.invoke"}, Refreshable: true}
	if diff := cmp.Diff(want, login, cmpIgnoreExpiry); diff != "" {
		t.Fatalf("auth login wrong result (-want +got) diff = %s", diff)
	}

	out, _ = e.mustRun(t, "auth", "list", "-o", "json")
	var listed []grantView
	if err := json.Unmarshal([]byte(out), &listed); err != nil {
		t.Fatalf("json.Unmarshal(auth list output %q) error = %v", out, err)
	}
	if diff := cmp.Diff([]grantView{want}, listed, cmpIgnoreExpiry); diff != "" {
		t.Fatalf("auth list wrong result (-want +got) diff = %s", diff)
	}

	out, _ = e.mustRun(t, "auth", "get", e.agent.URL, "-o", "json")
	var got struct {
		URL   string      `json:"url"`
		OAuth []grantView `json:"oauth"`
	}
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("json.Unmarshal(auth get output %q) error = %v", out, err)
	}
	if len(got.OAuth) != 1 || got.OAuth[0].AccessToken != "" {
		t.Fatalf("auth get = %s, want one grant with the token redacted", out)
	}
	out, _ = e.mustRun(t, "auth", "get", e.agent.URL, "--reveal", "-o", "json")
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.OAuth) != 1 || !e.as.Valid(got.OAuth[0].AccessToken, e.agent.URL, nil) {
		t.Fatalf("auth get --reveal = %s, want the stored access token", out)
	}

	out, _ = e.mustRun(t, "auth", "logout", e.agent.URL, "-o", "json")
	var logout struct {
		Removed []logoutView `json:"removed"`
	}
	if err := json.Unmarshal([]byte(out), &logout); err != nil {
		t.Fatalf("json.Unmarshal(auth logout output %q) error = %v", out, err)
	}
	if diff := cmp.Diff([]logoutView{{Resource: e.agent.URL, Issuer: e.as.URL, Revoked: true}}, logout.Removed); diff != "" {
		t.Fatalf("auth logout wrong result (-want +got) diff = %s", diff)
	}
	if len(e.as.Revoked()) != 1 {
		t.Fatalf("revoked tokens = %v, want the refresh token revoked", e.as.Revoked())
	}
	if out, _ = e.mustRun(t, "auth", "list"); !strings.Contains(out, "No stored OAuth grants") {
		t.Fatalf("auth list after logout = %q, want no grants", out)
	}

	_, stderr = e.mustRun(t, "auth", "login", e.agent.URL, e.clients(), "--device", "--scope", "a2a.invoke")
	if !strings.Contains(stderr, "Enter code:") {
		t.Fatalf("auth login --device stderr = %q, want a user code", stderr)
	}
	if out, _ = e.mustRun(t, "auth", "logout", "--all"); !strings.Contains(out, "Logged out of "+e.agent.URL+" (revoked)") {
		t.Fatalf("auth logout --all output = %q, want the grant revoked", out)
	}
}

func TestAuthLoginFromChallenge(t *testing.T) {
	t.Parallel()
	e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{})
	e.mustRun(t, "auth", "login", "-e", e.agent.URL, "--transport", "rest", e.clients())
	e.deps.authInteractive = func() bool { return false }
	e.mustRun(t, "send", "-e", e.agent.URL, "--transport", "rest", "--oauth", "cached", e.clients(), oauthTestMessage)
}

func TestAuthUsageErrors(t *testing.T) {
	t.Parallel()
	e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{})
	tests := [][]string{
		{"auth", "logout"},
		{"auth", "logout", e.agent.URL, "--all"},
		{"auth", "list", "--oauth", "off"},
		{"send", "-a", e.agent.URL, "--oauth", "sometimes", "x"},
		{"send", "-a", e.agent.URL, "--oauth-clients", "not json", "x"},
	}
	for _, args := range tests {
		if _, _, err := e.run(t, args...); errCode(err) != clierr.CodeUsage {
			t.Errorf("a2a %s error = %v, want a usage error", strings.Join(args, " "), err)
		}
	}
}

type memKeyring struct {
	mu      sync.Mutex
	secrets map[string]string
}

func (k *memKeyring) Get(service, user string) (string, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if s, ok := k.secrets[service+"/"+user]; ok {
		return s, nil
	}
	return "", oauth.ErrSecretNotFound
}

func (k *memKeyring) Set(service, user, secret string) error {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.secrets == nil {
		k.secrets = map[string]string{}
	}
	k.secrets[service+"/"+user] = secret
	return nil
}

func (k *memKeyring) Delete(service, user string) error {
	k.mu.Lock()
	defer k.mu.Unlock()
	delete(k.secrets, service+"/"+user)
	return nil
}

func TestOAuthKeychainStore(t *testing.T) {
	t.Parallel()
	e := newOAuthEnv(t, oauthtest.ServerOptions{}, oauthtest.AgentOptions{Card: oauthtest.CardMetadataURL})
	kr := &memKeyring{}
	e.deps.keyring = kr
	args := []string{"send", "-a", e.agent.URL, e.clients(), "--oauth-store", "keychain", oauthTestMessage}
	e.mustRun(t, args...)

	index, err := os.ReadFile(filepath.Join(e.deps.oauthDir, "grants.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(index), "access_token") || strings.Contains(string(index), "refresh_token") {
		t.Fatalf("grants.json contains tokens with --oauth-store keychain: %s", index)
	}
	if len(kr.secrets) != 1 {
		t.Fatalf("keychain entries = %d, want 1", len(kr.secrets))
	}
	if _, stderr := e.mustRun(t, args...); strings.Contains(stderr, "To authorize") {
		t.Fatalf("second send stderr = %q, want the grant read from the keychain", stderr)
	}
	e.mustRun(t, "auth", "logout", "--all", "--oauth-store", "keychain")
	if len(kr.secrets) != 0 {
		t.Fatalf("keychain entries after logout = %d, want 0", len(kr.secrets))
	}
}

var cmpIgnoreExpiry = cmp.FilterPath(func(p cmp.Path) bool { return p.Last().String() == ".ExpiresAt" }, cmp.Ignore())
