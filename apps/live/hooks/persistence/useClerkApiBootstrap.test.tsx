// @vitest-environment jsdom

// Production's `Error·Api·Http401.ListCustomThemes`: the Explorer mounts
// CustomThemeProvider in the same render that makes the signed-in user's
// Clerk id the owner, and React runs that child's effect (its themes fetch)
// before the parent's. When the token provider was registered in a passive
// effect, the fetch went out without a Bearer and put the Clerk id in
// `X-Owner-Id`, which the worker refuses. The provider must be in place
// before any child's first fetch.

import { render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiHeaders, setTokenProvider } from '@/lib/api/core';

vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true }));
const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(async (opts?: { skipCache?: boolean }): Promise<string | null> =>
    opts?.skipCache ? 'jwt-fresh' : 'jwt-1',
  ),
}));
vi.mock('@/components/providers/deferred-auth', () => {
  return {
    useDeferredAuth: () => ({
      authLoaded: true,
      isSignedIn: true,
      userId: 'user_abc',
      user: null,
      getToken,
      signOut: async () => {},
      deleteAccount: null,
    }),
  };
});

const { useClerkApiBootstrap } = await import('./useClerkApiBootstrap');

afterEach(() => setTokenProvider(null));

describe('useClerkApiBootstrap token provider', () => {
  it("is registered before a child's first-render fetch", async () => {
    let headers: Promise<HeadersInit> | null = null;
    function Child() {
      useEffect(() => {
        headers = apiHeaders('user_abc');
      }, []);
      return null;
    }
    function Parent({ children }: { children: ReactNode }) {
      useClerkApiBootstrap();
      return <>{children}</>;
    }
    render(
      <Parent>
        <Child />
      </Parent>,
    );
    const sent = (await headers!) as Record<string, string>;
    expect(sent['Authorization']).toBe('Bearer jwt-1');
    expect(sent['X-Owner-Id']).toBeUndefined();
  });

  // Clerk's getToken() can resolve null for a moment on a live session; the
  // retry must reach Clerk as a cache bypass, not another cached read.
  it('passes the cache bypass through to Clerk', async () => {
    function Probe() {
      useClerkApiBootstrap();
      return null;
    }
    render(<Probe />);
    getToken.mockResolvedValueOnce(null);
    const sent = (await apiHeaders('user_abc')) as Record<string, string>;
    expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
    expect(sent['Authorization']).toBe('Bearer jwt-fresh');
  });
});
