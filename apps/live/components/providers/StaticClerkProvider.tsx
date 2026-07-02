'use client';

// The classic tree-wrapping Clerk provider, for the AUTH PAGES only
// (/sign-in, /get-started, /sso-callback) — Clerk IS the page there,
// so a static import is correct and those routes' bundles carry it.
// Everywhere else the app consumes DeferredAuthContext instead (see
// deferred-auth.tsx / ClerkBridge.tsx), which keeps @clerk/react out
// of the editor / explorer / embed first load.
//
// Uses `@clerk/react`'s framework-agnostic provider instead of
// `@clerk/nextjs`'s — the Next.js variant pulls Server Actions into
// the build, and `output: 'export'` rejects that.

import { ClerkProvider as Clerk } from '@clerk/react';
import type { ReactNode } from 'react';
import { clerkEnabled, clerkPublishableKey } from '@/lib/clerk-config';

export function StaticClerkProvider({ children }: { children: ReactNode }) {
  if (!clerkEnabled || !clerkPublishableKey) {
    // Pass-through (self-host without Clerk, spec/03 + spec/04): the
    // auth pages themselves gate on `clerkEnabled` and render their
    // "auth is disabled here" state.
    return <>{children}</>;
  }
  return (
    <Clerk
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in/"
      signUpUrl="/get-started/"
      afterSignOutUrl="/"
    >
      {children}
    </Clerk>
  );
}
