'use client';

// Use `@clerk/react`'s framework-agnostic provider instead of
// `@clerk/nextjs`'s — the Next.js variant pulls Server Actions into
// the build, and `output: 'export'` rejects that (matches MT's
// pattern in apps/dashboard/components/providers/ClerkProvider.tsx).
// The provider's runtime behaviour is identical; only the surrounding
// SSR plumbing differs. Hook consumers (`useAuth`, `useSignIn`, etc.)
// keep importing from `@clerk/nextjs` because those don't trigger
// the Server Actions check.
import { ClerkProvider as Clerk } from '@clerk/react';
import type { ReactNode } from 'react';
import { clerkEnabled, clerkPublishableKey } from '@/lib/clerk-config';

// Wraps the live app with Clerk's React context so `useAuth` /
// `useSignIn` / `useSignUp` work anywhere in the tree. Mirrors
// Manager Toolkit's dashboard/components/providers/ClerkProvider —
// same shape, livediagram routes.
//
// When `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` isn't set (self-host
// without Clerk, per spec/03 + spec/04), the provider becomes a
// no-op pass-through — children render directly. Every Clerk-aware
// module reads the same `clerkEnabled` flag and short-circuits to a
// guest-only path; the api worker independently degrades to guest
// when `CLERK_JWKS_URL` is unset, so the two sides stay in sync.
//
// Hybrid mode (spec/04): even with Clerk enabled, nothing here gates
// the editor — the canvas keeps working as a guest. Auth is purely
// additive: when signed in, the editor sends a Bearer token instead
// of `X-Owner-Id` (wired in `useClerkApiBootstrap`).

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!clerkEnabled || !clerkPublishableKey) {
    // Pass-through. No Clerk context in the tree — every
    // Clerk-aware consumer checks `clerkEnabled` before reaching
    // for a hook so this doesn't crash anything.
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
