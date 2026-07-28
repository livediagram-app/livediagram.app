'use client';

// Floating live results for a running poll (spec/88). Shown to the host
// and to anyone who has responded — answering is what buys you the tally,
// so a participant who hasn't yet can't be nudged by the running numbers.
//
// The host gets Copy results (the only way a poll outlives itself, since
// nothing is stored) and End poll. Everyone else gets a local Dismiss,
// which hides their own panel without ending anything — the escape hatch
// if the host disconnects mid-poll.

import { useState } from 'react';
import {
  formatPollResults,
  tallyPoll,
  type LivePoll,
  type PollTallyRow,
} from '@livediagram/api-schema';

export function PollPanel({
  poll,
  answers,
  isHost,
  onEnd,
  onDismiss,
}: {
  poll: LivePoll;
  answers: Map<string, string | null>;
  isHost: boolean;
  onEnd: () => void;
  onDismiss: () => void;
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
    <div className="pointer-events-auto fixed bottom-4 left-4 z-30 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          Poll results
        </span>
        <p className="text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-100">
          {poll.question}
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {poll.style === 'text' ? (
          textAnswers.length === 0 ? (
            <p className="text-[11px] italic text-slate-400 dark:text-slate-500">No answers yet.</p>
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

      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        {answered} answered &middot; {skipped} skipped &middot; not shown against names
      </p>

      <div className="mt-2 flex items-center gap-1">
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
