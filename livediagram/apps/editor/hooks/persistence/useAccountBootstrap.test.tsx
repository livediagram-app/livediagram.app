// @vitest-environment jsdom

// Production's `Error·Api·Http401` on an owner-scoped list: the Explorer mounts
// ShapeLibraryProvider in the same render that makes the signed-in user's
// account id the owner, and React runs that child's effect (its fetch)
// before the parent's. When the token provider was registered in a passive
// effect, the fetch went out with no Bearer for the account. The provider must
// be in place before any child's first fetch.

import { render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiHeaders, setTokenProvider } from '@/lib/api/core';

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(async (opts?: { skipCache?: boolean }): Promise<string | null> =>
    opts?.skipCache ? 'jwt-fresh' : 'jwt-1',
  ),
}));
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => {
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

// A guest who signs in carries straight on: the accounts site has already moved
// the guest's work onto the account, so nothing holds the page.
describe('useAccountBootstrap after a guest signs in', () => {
  it('settles at once, with nothing to wait for', () => {
    function Probe() {
      return <>{String(useAccountBootstrap().authLoaded)}</>;
    }
    expect(renderToString(<Probe />)).toBe('true');
  });
});

describe('useAccountBootstrap with several mounts', () => {
  // AuthControls, the Settings dialog's rows and the page itself each mount
  // the hook; the Drive mirror's provider mounts it at the root. One of them
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
