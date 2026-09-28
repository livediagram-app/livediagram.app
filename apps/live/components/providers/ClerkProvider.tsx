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
import { clerkEnabled, clerkPublishableKey } from '@/lib/clerk-config';
import { DEFERRED_AUTH_DEFAULT, DeferredAuthContext } from './deferred-auth';

const LazyClerkBridge = dynamic(() => import('./ClerkBridge').then((m) => m.ClerkBridge), {
  ssr: false,
  loading: () => null,
});

// The auth pages wrap themselves in StaticClerkProvider (Clerk IS the page
// there), so the bridge must STAND DOWN on those routes — mounting a second
// real Clerk provider under the layout threw @clerk/react's "multiple
// ClerkProvider components" and crashed the page right after signing in
// (the reported MCP-OAuth sign-in "client-side exception").
const STATIC_CLERK_ROUTES = ['/sign-in', '/get-started', '/sso-callback'];

export function ClerkProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState(DEFERRED_AUTH_DEFAULT);
  const pathname = usePathname();
  const staticClerkRoute = STATIC_CLERK_ROUTES.some((r) => pathname?.startsWith(r));
  const configured = clerkEnabled && !!clerkPublishableKey && !staticClerkRoute;
  // While the bridge stands down, nothing publishes, so the last state it
  // published would outlive it. Signing in by email code returns to the app
  // with a SOFT navigation (router.push), keeping this provider mounted: the
  // editor then booted on a stale "settled guest" state, skipped the wait for
  // the guest-data migration, loaded the diagram under the new account before
  // it owned it, and showed a 404 that a refresh cleared. Resetting here makes
  // every return from an auth page start "not settled", like a fresh load.
  if (staticClerkRoute && authState !== DEFERRED_AUTH_DEFAULT) {
    setAuthState(DEFERRED_AUTH_DEFAULT);
  }
  return (
    <DeferredAuthContext.Provider value={authState}>
      {children}
      {configured ? <LazyClerkBridge onState={setAuthState} /> : null}
    </DeferredAuthContext.Provider>
  );
}
