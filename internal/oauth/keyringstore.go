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
	"encoding/json"
	"errors"
	"fmt"

	"github.com/zalando/go-keyring"
)

// keyringService is the service name grants are stored under in the OS keychain.
const keyringService = "a2a-cli-oauth"

// Keyring stores secrets in the OS keychain.
type Keyring interface {
	// Get returns the secret for user, or ErrSecretNotFound.
	Get(service, user string) (string, error)
	// Set stores the secret for user.
	Set(service, user, secret string) error
	// Delete removes the secret for user.
	Delete(service, user string) error
}

// ErrSecretNotFound is returned by a [Keyring] that has no secret for a user.
var ErrSecretNotFound = keyring.ErrNotFound

// SystemKeyring is the OS keychain: macOS Keychain, Windows Credential Manager,
// or the Secret Service on Linux.
type SystemKeyring struct{}

// Get implements [Keyring].
func (SystemKeyring) Get(service, user string) (string, error) { return keyring.Get(service, user) }

// Set implements [Keyring].
func (SystemKeyring) Set(service, user, secret string) error {
	return keyring.Set(service, user, secret)
}

// Delete implements [Keyring].
func (SystemKeyring) Delete(service, user string) error { return keyring.Delete(service, user) }

// KeyringStore keeps tokens in the OS keychain and everything else in a
// [FileStore] index, so grants can be listed without reading secrets.
type KeyringStore struct {
	Index   *FileStore
	Keyring Keyring
}

var _ Store = (*KeyringStore)(nil)

type keyringSecret struct {
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// List implements [Store].
func (s *KeyringStore) List() ([]Grant, error) {
	grants, err := s.Index.List()
	if err != nil {
		return nil, err
	}
	for i := range grants {
		if err := s.fill(&grants[i]); err != nil {
			return nil, err
		}
	}
	return grants, nil
}

// Get implements [Store].
func (s *KeyringStore) Get(key GrantKey) (*Grant, error) {
	g, err := s.Index.Get(key)
	if err != nil || g == nil {
		return g, err
	}
	if err := s.fill(g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *KeyringStore) fill(g *Grant) error {
	raw, err := s.Keyring.Get(keyringService, g.Key.ID())
	if errors.Is(err, ErrSecretNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("reading the keychain: %w", err)
	}
	var sec keyringSecret
	if err := json.Unmarshal([]byte(raw), &sec); err != nil {
		return fmt.Errorf("parsing the keychain entry for %s: %w", g.Key.Resource, err)
	}
	g.AccessToken, g.RefreshToken = sec.AccessToken, sec.RefreshToken
	return nil
}

// Put implements [Store].
func (s *KeyringStore) Put(g Grant) error {
	raw, err := json.Marshal(keyringSecret{AccessToken: g.AccessToken, RefreshToken: g.RefreshToken})
	if err != nil {
		return err
	}
	if err := s.Keyring.Set(keyringService, g.Key.ID(), string(raw)); err != nil {
		return fmt.Errorf("writing to the keychain (use --oauth-store file where none is available): %w", err)
	}
	g.AccessToken, g.RefreshToken = "", ""
	return s.Index.Put(g)
}

// Delete implements [Store].
func (s *KeyringStore) Delete(key GrantKey) error {
	if err := s.Keyring.Delete(keyringService, key.ID()); err != nil && !errors.Is(err, ErrSecretNotFound) {
		return fmt.Errorf("deleting from the keychain: %w", err)
	}
	return s.Index.Delete(key)
}

// Lock implements [Store].
func (s *KeyringStore) Lock(ctx context.Context) (func(), error) {
	return s.Index.Lock(ctx)
}
