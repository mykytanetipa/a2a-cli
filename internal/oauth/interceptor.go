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

	"github.com/a2aproject/a2a-go/v2/a2aclient"
)

type attachedGrantKey struct{}

// withAttached records on ctx the grant whose token a request carries, so the
// transport can tell its own token from an explicit credential.
func withAttached(ctx context.Context, g *Grant) context.Context {
	return context.WithValue(ctx, attachedGrantKey{}, g)
}

func attachedFrom(ctx context.Context) (*Grant, bool) {
	g, ok := ctx.Value(attachedGrantKey{}).(*Grant)
	return g, ok
}

// Interceptor returns an a2a client interceptor that attaches grants to calls.
// When the agent card declares an OAuth requirement for the call's interface,
// the call fails with *InteractionRequiredError if no grant is stored. Calls that
// already carry an Authorization service parameter (from --auth, --svc-param or
// a credential helper) are left alone.
func (m *Manager) Interceptor() a2aclient.CallInterceptor {
	return &interceptor{m: m}
}

type interceptor struct {
	a2aclient.PassthroughInterceptor
	m *Manager
}

var _ a2aclient.CallInterceptor = (*interceptor)(nil)

// Before implements [a2aclient.CallInterceptor].
func (i *interceptor) Before(ctx context.Context, req *a2aclient.Request) (context.Context, any, error) {
	if len(req.ServiceParams.Get("authorization")) > 0 {
		return ctx, nil, nil
	}
	var r *Requirement
	if req.Card != nil {
		var err error
		r, err = i.m.RequirementForCard(ctx, req.Card, req.BaseURL)
		if err != nil {
			return ctx, nil, err
		}
	}
	if r == nil {
		g, err := i.m.GrantForResource(ctx, req.BaseURL)
		if err != nil || g == nil {
			return ctx, nil, err
		}
		req.ServiceParams.Append("Authorization", g.header())
		return withAttached(ctx, g), nil, nil
	}
	g, err := i.m.Grant(ctx, r)
	if err != nil {
		return ctx, nil, err
	}
	if g == nil {
		return ctx, nil, &InteractionRequiredError{Requirement: r}
	}
	req.ServiceParams.Append("Authorization", g.header())
	return withAttached(ctx, g), nil, nil
}
