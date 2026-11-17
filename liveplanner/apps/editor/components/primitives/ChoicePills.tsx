'use client';

// A row of choices as pills (Publish as Roadmap's Tab and Board, Subscribe to Calendar's Card Types): each a button
// with an optional glyph, pressed when chosen; one shape in every dialog so a choice looks the same everywhere.
import type { ReactNode } from 'react';

const PILL =
  'inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-micro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-60';
const ON =
  'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100';
const OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800';

export type ChoicePill = { id: string; label: string; icon?: ReactNode; aside?: ReactNode };

export function ChoicePills({
  label,
  pills,
  pressed,
  disabled = false,
  onPick,
  data,
}: {
  // The group's accessible name.
  label: string;
  pills: readonly ChoicePill[];
  pressed: (id: string) => boolean;
  disabled?: boolean;
  onPick: (id: string) => void;
  // Its data attribute's value, for tests and the browser checks.
  data?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-choice-pills={data}
      className="flex flex-wrap gap-1.5"
    >
      {pills.map((p) => {
        const on = pressed(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onPick(p.id)}
            className={`${PILL} ${on ? ON : OFF}`}
          >
            {p.icon ? <span className="flex shrink-0">{p.icon}</span> : null}
            <span className="truncate">{p.label}</span>
            {p.aside}
          </button>
        );
      })}
    </div>
  );
}
