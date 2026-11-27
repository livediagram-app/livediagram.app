'use client';

// Pick one of a few on a phone (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page", Work Tracker 1516):
// a bottom sheet (the shared Dialog's phone sheet, so it traps focus, closes on Escape, a tap outside or a swipe down)
// with its name, then one full-width row per choice, the current one ticked. A pick slides the sheet away, then runs.

import { useId, type ReactNode } from 'react';
import { Dialog, useDialogDismiss } from '@liveworkspace/ui';
import { CheckIcon } from './icons';

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Before the label (an app's logo), hidden from a screen reader: the label names it. */
  logo?: ReactNode;
};

export function ChoiceSheet<T extends string>({
  open,
  title,
  choices,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  choices: readonly Choice<T>[];
  value: T;
  onPick: (next: T) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} initialFocus="container">
      <ChoiceRows
        titleId={titleId}
        title={title}
        choices={choices}
        value={value}
        onPick={onPick}
        onClose={onClose}
      />
    </Dialog>
  );
}

// Inside the Dialog, so a pick closes through its dismiss (the sheet slides out first).
function ChoiceRows<T extends string>({
  titleId,
  title,
  choices,
  value,
  onPick,
  onClose,
}: {
  titleId: string;
  title: string;
  choices: readonly Choice<T>[];
  value: T;
  onPick: (next: T) => void;
  onClose: () => void;
}) {
  const dismiss = useDialogDismiss();
  return (
    <div className="flex flex-col pb-2">
      <h2
        id={titleId}
        className="m-0 px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pt-3 dark:text-slate-400"
      >
        {title}
      </h2>
      <div role="radiogroup" aria-labelledby={titleId} className="flex flex-col">
        {choices.map((c) => {
          const on = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              data-choice={c.value}
              onClick={() =>
                dismiss(() => {
                  onClose();
                  if (!on) onPick(c.value);
                })
              }
              className={`flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] outline-none transition hover:bg-slate-50 focus-visible:bg-slate-100 active:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 dark:active:bg-slate-800 ${
                on
                  ? 'font-semibold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-700 dark:text-slate-200'
              }`}
            >
              {c.logo ? (
                <span aria-hidden className="inline-flex shrink-0">
                  {c.logo}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="flex w-5 shrink-0 justify-center text-brand-600 dark:text-brand-300">
                {on ? <CheckIcon size={16} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
