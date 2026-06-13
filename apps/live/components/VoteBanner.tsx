'use client';

import { votesSpentBy, type TabVote } from '@livediagram/diagram';
import { TopCenterBanner } from './TopCenter';

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
    <TopCenterBanner tone="brand" className="gap-2 px-3 py-1 text-[11px] font-medium">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-brand-500" />
      {message}
    </TopCenterBanner>
  );
}
