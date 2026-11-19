// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Component, useEffect, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@liveworkspace/ui/toast';
import { ACCOUNT_STALL_MS, createAuthProvider } from './auth-provider';
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
      readSignedInHint: () => false,
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
      readSignedInHint: () => false,
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
      readSignedInHint: () => false,
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
      readSignedInHint: () => false,
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
      readSignedInHint: () => false,
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

// A browser whose hint says signed in (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site doesn't
// answer", "The editors"; Work Tracker 1082): it waits for its session, never a guest meanwhile, and says it can't
// reach the account while the session's answer doesn't come.
describe('createAuthProvider with a signed-in hint', () => {
  function Expecting() {
    const auth = useDeferredAuth();
    return (
      <p>
        {auth.authLoaded
          ? `settled ${auth.userId ?? 'guest'}`
          : `${auth.sessionExpected ? 'expected' : 'not expected'} ${auth.accountUnreachable ? 'unreachable' : 'reachable'}`}
      </p>
    );
  }
  // A bridge whose state the test publishes.
  let publish: (state: DeferredAuthState) => void = () => {};
  function Bridge({ onState }: OnState) {
    useEffect(() => {
      publish = onState;
    }, [onState]);
    return null;
  }
  const provider = (hinted: boolean) =>
    createAuthProvider({
      loadE2EAuthBridge: null,
      loadAccountsBridge: async () => Bridge,
      e2eSessionKey: 'k',
      readSignedInHint: () => hinted,
    });

  // The notice is a lazy component: load its module once up front, so the first draw waits on a cached import rather
  // than a cold transform, which on a loaded CI runner can outlast findByRole's one-second wait.
  beforeAll(async () => {
    await import('../chrome/AccountUnreachableNotice');
  });

  afterEach(() => vi.useRealTimers());

  it('expects the session, and says it can’t reach the account at the bridge’s first unknown answer', async () => {
    const AuthProvider = provider(true);
    render(
      <ToastProvider>
        <AuthProvider>
          <Expecting />
        </AuthProvider>
      </ToastProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('expected reachable')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    act(() => publish({ ...DEFERRED_AUTH_DEFAULT, accountUnreachable: true }));
    expect(screen.getByText('expected unreachable')).toBeTruthy();
    // The notice's code loads lazily, as it first draws.
    expect((await screen.findByRole('status')).textContent).toContain('Can’t reach your account.');
    // The session answers: the notice goes and the page carries on.
    act(() => publish(SIGNED_IN));
    expect(screen.getByText('settled user_a')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says so after ACCOUNT_STALL_MS with no answer at all', async () => {
    vi.useFakeTimers();
    const AuthProvider = provider(true);
    render(
      <ToastProvider>
        <AuthProvider>
          <Expecting />
        </AuthProvider>
      </ToastProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('expected reachable')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(ACCOUNT_STALL_MS));
    expect(screen.getByText('expected unreachable')).toBeTruthy();
    // A signed-out answer (a 401) settles at once, as a guest.
    act(() => publish({ ...DEFERRED_AUTH_DEFAULT, authLoaded: true }));
    expect(screen.getByText('settled guest')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('changes nothing without the hint', async () => {
    vi.useFakeTimers();
    const AuthProvider = provider(false);
    render(
      <ToastProvider>
        <AuthProvider>
          <Expecting />
        </AuthProvider>
      </ToastProvider>,
    );
    await act(async () => {});
    act(() => publish({ ...DEFERRED_AUTH_DEFAULT, accountUnreachable: true }));
    await act(async () => vi.advanceTimersByTime(ACCOUNT_STALL_MS * 2));
    // Nothing expects a session, and no notice shows: the 5 s give-up settles it as before.
    expect(screen.getByText(/^not expected/)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows no notice on the workbench page, which is signed in by its own session', async () => {
    nav.pathname = '/embed/workbench/abc';
    vi.useFakeTimers();
    const AuthProvider = provider(true);
    render(
      <ToastProvider>
        <AuthProvider>
          <Expecting />
        </AuthProvider>
      </ToastProvider>,
    );
    await act(async () => vi.advanceTimersByTime(ACCOUNT_STALL_MS * 2));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
