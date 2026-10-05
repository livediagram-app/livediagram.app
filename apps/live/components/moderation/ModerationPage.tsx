'use client';

import { Brand, Button } from '@livediagram/ui';
import { Body, Heading, LandingCard, PrimaryLink } from '@/components/chrome/LandingCard';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { COMMUNITY_HOME_PATH } from '@/lib/community-links';
import { ModerationItemCard } from './ModerationItemCard';
import { useModerationQueue } from './useModerationQueue';

const MODERATION_PATH = '/moderation';

// The operators' Moderation page (docs/specs/025-community/community.md "Reports and moderation";
// blueprint §5 "Editor"): reported and hidden Community posts with their reports, and Hide / Restore.
// Signed in only; whether the person is an operator is the api's answer (403 otherwise), never
// decided here.
export function ModerationPage() {
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const signedIn = authLoaded && isSignedIn && !!clerkUserId;
  const queue = useModerationQueue(signedIn ? (clerkUserId ?? null) : null);

  if (authLoaded && !isSignedIn) {
    return (
      <LandingCard>
        <Heading>Sign in to moderate</Heading>
        <Body>Moderating the Community needs an operator account.</Body>
        <PrimaryLink href={authHrefWithReturn('/sign-in/', MODERATION_PATH)}>Sign In</PrimaryLink>
      </LandingCard>
    );
  }

  if (queue.status === 'forbidden') {
    return (
      <LandingCard>
        <Heading>Moderation</Heading>
        <Body>Only operators can moderate Community.</Body>
        <PrimaryLink href={COMMUNITY_HOME_PATH}>Back to Community</PrimaryLink>
      </LandingCard>
    );
  }

  const hiddenCount = queue.items.filter((it) => it.state === 'hidden').length;

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <Brand size="sm" />
        <a
          href={COMMUNITY_HOME_PATH}
          className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Community
        </a>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Moderation</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reported and hidden Community posts. Restoring a post clears its reports.
            {queue.status === 'ready' && queue.items.length > 0
              ? ` ${queue.items.length} to review, ${hiddenCount} hidden.`
              : ''}
          </p>
        </div>

        {queue.status === 'loading' ? (
          <ul aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
            {[0, 1, 2].map((n) => (
              <li
                key={n}
                className="h-40 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800"
              />
            ))}
          </ul>
        ) : null}

        {queue.status === 'error' ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We couldn&rsquo;t load the moderation queue.
            </p>
            <Button size="xs" onClick={queue.reload}>
              Try Again
            </Button>
          </div>
        ) : null}

        {queue.status === 'ready' && queue.items.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nothing to review. No post has been reported or hidden.
          </p>
        ) : null}

        {queue.status === 'ready' && queue.items.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {queue.items.map((item) => (
              <ModerationItemCard key={item.id} item={item} onModerate={queue.moderate} />
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
