import { isVotable, type BoxedElement, type TabVote } from '@livediagram/diagram';
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
  voteReviewActive,
  isVoteFocus,
  zoom,
  onRetractVote,
}: {
  element: BoxedElement;
  vote: TabVote | null | undefined;
  selfId: string | null | undefined;
  voteMax: number | null | undefined;
  // Vote-results walkthrough (spec/39): while it runs, the static winner
  // rings yield to ONE pulsing focus on the currently-reviewed element,
  // so attention lands on a single pick at a time.
  voteReviewActive?: boolean;
  isVoteFocus?: boolean;
  zoom: number;
  onRetractVote?: (elementId: string) => void;
}) {
  // Dot-vote tally for this element: total dots, how many are mine
  // (clicking the pill retracts one), and whether it is a revealed
  // winner. The pill only shows once at least one dot has landed.
  const voteTotal = vote ? (vote.votes[element.id]?.length ?? 0) : 0;
  const myVotes =
    vote && selfId ? (vote.votes[element.id]?.filter((id) => id === selfId).length ?? 0) : 0;
  const showVotePill = !!vote && voteTotal > 0 && isVotable(element);
  const isVoteWinner = !!vote?.revealed && voteTotal > 0 && voteTotal === (voteMax ?? 0);
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
      {showVotePill ? (
        <div
          className="absolute -bottom-1 -right-1 origin-bottom-right"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <Tooltip
            title={`${voteTotal} ${voteTotal === 1 ? 'vote' : 'votes'}`}
            description={myVotes > 0 ? 'Click to remove one of your dots.' : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (myVotes > 0) onRetractVote?.(element.id);
              }}
              aria-label={`${voteTotal} votes`}
              className={
                'pointer-events-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold shadow-sm ' +
                (myVotes > 0
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100')
              }
            >
              {voteTotal}
            </button>
          </Tooltip>
        </div>
      ) : null}
    </>
  );
}
