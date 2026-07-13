'use client';

import { votesSpentBy, type TabVote } from '@livediagram/diagram';
import type { VoteReview } from '@/hooks/canvas/useVoteReview';
import { TopCenterBanner } from '@/components/chrome/TopCenter';

// Floating dot-voting status banner (spec/39). While a vote is open it
// tells each participant how many of their dots remain; once ended it
// reads as closed. Once results are revealed it becomes the RESULTS
// WALKTHROUGH bar: the ordered top picks are reviewed one at a time (the
// canvas pulses the current one), with Previous / Next cycling the order
// and Done — offered on the last pick — ending the walkthrough. After
// Done it falls back to the plain revealed message (winner rings). The
// facilitator's start / end / show-results / clear controls live in Tab
// Settings; this is the live participant-facing status.
export function VoteBanner({
  vote,
  selfId,
  review,
  onNext,
  onPrev,
  onDone,
}: {
  vote: TabVote;
  selfId: string;
  review?: VoteReview | null;
  onNext?: () => void;
  onPrev?: () => void;
  onDone?: () => void;
}) {
  if (review) {
    const isLast = review.index === review.total - 1;
    return (
      <TopCenterBanner tone="brand" className="gap-2 px-2 py-1 text-[11px] font-medium">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        <span>
          Top result {review.index + 1} of {review.total} — {review.votes}{' '}
          {review.votes === 1 ? 'vote' : 'votes'}
        </span>
        <span className="flex items-center gap-1">
          <ReviewButton label="Previous" disabled={review.index === 0} onClick={onPrev} />
          {isLast ? (
            <ReviewButton label="Done" emphasis onClick={onDone} />
          ) : (
            <ReviewButton label="Next" emphasis onClick={onNext} />
          )}
        </span>
      </TopCenterBanner>
    );
  }

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

// The walkthrough's small pill buttons: a quiet Previous, a filled
// Next / Done so the forward action reads as primary.
function ReviewButton({
  label,
  onClick,
  disabled,
  emphasis,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'rounded-full px-2 py-0.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ' +
        (emphasis
          ? 'bg-brand-500 text-white hover:bg-brand-600'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700')
      }
    >
      {label}
    </button>
  );
}
