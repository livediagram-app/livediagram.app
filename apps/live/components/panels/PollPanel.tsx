'use client';

// The live POLL panel (docs/specs/012-collaboration/live-poll.md): results for a running poll, a popover
// over the Session strip's Poll button (docs/specs/012-collaboration/session-tools.md "The Session strip"),
// on the same shared MovablePanel as Layers and Collaborate.
//
// It only EXISTS while a poll is running. Shown to the host and to anyone who has responded:
// answering is what buys you the tally, so a participant who hasn't
// answered can't be nudged by the running numbers.
//
// The host gets Keep Results (a chart of the tallies so far, dropped on
// the canvas; the poll keeps running) and End Poll. Everyone else gets a
// local Dismiss, which hides their own panel without ending anything —
// the escape hatch if the host disconnects mid-poll.

import { tallyPoll, type LivePoll, type PollTallyRow } from '@livediagram/api-schema';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { buttonClassName, HoverCard } from '@livediagram/ui';

// A popover never moves.
const NO_MOVE = () => {};

// The shared Button look (its hover and dark-mode states included) at the panel's fixed row height,
// so a wrapped label can't give two rows different heights.
const PRIMARY_BTN = buttonClassName({ variant: 'primary', size: 'xs', className: 'h-7 w-full' });
const QUIET_BTN = buttonClassName({ variant: 'secondary', size: 'xs', className: 'h-7 w-full' });

export function PollPanel({
  poll,
  answers,
  isHost,
  onEnd,
  onKeepResults,
  onDismiss,
  popoverAnchor,
  onPopoverClose,
  dismissOnOutside = true,
}: {
  poll: LivePoll;
  answers: Map<string, string | null>;
  isHost: boolean;
  onEnd: () => void;
  // Drop a chart of the results so far onto the canvas, leaving the poll
  // running (docs/specs/012-collaboration/poll-result-capture.md). Absent on a surface that can't add elements, which
  // leaves the plain End alone.
  onKeepResults?: () => void;
  onDismiss: () => void;
  // Where the Poll button sits, for the popover's arrow, and how it asks to close.
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
  // False while the activity runs on a desktop: only the button closes it
  // (docs/specs/012-collaboration/session-tools.md "The Session strip").
  dismissOnOutside?: boolean;
}) {
  const { rows, textAnswers, answered, skipped } = tallyPoll(poll, answers);

  return (
    <MovablePanel
      helpArticle="sessionPolls"
      title="Poll"
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
        <p className="text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-100">
          {poll.question}
        </p>

        <div className="flex flex-col gap-1.5">
          {poll.style === 'text' ? (
            textAnswers.length === 0 ? (
              <p className="text-[11px] italic text-slate-400">No answers yet.</p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {textAnswers.map((text, i) => (
                  <li
                    key={i}
                    className="rounded-md bg-slate-50 px-2 py-1 text-[11px] leading-snug text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {text}
                  </li>
                ))}
              </ul>
            )
          ) : (
            rows.map((row) => <TallyBar key={row.token} row={row} />)
          )}
        </div>

        <p className="text-[10px] text-slate-400">
          {answered} answered &middot; {skipped} skipped
        </p>

        {/* Two rows, not three side-by-side buttons. Three in a ~230px panel
            wrap to different line counts, and a row of buttons at three
            different heights is the first thing anyone notices. Each row's
            buttons share a fixed height so wrapping can't reintroduce it. */}
        <div className="flex flex-col gap-1">
          {isHost ? (
            <>
              {/* Keeping the result is the LOUD action (docs/specs/012-collaboration/poll-result-capture.md): a poll that
                  leaves no trace is still one press away, but the canvas is the
                  record of the session and the tallies belong on it. So it
                  gets the primary row. It does not end the poll: keep a chart
                  now, keep another later, end when the room is done. */}
              {onKeepResults ? (
                <HoverCard
                  block
                  title="Keep Results"
                  description="Drop a chart of the results so far onto the canvas. The poll keeps running."
                >
                  <button type="button" onClick={onKeepResults} className={PRIMARY_BTN}>
                    Keep Results
                  </button>
                </HoverCard>
              ) : null}
              <HoverCard block title="End Poll" description="End the poll for everyone.">
                <button type="button" onClick={onEnd} className={QUIET_BTN}>
                  End Poll
                </button>
              </HoverCard>
            </>
          ) : (
            <button type="button" onClick={onDismiss} className={QUIET_BTN}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </MovablePanel>
  );
}

// One option's bar. The label and count sit above the track so a long
// choice option wraps instead of squeezing the bar to nothing.
function TallyBar({ row }: { row: PollTallyRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 break-words text-[11px] text-slate-700 dark:text-slate-200">
          {row.token}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {row.count}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
          style={{ width: `${row.share * 100}%` }}
        />
      </div>
    </div>
  );
}
