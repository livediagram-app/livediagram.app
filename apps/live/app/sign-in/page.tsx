'use client';

// /sign-in. Which provider signs people in is asked at RUNTIME
// (lib/self-host-auth.ts): a self-hosted deployment serves its own identity provider at
// /api/auth/*, a hosted one has Clerk. The build flag cannot answer it — NEXT_PUBLIC_*
// does not reach this app's client bundle — so the page waits a moment, then renders
// the provider the deployment actually has.
//
// Clerk's half lives in its own module (./clerk-sign-in) so the two cannot drift and a
// self-hosted deployment never mounts Clerk's provider.

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { RedirectingCard } from '@/components/chrome/auth-shared';
import { SelfHostSignInForm } from '@/components/chrome/SelfHostSignInForm';
import { useSelfHostAuth } from '@/lib/self-host-auth';

const ClerkSignIn = dynamic(() => import('./clerk-sign-in').then((m) => m.ClerkSignIn), {
  ssr: false,
  loading: () => <RedirectingCard />,
});

export default function SignInPage() {
  const selfHosted = useSelfHostAuth();
  // Still asking. Rendering either provider now would be a guess, and the wrong guess
  // is a sign-in page that cannot work.
  if (selfHosted === null) return <RedirectingCard />;
  if (selfHosted) {
    return (
      <Suspense fallback={<RedirectingCard />}>
        <SelfHostSignInForm mode="sign-in" />
      </Suspense>
    );
  }
  return <ClerkSignIn />;
}
