'use client';

// The live VOTE panel (docs/specs/012-collaboration/session-tools.md): the facilitator's read on a dot-vote in
// progress, a popover over the Session strip's Vote button on the same shared MovablePanel as Poll /
// Collaborate / Layers. Two phases, one panel:
//
//   Casting open  -> TURNOUT. How many dots are spent and how many people
//                    still hold some, so the host knows when to call it
//                    instead of guessing from the pills on the canvas.
//   Results shown -> the RANKED LIST. Every voted element, most dots
//                    first, each row clickable to jump the results
//                    walkthrough straight to that element.
//
// Like the poll panel it only exists while a vote does.
//
// On naming: rows are NOT attributed to people, and can't be. Dots are
// keyed by the local participant id while the room's presence roster is
// keyed by a server-random per-connection id (docs/specs/015-api/public-api-and-tokens.md §6) — the two never
// match, so the client has no way to turn a voter into a name. That is a
// happy accident for a dot-vote, and the turnout numbers below answer the
// question the host actually has ("is everyone done?") without it.

import { itemIdOfVoteKey, votesSpentBy, type Element, type TabVote } from '@livediagram/document';
import { itemTitle } from '@livediagram/items';
import { usePlan } from '@/components/plan/PlanContext';
import { describeOne } from '@/lib/element-names';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { DockAnchor } from '@/lib/canvas-chrome';
import type { VoteReview } from '@/hooks/canvas/useVoteReview';
import { voteRules } from '@/components/panels/session-studio/session-studio';
import { buttonClassName } from '@livediagram/ui';

// A popover never moves.
const NO_MOVE = () => {};

// The shared Button look (its hover and dark-mode states included), sized to the panel.
const primaryBtn = buttonClassName({ variant: 'primary', size: 'xs', className: 'flex-1' });
const quietBtn = buttonClassName({ variant: 'secondary', size: 'xs', className: 'flex-1' });

export function VotePanel({
  vote,
  elements,
  participantCount,
  results,
  reviewIndex,
  onJumpToResult,
  onEndVote,
  onRevealVote,
  onClearVote,
  isHost,
  selfId,
  voteLayers = [],
  review,
  onNextResult,
  onPrevResult,
  onDoneReview,
  popoverAnchor,
  onPopoverClose,
  readOnly,
  dismissOnOutside = true,
}: {
  vote: TabVote;
  // The active tab's elements, only to resolve a voted id to a label.
  elements: Element[];
  // Everyone in the room right now (remote presence + you). The
  // denominator for turnout; 1 on a solo document.
  participantCount: number;
  // The ranked results from useVoteReview — the SAME array the
  // walkthrough steps through, so the list and Previous / Next can never
  // disagree about the order.
  results: { id: string; votes: number }[];
  // Which rank the walkthrough is on, for the active-row highlight.
  reviewIndex: number | null;
  onJumpToResult: (index: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  // Only the participant who STARTED this vote drives it (docs/specs/012-collaboration/session-tools.md): end,
  // reveal, clear, and moving the results focus. Everyone else follows.
  isHost: boolean;
  // View-role visitors watch the vote but never drive it (docs/specs/012-collaboration/session-tools.md).
  readOnly: boolean;
  // Who the vote knows us by (the collab key), for our own dots left while casting is open.
  selfId: string;
  // The tab's layers, to name a layer-scoped vote's layer in its rules.
  voteLayers?: readonly { id: string; name: string }[];
  // The results walkthrough, while it runs (docs/specs/012-collaboration/session-tools.md): the pick
  // under review and, for whoever drives it, Previous / Next / Done. It lives here rather than in a
  // banner over the canvas.
  review: VoteReview | null;
  onNextResult: () => void;
  onPrevResult: () => void;
  onDoneReview: () => void;
  // Where the Vote button sits, for the popover's arrow, and how it asks to close.
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
  // False while the activity runs on a desktop: only the button closes it
  // (docs/specs/012-collaboration/session-tools.md "The Session strip").
  dismissOnOutside?: boolean;
}) {
  const showResults = vote.revealed;

  return (
    <MovablePanel
      helpArticle="sessionVoting"
      title="Vote"
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={NO_MOVE}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-72"
      dismissOnOutside={dismissOnOutside}
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2 px-2 pb-2">
        {/* What used to float over the canvas as the vote banner: your dots left while casting is
            open, then the walkthrough of the results. */}
        {vote.active && !readOnly ? <YourDots vote={vote} selfId={selfId} /> : null}
        {review ? (
          <ReviewBar
            review={review}
            onNext={onNextResult}
            onPrev={onPrevResult}
            onDone={onDoneReview}
          />
        ) : null}
        {/* The rules this vote runs under (budget, one per item, layer, the privacy in force), so
            nobody has to ask; read-only, since they are fixed once the vote starts. */}
        <ul className="flex flex-wrap gap-1" aria-label="Vote rules">
          {voteRules(vote, voteLayers).map((r) => (
            <li
              key={r}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {r}
            </li>
          ))}
        </ul>
        {showResults ? (
          <VoteResultsList
            results={results}
            elements={elements}
            reviewIndex={reviewIndex}
            onJumpToResult={onJumpToResult}
            canControl={isHost}
          />
        ) : (
          <VoteTurnout vote={vote} participantCount={participantCount} />
        )}

        {/* The vote's controls belong to whoever started it. A follower
            gets the readout only — not disabled buttons, which would just
            advertise something they can't do. */}
        {readOnly || !isHost ? (
          <p className="text-[10px] leading-snug text-slate-400">
            {vote.revealed
              ? 'The host is walking through the results.'
              : 'Only the person who started this vote, or the facilitator, can end it.'}
          </p>
        ) : (
          <div className="flex items-center gap-1">
            {vote.active ? (
              <button type="button" onClick={onEndVote} className={primaryBtn}>
                End vote
              </button>
            ) : !vote.revealed ? (
              <>
                <button type="button" onClick={onRevealVote} className={primaryBtn}>
                  Show results
                </button>
                <button type="button" onClick={onClearVote} className={quietBtn}>
                  Clear
                </button>
              </>
            ) : (
              // Results are up: Clear is how the host puts the canvas back
              // (same effect as Done at the end of the walkthrough, but
              // reachable at any point in it).
              <button type="button" onClick={onClearVote} className={quietBtn}>
                Clear vote
              </button>
            )}
          </div>
        )}
      </div>
    </MovablePanel>
  );
}

// Your own budget while casting is open: the dots you have left, as pips and a count, so the one
// number each participant needs is the first thing in the panel.
function YourDots({ vote, selfId }: { vote: TabVote; selfId: string }) {
  const budget = vote.votesPerPerson;
  const remaining = Math.max(0, budget - votesSpentBy(vote, selfId));
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-brand-50 px-2 py-1.5 dark:bg-brand-500/15">
      <span className="text-[11px] font-medium text-brand-700 dark:text-brand-100">
        {remaining} of {budget} {budget === 1 ? 'dot' : 'dots'} left
      </span>
      <span className="flex flex-wrap items-center gap-0.5" aria-hidden>
        {Array.from({ length: budget }, (_, d) => (
          <span
            key={d}
            className={
              'h-2 w-2 rounded-full ' +
              (d < remaining ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-500/30')
            }
          />
        ))}
      </span>
    </div>
  );
}

// The results walkthrough: the pick the room is on (pulsed and centred on the canvas), and for
// whoever drives it the way through. Followers get the readout alone, never buttons that no-op.
function ReviewBar({
  review,
  onNext,
  onPrev,
  onDone,
}: {
  review: VoteReview;
  onNext: () => void;
  onPrev: () => void;
  onDone: () => void;
}) {
  const isLast = review.index === review.total - 1;
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-500/10">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
        <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
        Top result {review.index + 1} of {review.total} &middot; {review.votes}{' '}
        {review.votes === 1 ? 'vote' : 'votes'}
      </span>
      {review.canControl ? (
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrev} disabled={review.index === 0} className={quietBtn}>
            Previous
          </button>
          {isLast ? (
            <button type="button" onClick={onDone} className={primaryBtn}>
              Done
            </button>
          ) : (
            <button type="button" onClick={onNext} className={primaryBtn}>
              Next
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Casting-open view: how far through the room the vote is. Deliberately
// counts PEOPLE, not dots alone — "8 of 12 dots" reads as nearly done when
// one person holds all four remaining, which is exactly the case where you
// shouldn't end the vote yet.
function VoteTurnout({ vote, participantCount }: { vote: TabVote; participantCount: number }) {
  const budget = vote.votesPerPerson;
  // Dots per voter, for everyone who has cast at least one. Voters who
  // haven't started aren't in `vote.votes` at all, which is why the room
  // size has to come from presence rather than from the vote.
  const voterIds = new Set<string>();
  for (const ids of Object.values(vote.votes)) for (const id of ids) voterIds.add(id);
  const spends = [...voterIds].map((id) => votesSpentBy(vote, id)).sort((a, b) => b - a);
  const started = spends.length;
  const finished = spends.filter((n) => n >= budget).length;
  // Someone in the room who hasn't cast a single dot yet. Clamped: a
  // participant can leave mid-vote leaving more voters than people.
  const notStarted = Math.max(0, participantCount - started);
  const dotsCast = spends.reduce((a, b) => a + b, 0);
  const dotsTotal = Math.max(participantCount, started) * budget;

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-slate-700 dark:text-slate-200">
            {finished} of {Math.max(participantCount, started)} finished
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {dotsCast}/{dotsTotal}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
            style={{ width: `${dotsTotal > 0 ? (dotsCast / dotsTotal) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* One row per voter: dots spent as filled pips, dots left hollow.
          Unlabelled by necessity (see the file header) — the shape of the
          column is the signal: all-filled rows are done, part-filled rows
          are who you're waiting on. */}
      {spends.length > 0 ? (
        <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
          {spends.map((spent, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-0.5">
                {Array.from({ length: budget }, (_, d) => (
                  <span
                    key={d}
                    aria-hidden
                    className={
                      'h-2 w-2 rounded-full ' +
                      (d < spent ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700')
                    }
                  />
                ))}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-400">
                {budget - spent} left
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[10px] leading-snug text-slate-400 dark:text-slate-400">
        {notStarted > 0
          ? `${notStarted} ${notStarted === 1 ? 'person hasn’t' : 'people haven’t'} voted yet`
          : started === 0
            ? 'No dots cast yet'
            : 'Everyone here has voted'}
      </p>
    </>
  );
}

// Revealed view: the ranked picks, each row jumping the walkthrough to
// that element. Replaces hunting for the ringed shapes on a big canvas.
function VoteResultsList({
  results,
  elements,
  reviewIndex,
  onJumpToResult,
  canControl,
}: {
  results: { id: string; votes: number }[];
  elements: Element[];
  reviewIndex: number | null;
  onJumpToResult: (index: number) => void;
  // Rows are only clickable for the host — the walkthrough focus is
  // shared, so a follower clicking a row would move the whole room.
  canControl: boolean;
}) {
  // The document's cards, to name a Plan card's row.
  const plan = usePlan();
  if (results.length === 0) {
    return (
      <p className="text-[11px] italic text-slate-400 dark:text-slate-400">
        No dots were cast on this tab.
      </p>
    );
  }
  const top = results[0]!.votes;
  return (
    <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
      {results.map((row, i) => {
        // A Plan card's key names the card ("#12 Ship it"); an element's, the element.
        const itemId = itemIdOfVoteKey(row.id);
        const card = itemId ? plan?.items.get(itemId) : undefined;
        const el = itemId ? undefined : elements.find((e) => e.id === row.id);
        const label = card
          ? `#${card.key} ${itemTitle(card) || 'Untitled'}`
          : itemId
            ? 'Card'
            : el
              ? describeOne(el).replace(/^'|'$/g, '')
              : 'Element';
        const active = reviewIndex === i;
        // Joint winners all read as winners, matching the amber rings on
        // the canvas (voteMax, not "index 0").
        const isWinner = row.votes === top;
        return (
          <li key={row.id}>
            <button
              type="button"
              disabled={!canControl}
              onClick={() => onJumpToResult(i)}
              className={
                'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition ' +
                (active
                  ? 'bg-brand-50 dark:bg-brand-500/15'
                  : canControl
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'cursor-default')
              }
            >
              <span
                className={
                  'w-3 shrink-0 text-[10px] font-semibold tabular-nums ' +
                  (isWinner ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400')
                }
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700 dark:text-slate-200">
                {label}
              </span>
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {row.votes}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
