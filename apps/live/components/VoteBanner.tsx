'use client';

import { votesSpentBy, type TabVote } from '@livediagram/diagram';

// Floating dot-voting status banner (spec/39). While a vote is open it
// tells each participant how many of their dots remain; once ended it
// reads as closed, and once results are revealed it points at the
// element badges. Sits just under the timer pill. The facilitator's
// start / end / show-results / clear controls live in Tab Settings; this
// is purely the live participant-facing status.
export function VoteBanner({ vote, selfId }: { vote: TabVote; selfId: string }) {
  const remaining = Math.max(0, vote.votesPerPerson - votesSpentBy(vote, selfId));

  const message = vote.active
    ? `Voting open — ${remaining} of ${vote.votesPerPerson} ${vote.votesPerPerson === 1 ? 'dot' : 'dots'} left. Click a shape, sticky, or image to vote.`
    : vote.revealed
      ? 'Results revealed — top picks are ringed.'
      : 'Voting ended.';

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-30 flex -translate-x-1/2 animate-fade-in items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-800 shadow-md dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-brand-500" />
      {message}
    </div>
  );
}
