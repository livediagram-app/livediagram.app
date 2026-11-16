// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Component, useEffect, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthProvider } from './auth-provider';
import {
  DEFERRED_AUTH_DEFAULT,
  DEFERRED_AUTH_PENDING,
  useDeferredAuth,
  type DeferredAuthState,
} from './deferred-auth';

// The deferred-auth provider (auth-provider.tsx): the bridge mounts by a state update as its code lands, never through
// a Suspense reveal that React's reveal throttle can hold back (livediagram's offline-mode.md "The code it draws is in
// first"), and stands down on the workbench page.

const nav = vi.hoisted(() => ({ pathname: '/document/doc-1' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

type OnState = { onState: (state: DeferredAuthState) => void };

const SIGNED_IN: DeferredAuthState = {
  ...DEFERRED_AUTH_DEFAULT,
  authLoaded: true,
  userId: 'user_a',
};

function AccountsBridge({ onState }: OnState) {
  useEffect(() => onState(SIGNED_IN), [onState]);
  return <p>accounts bridge</p>;
}

function Reader() {
  const auth = useDeferredAuth();
  return (
    <p>
      {auth === DEFERRED_AUTH_PENDING ? 'pending' : auth.authLoaded ? auth.userId : 'unsettled'}
    </p>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <p>boundary caught it</p> : this.props.children;
  }
}

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  nav.pathname = '/document/doc-1';
});
afterEach(cleanup);

describe('createAuthProvider', () => {
  it('asks for the bridge as it first renders and mounts it once its code lands', async () => {
    const code = deferred<ComponentType<OnState>>();
    const loadAccountsBridge = vi.fn(() => code.promise);
    const AuthProvider = createAuthProvider({
      loadE2EAuthBridge: null,
      loadAccountsBridge,
      e2eSessionKey: 'k',
    });
    render(
      <AuthProvider>
        <Reader />
      </AuthProvider>,
    );
    expect(loadAccountsBridge).toHaveBeenCalledOnce();
    expect(screen.getByText('unsettled')).toBeTruthy();
    await act(async () => code.resolve(AccountsBridge));
    expect(screen.getByText('accounts bridge')).toBeTruthy();
    expect(screen.getByText('user_a')).toBeTruthy();
    expect(loadAccountsBridge).toHaveBeenCalledOnce();
  });

  it("hands the e2e bridge the test's session key in a test build", async () => {
    const seen: string[] = [];
    function E2EAuthBridge({ sessionKey, onState }: OnState & { sessionKey: string }) {
      seen.push(sessionKey);
      useEffect(() => onState(SIGNED_IN), [onState]);
      return null;
    }
    const loadAccountsBridge = vi.fn(async () => AccountsBridge);
    const AuthProvider = createAuthProvider({
      loadE2EAuthBridge: async () => E2EAuthBridge,
      loadAccountsBridge,
      e2eSessionKey: 'app:e2e:session',
    });
    render(
      <AuthProvider>
        <Reader />
      </AuthProvider>,
    );
    expect(await screen.findByText('user_a')).toBeTruthy();
    expect(seen).toContain('app:e2e:session');
    expect(loadAccountsBridge).not.toHaveBeenCalled();
  });

  it('holds auth pending on the workbench page and loads no bridge', async () => {
    nav.pathname = '/embed/workbench/abc';
    const loadAccountsBridge = vi.fn(async () => AccountsBridge);
    const AuthProvider = createAuthProvider({
      loadE2EAuthBridge: null,
      loadAccountsBridge,
      e2eSessionKey: 'k',
    });
    render(
      <AuthProvider>
        <Reader />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('pending')).toBeTruthy();
    expect(loadAccountsBridge).not.toHaveBeenCalled();
  });

  it('throws a failed load to the error boundary, and a later mount tries again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadAccountsBridge = vi
      .fn<() => Promise<ComponentType<OnState>>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(AccountsBridge);
    const AuthProvider = createAuthProvider({
      loadE2EAuthBridge: null,
      loadAccountsBridge,
      e2eSessionKey: 'k',
    });
    const first = render(
      <Boundary>
        <AuthProvider>
          <Reader />
        </AuthProvider>
      </Boundary>,
    );
    expect(await screen.findByText('boundary caught it')).toBeTruthy();
    first.unmount();
    render(
      <AuthProvider>
        <Reader />
      </AuthProvider>,
    );
    expect(await screen.findByText('user_a')).toBeTruthy();
    expect(loadAccountsBridge).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it.each([
    [
      'lands',
      (code: ReturnType<typeof deferred<ComponentType<OnState>>>) => code.resolve(AccountsBridge),
    ],
    [
      'fails',
      (code: ReturnType<typeof deferred<ComponentType<OnState>>>) =>
        code.reject(new Error('offline')),
    ],
  ])('sets nothing once unmounted before the code %s', async (_, settle) => {
    const code = deferred<ComponentType<OnState>>();
    const AuthProvider = createAuthProvider({
      loadE2EAuthBridge: null,
      loadAccountsBridge: () => code.promise,
      e2eSessionKey: 'k',
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(
      <AuthProvider>
        <Reader />
      </AuthProvider>,
    );
    view.unmount();
    await act(async () => settle(code));
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
