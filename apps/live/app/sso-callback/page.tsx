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
import { AuthenticateWithRedirectCallback } from '@clerk/react';
import { AuthDisabledNotice } from '@/components/auth-shared';
import { clerkEnabled } from '@/lib/clerk-config';

export default function SSOCallbackPage() {
  if (!clerkEnabled) return <AuthDisabledNotice />;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-lg shadow-slate-900/10">
        <p className="text-sm text-slate-600">Completing sign in…</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
