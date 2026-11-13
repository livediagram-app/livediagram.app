'use client';

// Deferred auth for the whole app tree (docs/specs/014-identity/auth-and-guest-access.md: auth is purely additive).
// The children render at once under DeferredAuthContext's "not settled" defaults, and a lazily-loaded bridge
// (the editor's AccountsBridge, an async chunk) asks the api for the session and pushes the distilled auth state into
// the context. Auth state "pops in" once that one request answers.
//
// Signing in leaves the app for the accounts site on a full-page visit and comes back on another, so no state from
// before signing in survives into the signed-in page. Each editor makes the provider once, in its
// components/providers/AuthProvider.tsx, which also binds the workbench and holds the `next/dynamic` loads of its
// bridges.

import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import {
  DEFERRED_AUTH_DEFAULT,
  DEFERRED_AUTH_PENDING,
  DeferredAuthContext,
  type DeferredAuthState,
} from './deferred-auth';

type OnState = { onState: (state: DeferredAuthState) => void };

export type AuthProviderDeps = {
  // The e2e stand-in for the accounts bridge, in test builds only (e2eAuthEnabled); null in every real bundle.
  E2EAuthBridge: ComponentType<OnState & { sessionKey: string }> | null;
  AccountsBridge: ComponentType<OnState>;
  // The sessionStorage key the e2e bridge reads the test's session from (the editor's E2E_SESSION_KEY).
  e2eSessionKey: string;
};

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed
// in by its workbench session, never by the accounts session or the e2e bridge: both stand down there and the state
// holds DEFERRED_AUTH_PENDING, so nothing above the page reads as a settled guest. WorkbenchAuthBridge publishes the
// session to the editor beneath.
const WORKBENCH_ROUTE = '/embed/workbench';

/** The app's deferred-auth provider, made once per editor at module scope. */
export function createAuthProvider({ E2EAuthBridge, AccountsBridge, e2eSessionKey }: AuthProviderDeps) {
  function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState(DEFERRED_AUTH_DEFAULT);
    const pathname = usePathname();
    const workbenchRoute = pathname?.startsWith(WORKBENCH_ROUTE) === true;
    return (
      <DeferredAuthContext.Provider value={workbenchRoute ? DEFERRED_AUTH_PENDING : authState}>
        {children}
        {workbenchRoute ? null : E2EAuthBridge ? (
          <E2EAuthBridge sessionKey={e2eSessionKey} onState={setAuthState} />
        ) : (
          <AccountsBridge onState={setAuthState} />
        )}
      </DeferredAuthContext.Provider>
    );
  }

  return AuthProvider;
}
