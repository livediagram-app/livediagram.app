'use client';

// OAuth round-trip handler. Clerk redirects here after the social
// provider; the AuthenticateWithRedirectCallback component completes
// the flow and bounces to the editor. Mirrors MT's
// apps/dashboard/app/sso-callback/page.tsx with livediagram fallback
// destinations.
//
// When Clerk isn't enabled on this deployment (no publishable key),
// nobody can land here legitimately — they'd have come from a Clerk
// OAuth round-trip that the disabled provider would have refused to
// start in the first place. Render the "not enabled" notice so a
// stale link or a bookmarked URL gets a clear, branded fallback
// instead of crashing inside the Clerk component.

// Import from @clerk/react (framework-agnostic) so the static export
// build doesn't pull in @clerk/nextjs's Server Actions — see
// components/providers/ClerkProvider.tsx for the same rationale.
import { StaticClerkProvider } from '@/components/providers/StaticClerkProvider';
import { AuthenticateWithRedirectCallback } from '@clerk/react';
import { AuthCard, AuthDisabledNotice } from '@/components/chrome/auth-shared';
import { DiagramBuildAnimation } from '@/components/canvas/DiagramBuildAnimation';
import { clerkEnabled } from '@/lib/clerk-config';

function SSOCallbackPageInner() {
  if (!clerkEnabled) return <AuthDisabledNotice />;
  return (
    <AuthCard subtitle="Completing sign in…" error="">
      <DiagramBuildAnimation />
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/explorer/recent"
        signUpFallbackRedirectUrl="/new"
      />
    </AuthCard>
  );
}

// The layout's ClerkProvider is now the DEFERRED one (no Clerk context
// in the app tree — see components/providers/ClerkProvider.tsx), but
// this page's hooks need the real thing, and Clerk IS this page — so
// it wraps itself in the static provider and carries the library in
// its own route bundle.
export default function SSOCallbackPage() {
  return (
    <StaticClerkProvider>
      <SSOCallbackPageInner />
    </StaticClerkProvider>
  );
}
