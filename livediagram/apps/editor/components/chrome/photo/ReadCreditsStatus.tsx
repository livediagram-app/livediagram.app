'use client';

// What a photo read's AI credits say on the review (docs/specs/021-event-storming/note-reader.md "What the editor
// shows"). Counted: the quiet "Uses 2 AI credits" (the count the api spent), with what is left for the diagram's owner or the owning team.
// Used: the month's credits are gone and the photo is read on this device, with the right way on for whoever is
// looking: the owner or a team admin is offered the upgrade, a team's member is pointed at an admin, and everyone
// else is told the credits are used and nothing more. The kit's notice decides the action.
import { useState } from 'react';
import { isOwnerScope, photoReadCredits } from '@liveworkspace/subscription';
import {
  LimitNotice,
  ownerViewOf,
  upgradeTier,
  useOwnerView,
} from '@liveworkspace/subscription-ui';
import { readRun, type ReadCreditsState } from '@/lib/reading/read-credits';
import {
  CREDITS_USED_PLAIN,
  creditsLeftWords,
  creditsOffer,
  creditsUsedTitle,
  creditsUsedWords,
  readCreditLine,
} from '@/lib/reading/read-credits-words';
import { Pill } from './PhotoStatus';

export function ReadCreditsStatus({
  credits,
  reading,
}: {
  credits: ReadCreditsState;
  // The photo's words are still being read.
  reading: boolean;
}) {
  const load = useOwnerView(isOwnerScope(credits.owner) ? credits.owner : null);
  // The clock as the status first drew: the day the credits come back.
  const [now] = useState(() => Date.now());
  const view = ownerViewOf(load);
  // The payer, or someone on the paying team: the count is theirs to see.
  const theirs = view !== null && view.action !== 'none';
  const { spent, count } = credits;
  if (spent) {
    // The words wait for who is looking, so they never change under the reader from the plain ones to the owner's.
    if (load.status === 'loading') return null;
    return (
      <div
        data-testid="photo-credits-used"
        data-read-credits={view?.action ?? 'none'}
        // A solid ground under the notice's tint: it sits over a photograph.
        className="pointer-events-auto w-[min(32rem,calc(100vw-1.5rem))] rounded-lg bg-white shadow-lg dark:bg-slate-900"
      >
        <LimitNotice
          limitKey="aiCreditsPerMonth"
          used={spent.used}
          limit={spent.max}
          owner={theirs ? view : null}
          title={theirs ? creditsUsedTitle(spent.max) : undefined}
          sentence={theirs ? creditsUsedWords(now) : CREDITS_USED_PLAIN}
          offer={
            view?.action === 'upgrade' && view.tier === 'free'
              ? creditsOffer(upgradeTier(view))
              : undefined
          }
          near={false}
        />
      </div>
    );
  }
  return (
    <Pill testId="photo-credits">
      <span className="shrink-0 whitespace-nowrap">
        {readCreditLine(reading, credits.cost ?? photoReadCredits(readRun().notes))}
      </span>
      {theirs && count ? (
        <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-300">
          · {creditsLeftWords(count.used, count.max)}
        </span>
      ) : null}
    </Pill>
  );
}
