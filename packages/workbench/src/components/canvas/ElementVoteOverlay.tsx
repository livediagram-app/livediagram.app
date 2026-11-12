'use client';

import { plural } from '@liveworkspace/model-core/plural';
import {
  canCastVote,
  voteHidesTallies,
  type VoteRulesVote,
} from '@liveworkspace/model-core/vote-rules';
import { HoverCard, SOLID_BRAND_DARK } from '@liveworkspace/ui';
import { CounterScaled, useCanvasZoom } from './CanvasZoomContext';
import { voteBadgeShrinks } from './vote-badge';
import { VoteDot } from './VoteDot';
import { VoteStepper, type VoteKeyShortcuts } from './VoteStepper';

export type { VoteKeyShortcuts };

// The dot-vote overlay (docs/specs/012-collaboration/session-tools.md in livediagram and liveplanner), one copy every
// product's canvas mounts: the tally pill on the element's bottom-right corner (live count, brand-filled when it
// holds your dots) and the amber winner ring shown once the vote is revealed. Renders nothing until the element is
// in a vote. Keyed by a vote key, not an element: an element's own id, or a Plan card's `item:<id>`. A product passes
// in what differs: whether the element has text (a text-only vote's plus needs it) and its vote keys, if any.
export function ElementVoteOverlay({
  voteKey,
  name,
  vote,
  selfId,
  voteMax,
  votableInVote,
  hasText = true,
  keyShortcuts,
  voteReviewActive,
  isVoteFocus,
  box,
  onRetractVote,
  onCastVote,
}: {
  // The key its dots go under in `votes`.
  voteKey: string;
  // What the stepper's buttons call it ("Add a dot to {name}").
  name: string;
  vote: VoteRulesVote | null | undefined;
  selfId: string | null | undefined;
  voteMax: number | null | undefined;
  // Kind rule AND the vote's layer scope (docs/specs/012-collaboration/vote-layer-scope.md), resolved upstream.
  votableInVote?: boolean;
  // Does the element's text have a non-blank character? A text-only vote's plus needs it
  // (docs/specs/012-collaboration/session-tools.md "Only items with text"). Absent = yes.
  hasText?: boolean;
  // The product's vote keys, announced on the stepper's buttons and the badge. Absent, the product has none.
  keyShortcuts?: VoteKeyShortcuts;
  // Vote-results walkthrough (docs/specs/012-collaboration/session-tools.md): while it runs, the static winner
  // rings yield to ONE pulsing focus on the currently-reviewed element,
  // so attention lands on a single pick at a time.
  voteReviewActive?: boolean;
  isVoteFocus?: boolean;
  // The element's size on the canvas, for the stepper's fold to a badge and the badge's shrink to a dot
  // (docs/specs/012-collaboration/session-tools.md "On a small note when zoomed out it folds to a badge").
  // Absent (a Plan card on a board, which never zooms), it never folds.
  box?: { width: number; height: number };
  onRetractVote?: (elementId: string) => void;
  onCastVote?: (elementId: string) => void;
}) {
  // Dot-vote tally for this element: total dots, how many are mine, and
  // whether it is a revealed winner.
  const myVotes =
    vote && selfId ? (vote.votes[voteKey]?.filter((id) => id === selfId).length ?? 0) : 0;
  // Vote privacy (docs/specs/012-collaboration/session-tools.md): with "hide running counts" on, the pill counts
  // only YOUR dots until the results are revealed, so you can still see
  // and retract what you spent, but a climbing total can't snowball the
  // room. "Show results" swaps every pill back to the true tally.
  const tallyHidden = voteHidesTallies(vote);
  const voteTotal = tallyHidden ? myVotes : vote ? (vote.votes[voteKey]?.length ?? 0) : 0;
  const isVoteWinner = !!vote?.revealed && voteTotal > 0 && voteTotal === (voteMax ?? 0);
  // While casting is OPEN, every votable element carries a stepper
  // (minus, the count, plus) showing 0 when nothing has landed yet. The
  // count alone used to appear only once an element had a dot, which made
  // the first dot on a canvas an act of faith: nothing on screen said an
  // element was a target or how to add to it.
  // Only for someone who can cast: a Viewer watches the live counts (docs/specs/012-collaboration/session-tools.md
  // "Roles"), and a stepper whose plus does nothing reads as a broken control.
  const canVote = !!onCastVote;
  const showStepper = !!vote && vote.active && votableInVote === true && canVote;
  // Once casting closes the buttons go: the tally is a result to read, not
  // a control, and the walkthrough wants the canvas quiet.
  const showReadOnlyCount =
    !!vote && (!vote.active || !canVote) && voteTotal > 0 && votableInVote === true;
  // Budget, the one-dot-per-item rule and the text-only rule when the vote has them
  // (docs/specs/012-collaboration/session-tools.md).
  // Either disables plus rather than hiding it, so the control doesn't move
  // under the pointer mid-vote.
  const canCast = !!vote && !!selfId && canCastVote(vote, selfId, voteKey, hasText);
  return (
    <>
      {isVoteFocus ? (
        // The walkthrough's spotlight: a pulsing amber ring + halo.
        <div
          className="lvd-vote-focus pointer-events-none absolute inset-0 ring-2 ring-amber-400"
          style={{ borderRadius: 'inherit' }}
        />
      ) : isVoteWinner && !voteReviewActive ? (
        <div
          className="pointer-events-none absolute inset-0 ring-2 ring-amber-400"
          style={{ borderRadius: 'inherit' }}
        />
      ) : null}
      {showStepper ? (
        <VoteStepper
          box={box}
          voteKey={voteKey}
          name={name}
          myVotes={myVotes}
          voteTotal={voteTotal}
          tallyHidden={tallyHidden}
          canCast={canCast}
          keyShortcuts={keyShortcuts}
          onRetractVote={onRetractVote}
          onCastVote={onCastVote}
        />
      ) : null}
      {showReadOnlyCount ? (
        <ReadOnlyCount
          box={box}
          name={name}
          myVotes={myVotes}
          voteTotal={voteTotal}
          tallyHidden={tallyHidden}
        />
      ) : null}
    </>
  );
}

// The tally once casting closes (or for a Viewer): a result to read. Its own component so only a shown count reads
// the zoom, which shrinks it to the vote dot on an element too small on screen to carry it.
function ReadOnlyCount({
  box,
  name,
  myVotes,
  voteTotal,
  tallyHidden,
}: {
  box: { width: number; height: number } | undefined;
  name: string;
  myVotes: number;
  voteTotal: number;
  tallyHidden: boolean;
}) {
  const shrunk = voteBadgeShrinks(box, useCanvasZoom());
  const countLabel = tallyHidden ? `Your ${plural(voteTotal, 'dot')}` : plural(voteTotal, 'vote');
  if (shrunk) {
    return <VoteDot label={`${countLabel} on ${name}`} myVotes={myVotes} voteTotal={voteTotal} />;
  }
  return (
    <CounterScaled className="absolute bottom-1.5 right-1.5 origin-bottom-right">
      <HoverCard
        title={
          tallyHidden
            ? `Your ${voteTotal} ${voteTotal === 1 ? 'dot' : 'dots'}`
            : `${voteTotal} ${voteTotal === 1 ? 'vote' : 'votes'}`
        }
        description={tallyHidden ? 'Totals stay hidden until the results are shown.' : undefined}
      >
        <span
          role="img"
          aria-label={countLabel}
          className={
            'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold shadow-sm ' +
            (myVotes > 0
              ? `bg-brand-700 text-white ${SOLID_BRAND_DARK}`
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100')
          }
        >
          <span className="text-optical-centre">{voteTotal}</span>
        </span>
      </HoverCard>
    </CounterScaled>
  );
}
