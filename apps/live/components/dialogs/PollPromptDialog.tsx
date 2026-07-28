'use client';

// The poll prompt every participant sees when a host starts one (spec/88).
// Shown to view-role visitors too — polling an audience on a view link is
// the main use for this. Answering or skipping both dismiss it and unlock
// the results panel.
//
// There is no close button: Skip IS the escape, and it's a real answer
// (counted separately in the results) rather than a silent dodge.

import { useState } from 'react';
import { POLL_TEXT_ANSWER_MAX, pollOptionTokens, type LivePoll } from '@livediagram/api-schema';
import { Dialog } from '@/components/dialogs/Dialog';

export function PollPromptDialog({
  poll,
  onAnswer,
}: {
  poll: LivePoll | null;
  // `null` is a skip.
  onAnswer: (value: string | null) => void;
}) {
  const [text, setText] = useState('');
  if (!poll) return null;
  const tokens = pollOptionTokens(poll);

  return (
    <Dialog
      open
      // Skip on Escape / backdrop: dismissing the prompt is answering
      // "no opinion", never a silent drop that leaves the host waiting.
      onClose={() => onAnswer(null)}
      ariaLabel="Poll"
      size="sm"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            Quick poll
          </span>
          <h2 className="text-base font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {poll.question}
          </h2>
        </div>

        {poll.style === 'text' ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, POLL_TEXT_ANSWER_MAX))}
              rows={3}
              autoFocus
              aria-label="Your answer"
              placeholder="Your answer"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <span className="self-end text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {text.length}/{POLL_TEXT_ANSWER_MAX}
            </span>
            <button
              type="button"
              disabled={text.trim().length === 0}
              onClick={() => onAnswer(text.trim())}
              className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send answer
            </button>
          </div>
        ) : (
          <div
            className={
              poll.style === 'rating'
                ? 'grid grid-cols-5 gap-1.5'
                : 'flex flex-col gap-1.5 sm:flex-row sm:flex-wrap'
            }
          >
            {tokens.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => onAnswer(token)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
              >
                {token}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            Answers aren&apos;t shown against names.
          </span>
          <button
            type="button"
            onClick={() => onAnswer(null)}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Skip
          </button>
        </div>
      </div>
    </Dialog>
  );
}
