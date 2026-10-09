'use client';

// /get-started. Which provider signs people in is asked at RUNTIME
// (lib/self-host-auth.ts): a self-hosted deployment serves its own identity provider at
// /api/auth/*, a hosted one has Clerk. The build flag cannot answer it — NEXT_PUBLIC_*
// does not reach this app's client bundle — so the page waits a moment, then renders
// the provider the deployment actually has.
//
// Clerk's half lives in its own module (./clerk-sign-up) so the two cannot drift and a
// self-hosted deployment never mounts Clerk's provider.

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { RedirectingCard } from '@/components/chrome/auth-shared';
import { SelfHostSignInForm } from '@/components/chrome/SelfHostSignInForm';
import { useSelfHostAuth } from '@/lib/self-host-auth';

const ClerkSignUp = dynamic(() => import('./clerk-sign-up').then((m) => m.ClerkSignUp), {
  ssr: false,
  loading: () => <RedirectingCard />,
});

export default function GetStartedPage() {
  const selfHosted = useSelfHostAuth();
  // Still asking. Rendering either provider now would be a guess, and the wrong guess
  // is a sign-in page that cannot work.
  if (selfHosted === null) return <RedirectingCard />;
  if (selfHosted) {
    return (
      <Suspense fallback={<RedirectingCard />}>
        <SelfHostSignInForm mode="sign-up" />
      </Suspense>
    );
  }
  return <ClerkSignUp />;
}
