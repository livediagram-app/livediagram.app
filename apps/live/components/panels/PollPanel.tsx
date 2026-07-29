'use client';

// The live POLL panel (spec/88): results for a running poll, on the same
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
// The host gets Copy results (the only way a poll outlives itself, since
// nothing is stored) and End poll. Everyone else gets a local Dismiss,
// which hides their own panel without ending anything — the escape hatch
// if the host disconnects mid-poll.
//
// It takes no mobile-dock props on purpose: the dock is a row of toggles
// for panels that are always available, and a poll is neither always
// there nor something you go looking for. It shows itself when a poll
// starts and leaves when the poll ends, on every viewport.

import { useState } from 'react';
import {
  formatPollResults,
  tallyPoll,
  type LivePoll,
  type PollTallyRow,
} from '@livediagram/api-schema';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

export function PollPanel({
  poll,
  answers,
  isHost,
  onEnd,
  onDismiss,
  position,
  onMoveTo,
  onReset,
  dock,
  mobileOpenOverride,
  stackBelowY,
}: {
  poll: LivePoll;
  answers: Map<string, string | null>;
  isHost: boolean;
  onEnd: () => void;
  onDismiss: () => void;
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  dock?: MovablePanelDockProps;
  // Dock selection on mobile: this panel is one of the dock's buttons
  // while its session tool is running (spec/07), so it hides unless the
  // dock has it open — like every other docked panel.
  mobileOpenOverride?: boolean;
  // Measured bottom of the Palette, so the panel stacks beneath it in
  // the legacy (non-docking) layout the same way Collaborate / AI do.
  stackBelowY?: number;
}) {
  const [copied, setCopied] = useState(false);
  const { rows, textAnswers, answered, skipped } = tallyPoll(poll, answers);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatPollResults(poll, answers));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied (permissions, insecure context). Nothing to
      // recover — the results stay on screen, which is the fallback.
    }
  };

  return (
    <MovablePanel
      mobileOpenOverride={mobileOpenOverride}
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

        <div className="flex items-center gap-1">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={copy}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
              >
                {copied ? 'Copied' : 'Copy results'}
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="flex-1 rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-600"
              >
                End poll
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
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
