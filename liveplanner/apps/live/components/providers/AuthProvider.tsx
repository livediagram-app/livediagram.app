'use client';

// Deferred auth for the whole app tree (docs/specs/014-identity/auth-and-guest-access.md: auth is purely
// additive; docs/specs/002-project-scope/business-model-and-licence.md: sign-in is optional). The
// children render at once under DeferredAuthContext's "not settled" defaults, and a lazily-loaded
// bridge (AccountsBridge, an async chunk) asks the api for the session and pushes the distilled
// auth state into the context. Auth state "pops in" once that one request answers.
//
// Signing in leaves the app for the accounts site on a full-page visit and comes back on another,
// so no state from before signing in survives into the signed-in page.

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { e2eAuthEnabled, signInEnabled } from '@/lib/auth-config';
import { DEFERRED_AUTH_DEFAULT, DEFERRED_AUTH_PENDING, DeferredAuthContext } from './deferred-auth';

// Test builds only (see e2eAuthEnabled): never part of a real bundle. It stands in for the accounts
// bridge, so a test build with sign-in on shows every sign-in surface while the test picks the session.
const LazyE2EAuthBridge = e2eAuthEnabled
  ? dynamic(() => import('./E2EAuthBridge').then((m) => m.E2EAuthBridge), {
      ssr: false,
      loading: () => null,
    })
  : null;

const LazyAccountsBridge = dynamic(() => import('./AccountsBridge').then((m) => m.AccountsBridge), {
  ssr: false,
  loading: () => null,
});

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench") is signed in by its workbench session, never by the accounts session or the e2e bridge:
// both stand down there and the state holds DEFERRED_AUTH_PENDING, so nothing above the page reads as
// a settled guest, sign-in configured or not. WorkbenchAuthBridge publishes the session to the editor
// beneath.
const WORKBENCH_ROUTE = '/embed/workbench';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState(DEFERRED_AUTH_DEFAULT);
  const pathname = usePathname();
  const workbenchRoute = pathname?.startsWith(WORKBENCH_ROUTE) === true;
  return (
    <DeferredAuthContext.Provider value={workbenchRoute ? DEFERRED_AUTH_PENDING : authState}>
      {children}
      {workbenchRoute ? null : LazyE2EAuthBridge ? (
        <LazyE2EAuthBridge onState={setAuthState} />
      ) : signInEnabled ? (
        <LazyAccountsBridge onState={setAuthState} />
      ) : null}
    </DeferredAuthContext.Provider>
  );
}
