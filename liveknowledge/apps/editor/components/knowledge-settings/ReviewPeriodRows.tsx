'use client';

// The Review Period's five choices (docs/specs/030-knowledgebase/verification.md "The Review Period"): bordered
// rows, one chosen, as a radio group: arrows move between them, Space or Enter picks. The chosen row carries a
// tick as well as its colour, so it never rests on hue alone. `asked` is a shorter period waiting for its
// confirmation: marked as the one being considered, while `value` stays chosen until it is applied.
import { useRef, type KeyboardEvent } from 'react';
import type { ReviewEvery } from '@liveknowledge/knowledge';
import { REVIEW_PERIOD_OPTIONS } from '@/lib/knowledge-settings/review-period-words';

const ROW =
  'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 text-left text-sm font-medium motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60';
const CHOSEN =
  'border-brand-600 bg-brand-50 text-slate-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-slate-100';
const ASKED =
  'border-amber-500 bg-amber-50 text-slate-900 dark:border-amber-400 dark:bg-amber-500/10 dark:text-slate-100';
const REST =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500';

function Mark({ chosen }: { chosen: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        chosen
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
          : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ReviewPeriodRows({
  value,
  asked,
  labelledBy,
  describedBy,
  disabled = false,
  onPick,
}: {
  value: ReviewEvery;
  asked: ReviewEvery | null;
  labelledBy: string;
  describedBy: string;
  disabled?: boolean;
  onPick: (every: ReviewEvery) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  // The roving stop: the row being considered, else the chosen one.
  const stop = asked ?? value;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const rows = [...(group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    const at = rows.findIndex((row) => row === document.activeElement);
    rows[(Math.max(at, 0) + step + rows.length) % rows.length]?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2"
      data-review-period={String(value)}
    >
      {REVIEW_PERIOD_OPTIONS.map((option) => {
        const chosen = option.value === value;
        const considering = option.value === asked;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={option.value === stop ? 0 : -1}
            disabled={disabled}
            data-period={String(option.value)}
            onClick={() => onPick(option.value)}
            className={`${ROW} ${chosen ? CHOSEN : considering ? ASKED : REST}`}
          >
            <Mark chosen={chosen} />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
