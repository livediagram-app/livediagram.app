'use client';

// Deferred auth for the whole app tree (spec/04: auth is purely
// additive; spec/03: Clerk is optional). This provider no longer
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
  return (
    <DeferredAuthContext.Provider value={authState}>
      {children}
      {configured ? <LazyClerkBridge onState={setAuthState} /> : null}
    </DeferredAuthContext.Provider>
  );
}
