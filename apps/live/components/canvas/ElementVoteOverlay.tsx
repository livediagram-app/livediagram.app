import {
  voteHidesTallies,
  votesSpentBy,
  type BoxedElement,
  type TabVote,
} from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';

// The dot-vote overlay (spec/39), lifted out of BoxedElementView: the
// tally pill on the element's bottom-right corner — live count,
// brand-filled when it holds your dots (click to retract one) — and the
// amber winner ring shown once the vote is revealed. Renders nothing
// until at least one dot has landed on this element.
export function ElementVoteOverlay({
  element,
  vote,
  selfId,
  voteMax,
  votableInVote,
  voteReviewActive,
  isVoteFocus,
  zoom,
  onRetractVote,
  onCastVote,
}: {
  element: BoxedElement;
  vote: TabVote | null | undefined;
  selfId: string | null | undefined;
  voteMax: number | null | undefined;
  // Kind rule AND the vote's layer scope (spec/96), resolved upstream.
  votableInVote?: boolean;
  // Vote-results walkthrough (spec/39): while it runs, the static winner
  // rings yield to ONE pulsing focus on the currently-reviewed element,
  // so attention lands on a single pick at a time.
  voteReviewActive?: boolean;
  isVoteFocus?: boolean;
  zoom: number;
  onRetractVote?: (elementId: string) => void;
  onCastVote?: (elementId: string) => void;
}) {
  // Dot-vote tally for this element: total dots, how many are mine, and
  // whether it is a revealed winner.
  const myVotes =
    vote && selfId ? (vote.votes[element.id]?.filter((id) => id === selfId).length ?? 0) : 0;
  // Vote privacy (spec/39): with "hide running counts" on, the pill counts
  // only YOUR dots until the results are revealed — so you can still see
  // and retract what you spent, but a climbing total can't snowball the
  // room. "Show results" swaps every pill back to the true tally.
  const tallyHidden = voteHidesTallies(vote);
  const voteTotal = tallyHidden ? myVotes : vote ? (vote.votes[element.id]?.length ?? 0) : 0;
  const isVoteWinner = !!vote?.revealed && voteTotal > 0 && voteTotal === (voteMax ?? 0);
  // While casting is OPEN, every votable element carries a stepper —
  // minus, the count, plus — showing 0 when nothing has landed yet. The
  // count alone used to appear only once an element had a dot, which made
  // the first dot on a board an act of faith: nothing on screen said an
  // element was a target or how to add to it.
  const showStepper = !!vote && vote.active && votableInVote === true;
  // Once casting closes the buttons go: the tally is a result to read, not
  // a control, and the walkthrough wants the board quiet.
  const showReadOnlyCount = !!vote && !vote.active && voteTotal > 0 && votableInVote === true;
  // Budget (spec/39). Spent-out disables plus rather than hiding it, so
  // the control doesn't move under the pointer mid-vote.
  const spent = vote && selfId ? votesSpentBy(vote, selfId) : 0;
  const canCast = !!vote && spent < vote.votesPerPerson;
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
        <div
          // Sits INSIDE the element's bottom-right rather than hanging off
          // the corner: the stepper is a control you aim at, so it wants
          // clearance from the edge (and from a neighbour's stepper on a
          // tightly packed board).
          // Semi-transparent at rest, fully opaque on hover. On a small box
          // the stepper covers the label, and during a vote the label is the
          // whole point — you're choosing between them, so you have to be
          // able to read them. Hovering the ELEMENT (not the stepper, which
          // is a small target) brings it up solid to click.
          //
          // Gated on a real hover pointer: on touch there is no hover to
          // restore it with, so a permanently faded control would be worse
          // than an occluding one. `pointer-fine` covers both conditions —
          // a coarse pointer keeps the plain opaque stepper.
          className="lvd-vote-stepper absolute bottom-1.5 right-1.5 origin-bottom-right transition-opacity"
          style={{ transform: `scale(${1 / zoom})` }}
          // The stepper sits ON the element, whose own press casts a dot
          // too (spec/39). Without this a click meant for minus would
          // bubble into that and immediately re-add what it removed.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={
              'pointer-events-auto flex items-center gap-1 rounded-full border p-1 shadow-sm ' +
              (myVotes > 0
                ? 'border-brand-300 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/20'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900')
            }
          >
            <VoteStepButton
              label={`Remove a dot from ${element.label ?? 'this element'}`}
              disabled={myVotes === 0}
              onClick={() => onRetractVote?.(element.id)}
            >
              &minus;
            </VoteStepButton>
            <span
              className={
                'min-w-[18px] text-center text-[13px] font-semibold tabular-nums ' +
                (myVotes > 0
                  ? 'text-brand-700 dark:text-brand-100'
                  : 'text-slate-600 dark:text-slate-300')
              }
              aria-label={tallyHidden ? `Your ${voteTotal} dots` : `${voteTotal} votes`}
            >
              {voteTotal}
            </span>
            <VoteStepButton
              label={`Add a dot to ${element.label ?? 'this element'}`}
              disabled={!canCast}
              onClick={() => onCastVote?.(element.id)}
            >
              +
            </VoteStepButton>
          </div>
        </div>
      ) : null}
      {showReadOnlyCount ? (
        <div
          className="absolute bottom-1.5 right-1.5 origin-bottom-right"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <Tooltip
            title={
              tallyHidden
                ? `Your ${voteTotal} ${voteTotal === 1 ? 'dot' : 'dots'}`
                : `${voteTotal} ${voteTotal === 1 ? 'vote' : 'votes'}`
            }
            description={
              tallyHidden ? 'Totals stay hidden until the results are shown.' : undefined
            }
          >
            <span
              aria-label={tallyHidden ? `Your ${voteTotal} dots` : `${voteTotal} votes`}
              className={
                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold shadow-sm ' +
                (myVotes > 0
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100')
              }
            >
              {voteTotal}
            </span>
          </Tooltip>
        </div>
      ) : null}
    </>
  );
}

// One end of the vote stepper. Small, square, and disabled rather than
// hidden at its limit so the row's width — and so the plus's position —
// never shifts under the pointer mid-vote.
function VoteStepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-semibold leading-none text-slate-600 transition enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:enabled:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}
