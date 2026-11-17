'use client';

// Deferred auth for the whole app tree (docs/specs/014-identity/auth-and-guest-access.md: auth is purely additive).
// The children render at once under DeferredAuthContext's "not settled" defaults, and a lazily-loaded bridge
// (the editor's AccountsBridge, an async chunk) asks the api for the session and pushes the distilled auth state into
// the context. Auth state "pops in" once that one request answers.
//
// The bridge mounts by a state update as its code lands, never through a Suspense boundary: React holds back revealing
// waiting content for 300 ms after any is revealed, so a bridge behind a boundary waited on whatever the page revealed
// around it (a warm open's paint), and the document load waits on the bridge (livediagram's
// docs/specs/006-document/offline-mode.md "The code it draws is in first").
//
// Signing in leaves the app for the accounts site on a full-page visit and comes back on another, so no state from
// before signing in survives into the signed-in page. Each editor makes the provider once, in its
// components/providers/AuthProvider.tsx, which also binds the workbench and holds the loads of its bridges' code.

import { usePathname } from 'next/navigation';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  DEFERRED_AUTH_DEFAULT,
  DEFERRED_AUTH_PENDING,
  DeferredAuthContext,
  type DeferredAuthState,
} from './deferred-auth';

type OnState = { onState: (state: DeferredAuthState) => void };

export type AuthProviderDeps = {
  // The e2e stand-in for the accounts bridge's code, in test builds only (e2eAuthEnabled); null in every real bundle.
  loadE2EAuthBridge: (() => Promise<ComponentType<OnState & { sessionKey: string }>>) | null;
  loadAccountsBridge: () => Promise<ComponentType<OnState>>;
  // The sessionStorage key the e2e bridge reads the test's session from (the editor's E2E_SESSION_KEY).
  e2eSessionKey: string;
  // The app's readable sign-in hint (its lib/signed-in-hint.ts): whether this browser probably has a session. Read
  // once, as the provider first renders.
  readSignedInHint: () => boolean;
};

// The notice only draws in an accounts outage, so its code stays out of every editor's first load and is fetched when
// it is first needed, under a boundary of its own so nothing else waits on it.
const AccountUnreachableNotice = lazy(() =>
  import('../chrome/AccountUnreachableNotice').then((m) => ({
    default: m.AccountUnreachableNotice,
  })),
);

/** How long a page whose hint says signed in waits for its session before it says it can't reach the account. The
 *  same 5 s a browser with no hint waits before it settles as a guest (useAccountBootstrap). */
export const ACCOUNT_STALL_MS = 5_000;

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed
// in by its workbench session, never by the accounts session or the e2e bridge: both stand down there and the state
// holds DEFERRED_AUTH_PENDING, so nothing above the page reads as a settled guest. WorkbenchAuthBridge publishes the
// session to the editor beneath.
const WORKBENCH_ROUTE = '/embed/workbench';

/** The app's deferred-auth provider, made once per editor at module scope. */
export function createAuthProvider({
  loadE2EAuthBridge,
  loadAccountsBridge,
  e2eSessionKey,
  readSignedInHint,
}: AuthProviderDeps) {
  // The bridge's code, fetched once per page. A failed fetch is forgotten, so a later mount tries again.
  let pending: Promise<ComponentType<OnState>> | null = null;
  const loadBridge = () =>
    (pending ??= (
      loadE2EAuthBridge
        ? loadE2EAuthBridge().then((E2EAuthBridge) => {
            function E2EBridge(props: OnState) {
              return <E2EAuthBridge sessionKey={e2eSessionKey} {...props} />;
            }
            return E2EBridge;
          })
        : loadAccountsBridge()
    ).catch((err: unknown) => {
      pending = null;
      throw err;
    }));

  function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState(DEFERRED_AUTH_DEFAULT);
    const pathname = usePathname();
    const workbenchRoute = pathname?.startsWith(WORKBENCH_ROUTE) === true;
    // The hint says signed in (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site doesn't
    // answer", "The editors"): until the session answers, the page waits for it rather than settling as a guest, whose
    // hand-off would leave for an accounts site that isn't answering. The prerender has no cookies and reads none.
    const [hinted] = useState(() => typeof document !== 'undefined' && readSignedInHint());
    const waiting = hinted && !authState.authLoaded;
    const [stalled, setStalled] = useState(false);
    useEffect(() => {
      if (!waiting || workbenchRoute) return;
      const id = window.setTimeout(() => setStalled(true), ACCOUNT_STALL_MS);
      return () => window.clearTimeout(id);
    }, [waiting, workbenchRoute]);
    const unreachable = waiting && (stalled || authState.accountUnreachable === true);
    const value = useMemo(
      () =>
        workbenchRoute
          ? DEFERRED_AUTH_PENDING
          : waiting
            ? { ...authState, sessionExpected: true, accountUnreachable: unreachable }
            : authState,
      [workbenchRoute, waiting, unreachable, authState],
    );
    // Asked for as the provider first renders, as a lazy component's code would be.
    const [Bridge, setBridge] = useState<ComponentType<OnState> | null>(() => {
      if (!workbenchRoute) loadBridge().catch(() => {});
      return null;
    });
    useEffect(() => {
      if (workbenchRoute || Bridge) return;
      let live = true;
      loadBridge().then(
        (component) => {
          if (live) setBridge(() => component);
        },
        (err: unknown) => {
          // Thrown where the bridge draws, as a lazy component's failed load is, so the app's error boundary and its
          // stale-build recovery see it.
          if (live)
            setBridge(() => () => {
              throw err;
            });
        },
      );
      return () => {
        live = false;
      };
    }, [workbenchRoute, Bridge]);
    return (
      <DeferredAuthContext.Provider value={value}>
        {children}
        {unreachable && !workbenchRoute ? (
          <Suspense fallback={null}>
            <AccountUnreachableNotice />
          </Suspense>
        ) : null}
        {workbenchRoute || !Bridge ? null : <Bridge onState={setAuthState} />}
      </DeferredAuthContext.Provider>
    );
  }

  return AuthProvider;
}
