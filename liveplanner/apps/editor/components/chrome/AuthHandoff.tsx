'use client';

// The sign-in and sign-up pages (docs/specs/014-identity/auth-and-guest-access.md "Routes"). Both
// hand the visitor to the liveworkspace accounts site, which signs in new and returning people
// alike with an emailed code, and brings them back to where they were going. The page only shows
// itself when the hand-off came back with a problem.

import { buttonClassName, ButtonContent } from '@liveplanner/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import {
  AuthCard,
  RedirectingCard,
  accountsSignInUrl,
  guestReturnHref,
  resolvePostAuthDestination,
} from './auth-shared';

// What /api/auth/callback says when it sends the browser back here.
const PROBLEMS: Record<string, string> = {
  expired: 'That sign-in had expired, or was started in another tab. Please try again.',
  failed: 'Signing in did not finish. Please try again.',
};

type HandoffProps = { defaultDestination: string; signUp?: boolean };

function Handoff({ defaultDestination, signUp = false }: HandoffProps) {
  const searchParams = useSearchParams();
  const destination = resolvePostAuthDestination(searchParams, defaultDestination);
  const problem = PROBLEMS[searchParams.get('error') ?? ''] ?? null;
  const to = accountsSignInUrl(destination, signUp);

  useEffect(() => {
    // replace, so Back from the accounts site skips this interstitial.
    if (!problem) window.location.replace(to);
  }, [problem, to]);

  if (!problem) return <RedirectingCard />;
  return (
    <AuthCard
      title={signUp ? 'Create your account' : 'Sign in'}
      error={problem}
      guestHref={guestReturnHref(searchParams)}
    >
      <a href={to} className={buttonClassName({ size: 'md', className: 'w-full shadow-sm' })}>
        <ButtonContent>Try again</ButtonContent>
      </a>
    </AuthCard>
  );
}

export function AuthHandoff({ defaultDestination, signUp }: HandoffProps) {
  return (
    <Suspense fallback={<RedirectingCard />}>
      <Handoff defaultDestination={defaultDestination} signUp={signUp} />
    </Suspense>
  );
}
