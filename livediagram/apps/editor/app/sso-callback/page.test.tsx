// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The OAuth callback must send a finished round-trip back to the page the
// user set out from (issue #612: Google sign-in mid MCP connect landed on
// the Explorer and lost the consent). Clerk's callback is stubbed to capture
// the redirect props it is handed.
const env = vi.hoisted(() => ({ query: '', props: {} as Record<string, unknown> }));
vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(env.query) }));
vi.mock('@/components/providers/StaticClerkProvider', () => ({
  StaticClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@clerk/react', () => ({
  AuthenticateWithRedirectCallback: (props: Record<string, unknown>) => {
    env.props = props;
    return null;
  },
}));

import SSOCallbackPage from './page';

describe('/sso-callback', () => {
  beforeEach(() => {
    env.props = {};
  });

  it('forces the carried return path for both sign-in and sign-up', () => {
    const consent = '/oauth/consent/?session=abc123&client=Claude&to=claude.ai';
    env.query = `redirect_url=${encodeURIComponent(consent)}`;
    render(<SSOCallbackPage />);
    expect(env.props).toMatchObject({
      signInForceRedirectUrl: consent,
      signUpForceRedirectUrl: consent,
    });
  });

  it('keeps the per-flow defaults without a safe return path', () => {
    for (const query of ['', 'redirect_url=https://evil.example', 'redirect_url=/sign-in/']) {
      env.query = query;
      cleanup();
      render(<SSOCallbackPage />);
      expect(env.props).toMatchObject({
        signInForceRedirectUrl: undefined,
        signUpForceRedirectUrl: undefined,
        signInFallbackRedirectUrl: '/explorer',
        signUpFallbackRedirectUrl: '/new',
      });
    }
  });
});
