'use client';

// The live POLL panel (docs/specs/012-collaboration/live-poll.md): results for a running poll, on the same
// shared MovablePanel every other floating panel uses (Collaborate,
// Layers, Activity) — draggable, resettable, and dockable into a corner
// stack, rather than a bespoke fixed card of its own.
//
// Unlike its neighbours the panel only EXISTS while a poll is running, so
// it joins and leaves its corner stack (top-right, under the Palette)
// instead of sitting there permanently. Shown to the host and to anyone who has responded:
// answering is what buys you the tally, so a participant who hasn't
// answered can't be nudged by the running numbers.
//
// The host gets Keep Results (a chart of the tallies so far, dropped on
// the canvas; the poll keeps running) and End Poll. Everyone else gets a
// local Dismiss, which hides their own panel without ending anything —
// the escape hatch if the host disconnects mid-poll.
//
// In the dock layout (a phone, or the minimal panel preference on desktop)
// it lives under the dock's Poll button like every other panel, closable
// with it, and opens by itself when a poll starts or when you answer one
// (useOpenDockPanelOnChange), since that is exactly when you want it.

import { tallyPoll, type LivePoll, type PollTallyRow } from '@livediagram/api-schema';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { MovablePanelPlacementProps } from '@/components/primitives/MovablePanel.types';

export function PollPanel({
  poll,
  answers,
  isHost,
  onEnd,
  onKeepResults,
  onDismiss,
  position,
  onMoveTo,
  onReset,
  dock,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
  stackBelowY,
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
  // Measured bottom of the Palette, so the panel stacks beneath it in
  // the legacy (non-docking) layout the same way Collaborate / AI do.
  stackBelowY?: number;
} & MovablePanelPlacementProps) {
  const { rows, textAnswers, answered, skipped } = tallyPoll(poll, answers);

  return (
    <MovablePanel
      helpArticle="sessionPolls"
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      title="Poll"
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      stackBelowY={stackBelowY}
      onMoveTo={onMoveTo}
      onReset={onReset}
      {...dock}
    >
      <div className="flex flex-col gap-2 px-2 pb-2">
        <p className="text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-100">
          {poll.question}
        </p>

        <div className="flex flex-col gap-1.5">
          {poll.style === 'text' ? (
            textAnswers.length === 0 ? (
              <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                No answers yet.
              </p>
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

        <p className="text-[10px] text-slate-400 dark:text-slate-500">
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
                  leaves no trace is still one press away, but the board is the
                  record of the session and the tallies belong on it. So it
                  gets the primary row. It does not end the poll: keep a chart
                  now, keep another later, end when the room is done. */}
              {onKeepResults ? (
                <button
                  type="button"
                  onClick={onKeepResults}
                  title="Drop a chart of the results so far onto the canvas. The poll keeps running."
                  className="flex h-7 w-full items-center justify-center rounded-md bg-brand-500 px-2 text-[11px] font-semibold text-white transition hover:bg-brand-600"
                >
                  Keep Results
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEnd}
                title="End the poll for everyone"
                className="flex h-7 w-full items-center justify-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
              >
                End Poll
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-7 w-full items-center justify-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
            >
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
        <span className="truncate text-[11px] text-slate-700 dark:text-slate-200">{row.token}</span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {row.count}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${row.share * 100}%` }}
        />
      </div>
    </div>
  );
}
