'use client';

// OAuth round-trip handler. Clerk redirects here after the social
// provider; the AuthenticateWithRedirectCallback component completes
// the flow and bounces to the editor. Mirrors MT's
// apps/dashboard/app/sso-callback/page.tsx with livepages fallback
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
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  AuthCard,
  AuthDisabledNotice,
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  ssoCallbackDestination,
} from '@/components/chrome/auth-shared';
import { DiagramBuildAnimation } from '@livepages/ui';
import { clerkEnabled } from '@/lib/clerk-config';

// The sign-in / get-started pages forward their `?redirect_url` onto this
// page's URL (ssoCallbackUrl), so a round-trip Clerk finishes HERE still
// returns to it, whichever way it ends: a Google sign-in for an unknown
// account becomes a sign-up, and would otherwise land on /new (issue #612,
// an MCP consent lost mid-connect). Forced, so only the validated value is
// used; without one the per-flow defaults apply.
function SSOCallbackContent() {
  const destination = ssoCallbackDestination(useSearchParams());
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={destination}
      signUpForceRedirectUrl={destination}
      signInFallbackRedirectUrl={POST_AUTH_SIGNIN_DEFAULT}
      signUpFallbackRedirectUrl={POST_AUTH_DEFAULT}
    />
  );
}

function SSOCallbackPageInner() {
  if (!clerkEnabled) return <AuthDisabledNotice />;
  return (
    <AuthCard title="Signing you in" subtitle="Completing sign in…" error="" pitch={false}>
      <DiagramBuildAnimation />
      <Suspense fallback={null}>
        <SSOCallbackContent />
      </Suspense>
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
