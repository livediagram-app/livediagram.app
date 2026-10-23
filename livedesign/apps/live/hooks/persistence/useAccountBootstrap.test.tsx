// @vitest-environment jsdom

// A child mounted in the same render that makes the signed-in user's
// account id the owner has its effect (its first fetch) run by React
// before the parent's. When the token provider was registered in a passive
// effect, the fetch went out without the account's Bearer, which the worker
// refuses. The provider must be in place
// before any child's first fetch.

import { act, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiHeaders, setTokenProvider } from '@/lib/api/core';
import { GUEST_TOKEN_STORAGE_KEY } from '@/lib/guest-token-key';
import { guestTokenFor } from '@/lib/testing/guest-token';

vi.mock('@/lib/auth-config', () => ({ signInEnabled: true, sessionsEnabled: true }));
const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(async (opts?: { skipCache?: boolean }): Promise<string | null> =>
    opts?.skipCache ? 'jwt-fresh' : 'jwt-1',
  ),
}));
vi.mock('@/components/providers/deferred-auth', () => {
  return {
    DEFERRED_AUTH_PENDING: { authLoaded: false },
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

const { useAccountBootstrap } = await import('./useAccountBootstrap');

afterEach(() => setTokenProvider(null));

describe('useAccountBootstrap token provider', () => {
  it("is registered before a child's first-render fetch", async () => {
    let headers: Promise<HeadersInit> | null = null;
    function Child() {
      useEffect(() => {
        headers = apiHeaders('user_abc');
      }, []);
      return null;
    }
    function Parent({ children }: { children: ReactNode }) {
      useAccountBootstrap();
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

  // The session's getToken() can resolve null for a moment on a live session; the
  // retry must reach the session as a cache bypass, not another cached read.
  it('passes the cache bypass through to the session', async () => {
    function Probe() {
      useAccountBootstrap();
      return null;
    }
    render(<Probe />);
    getToken.mockResolvedValueOnce(null);
    const sent = (await apiHeaders('user_abc')) as Record<string, string>;
    expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
    expect(sent['Authorization']).toBe('Bearer jwt-fresh');
  });
});

// A guest who signs in becomes the account (liveworkspace/docs/one-explorer-contracts.md "Guests"): the accounts
// site merges the guest's items into the account at sign-in, so the editor only lets go of the guest token, and
// nothing waits on a migration of its own.
describe('useAccountBootstrap after sign-in', () => {
  it('lets go of the guest token and settles at once', async () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestTokenFor('guest_1'));
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useAccountBootstrap().authLoaded);
      return null;
    }
    await act(async () => {
      render(<Probe />);
    });
    expect(seen.at(-1)).toBe(true);
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
  });
});

describe('useAccountBootstrap with several mounts', () => {
  // AuthControls, the Settings dialog's rows and the page itself each mount
  // the hook. One of them
  // unmounting must not take the Bearer away from the rest.
  it('keeps the provider while any mount remains', async () => {
    function Probe() {
      useAccountBootstrap();
      return null;
    }
    function Page({ extra }: { extra: boolean }) {
      return (
        <>
          <Probe />
          {extra ? <Probe /> : null}
        </>
      );
    }
    const view = render(<Page extra />);
    view.rerender(<Page extra={false} />);
    const sent = (await apiHeaders('user_abc')) as Record<string, string>;
    expect(sent['Authorization']).toBe('Bearer jwt-1');
    view.unmount();
    await expect(apiHeaders('user_abc')).rejects.toThrow();
  });
});
