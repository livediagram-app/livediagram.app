'use client';

// Deferred auth for the whole app tree (docs/specs/014-identity/auth-and-guest-access.md: auth is purely
// additive; docs/specs/002-project-scope/open-source-and-business-model.md: Clerk is optional). This provider no longer
// imports @clerk/react — the ~96 kB library used to ride EVERY
// route's first load, including embeds and Clerk-less self-hosts.
// Instead the children render immediately under DeferredAuthContext's
// "not settled" defaults, and a lazily-loaded bridge (ClerkBridge, an
// async chunk) mounts the real Clerk provider around a publisher that
// pushes the distilled auth state into the context. Auth state
// "pops in" once clerk-js resolves — which is exactly how it already
// behaved, since clerk-js itself loads from CDN asynchronously.
//
// The auth pages (/sign-in, /get-started, /sso-callback) wrap
// themselves in StaticClerkProvider instead; Clerk is the page there.

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { clerkBundled, clerkEnabled, clerkPublishableKey, e2eAuthEnabled } from '@/lib/clerk-config';
import { useSelfHostAuth } from '@/lib/self-host-auth';
import { DEFERRED_AUTH_DEFAULT, DEFERRED_AUTH_PENDING, DeferredAuthContext } from './deferred-auth';

// Test builds only (see e2eAuthEnabled): never part of a real bundle.
const LazyE2EAuthBridge = e2eAuthEnabled
  ? dynamic(() => import('./E2EAuthBridge').then((m) => m.E2EAuthBridge), {
      ssr: false,
      loading: () => null,
    })
  : null;

// Only in builds that HAVE Clerk. This used to load unconditionally, which put
// Clerk's ~96 kB into every route's chunk graph — including on a self-hosted
// deployment that has no Clerk at all and can never render the bridge
// (docs/specs/002-project-scope/open-source-and-business-model.md: Clerk is optional). The
// flag is a compile-time constant, so a Clerk-less build drops the import.
const LazyClerkBridge = clerkBundled
  ? dynamic(() => import('./ClerkBridge').then((m) => m.ClerkBridge), {
      ssr: false,
      loading: () => null,
    })
  : null;

// A self-hosted deployment's own provider (docs/specs/016-platform/self-hosted-runtime.md):
// the same contract as ClerkBridge, with no Clerk behind it. Which deployments have
// one is asked at runtime (lib/self-host-auth.ts) rather than read from a build flag —
// NEXT_PUBLIC_* does not survive into this app's client bundle.
const LazySelfHostAuthBridge = dynamic(
  () => import('./SelfHostAuthBridge').then((m) => m.SelfHostAuthBridge),
  { ssr: false, loading: () => null },
);

// The auth pages wrap themselves in StaticClerkProvider (Clerk IS the page
// there), so the bridge must STAND DOWN on those routes — mounting a second
// real Clerk provider under the layout threw @clerk/react's "multiple
// ClerkProvider components" and crashed the page right after signing in
// (the reported MCP-OAuth sign-in "client-side exception").
const STATIC_CLERK_ROUTES = ['/sign-in', '/get-started', '/sso-callback'];

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench") is signed in by its workbench session, never by Clerk or the e2e bridge: both stand down
// there and the state holds DEFERRED_AUTH_PENDING, so nothing above the page reads as a settled guest,
// Clerk configured or not. WorkbenchAuthBridge publishes the session to the editor beneath.
export const WORKBENCH_ROUTE = '/embed/workbench';

export function ClerkProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState(DEFERRED_AUTH_DEFAULT);
  const pathname = usePathname();
  const selfHosted = useSelfHostAuth();
  const staticClerkRoute = STATIC_CLERK_ROUTES.some((r) => pathname?.startsWith(r));
  const workbenchRoute = pathname?.startsWith(WORKBENCH_ROUTE) === true;
  const configured = clerkEnabled && !!clerkPublishableKey && !staticClerkRoute && !workbenchRoute;
  // While the bridge stands down, nothing publishes, so the last state it
  // published would outlive it. Signing in by email code returns to the app
  // with a SOFT navigation (router.push), keeping this provider mounted: the
  // editor then booted on a stale "settled guest" state, skipped the wait for
  // the guest-data migration, loaded the document under the new account before
  // it owned it, and showed a 404 that a refresh cleared. Resetting here makes
  // every return from an auth page start "not settled", like a fresh load.
  if (staticClerkRoute && authState !== DEFERRED_AUTH_DEFAULT) {
    setAuthState(DEFERRED_AUTH_DEFAULT);
  }
  return (
    <DeferredAuthContext.Provider value={workbenchRoute ? DEFERRED_AUTH_PENDING : authState}>
      {children}
      {configured && LazyClerkBridge ? <LazyClerkBridge onState={setAuthState} /> : null}
      {LazyE2EAuthBridge && !staticClerkRoute && !workbenchRoute ? (
        <LazyE2EAuthBridge onState={setAuthState} />
      ) : null}
      {selfHosted && !staticClerkRoute && !workbenchRoute ? (
        <LazySelfHostAuthBridge onState={setAuthState} />
      ) : null}
    </DeferredAuthContext.Provider>
  );
}
