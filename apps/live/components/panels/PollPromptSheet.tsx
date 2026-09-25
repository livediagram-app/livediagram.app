'use client';

// The poll prompt every participant sees when a host starts one (spec/88).
// Shown to view-role visitors too — polling an audience on a view link is the
// main use for this.
//
// A SHEET rising from the bottom edge, not a modal. It used to be a centred
// Dialog with a backdrop, which stopped the room dead: a poll is a question
// asked DURING the work, and the thing people most often want while answering
// "which of these?" is to look at the thing being asked about. A modal put a
// scrim over exactly that. Now the canvas stays live behind it — you can pan,
// point, read the board, and answer without dismissing anything.
//
// Consequences of not blocking, all deliberate:
//   - No focus trap and no autofocus. Focus stays wherever the person was
//     working; stealing it would be the modal's rudeness without the modal.
//   - Escape still skips, because the keyboard escape from a prompt should not
//     depend on whether it happens to be modal.
//   - There is still no close button. Skip IS the escape, and it is a real
//     answer (counted separately in the results) rather than a silent dodge.

import { useEffect, useState } from 'react';
import { POLL_TEXT_ANSWER_MAX, pollOptionTokens, type LivePoll } from '@livediagram/api-schema';
import { Portal } from '@/components/primitives/Portal';
import { anyModalOpen } from '@/lib/modal-guard';

export function PollPromptSheet({
  poll,
  onAnswer,
}: {
  poll: LivePoll | null;
  // `null` is a skip.
  onAnswer: (value: string | null) => void;
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!poll) return;
    const onKey = (e: KeyboardEvent) => {
      // Not while they are typing an answer — Escape there should be the
      // browser's own "get me out of this field", not an accidental skip.
      if (e.key !== 'Escape') return;
      // The sheet isn't modal, so this Escape may belong to the work behind
      // it: cancelling a label edit, the format painter, a pending draw, a
      // deselect, or a dialog opened over the canvas. Those handlers claim
      // the key with preventDefault; skipping the poll as well answered it by
      // accident. Listener order isn't ours to rely on (the format painter's
      // Escape listener attaches when the mode starts, possibly after this
      // one), so the decision waits until the whole dispatch has run.
      if (anyModalOpen()) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
        return;
      timer = window.setTimeout(() => {
        if (!e.defaultPrevented) onAnswer(null);
      }, 0);
    };
    let timer: number | undefined;
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [poll, onAnswer]);

  if (!poll) return null;
  const tokens = pollOptionTokens(poll);

  return (
    <Portal>
      <div
        role="dialog"
        aria-label="Poll"
        aria-modal={false}
        // Bottom-centred, full-bleed on a phone and a card on a desktop.
        // `inset-x-0` + `mx-auto` rather than a left-1/2 translate, because the
        // sheet-up animation owns `transform` and a positioning transform would
        // fight it (see the note by the animation tokens in globals.css).
        //
        // Above the toast layer: a poll is the one interruption that is waiting
        // on the person, so nothing should sit over it. The inline safe-area
        // padding below keeps it clear of an iOS home indicator.
        //
        // That padding is an inline style rather than an arbitrary Tailwind
        // class on purpose, and this comment names no class either: Tailwind's
        // scanner reads whole FILES, comments included, so writing a
        // class-shaped string here is enough to make it compile one. Spelling
        // the safe-area utility out in prose generated a rule whose value was
        // the literal ellipsis, and the stylesheet failed to parse.
        className="animate-sheet-up fixed inset-x-0 bottom-0 z-[calc(var(--z-toast,60)+1)] mx-auto w-full max-w-lg overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900 sm:mb-3 sm:rounded-2xl sm:border-b"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* A grab-handle bar. Purely a signal: it says "sheet" in the one
            glance before anybody reads a word, which is what tells people the
            canvas behind is still theirs. */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

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
      </div>
    </Portal>
  );
}
