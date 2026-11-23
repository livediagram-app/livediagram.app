'use client';

// The parts an element's Configure dialog is laid out with (each product's docs/specs/008-canvas/
// canvas-and-palette.md "An element's own settings open in a dialog"): a titled group, a one-of-several choice drawn
// as tiles (its picture over its name, the chosen one in the accent), and a labelled field. A dialog has the room a
// menu has not, so nothing in it folds and a choice shows every option at once.
import type { ReactNode } from 'react';

const GROUP_TITLE =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function SettingsGroup({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  // One short line under the title saying what the group changes.
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-settings-group={title} className={`flex flex-col gap-2 ${className}`}>
      <div>
        <h3 className={GROUP_TITLE}>{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

const TILE =
  'flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-[border-color,background-color,color] duration-micro outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-slate-900';
const TILE_OFF =
  'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:text-white';
const TILE_ON =
  'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100';

export type ChoiceTile<T extends string> = { id: T; label: string; icon?: ReactNode };

/** One of several, every option on show: a radio group of tiles. */
export function ChoiceTiles<T extends string>({
  label,
  selected,
  options,
  onPick,
}: {
  // The group's name for a screen reader (its visible title is the SettingsGroup's).
  label: string;
  selected: T;
  options: readonly ChoiceTile<T>[];
  onPick: (id: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.id === selected;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`${TILE} ${on ? TILE_ON : TILE_OFF}`}
            onClick={() => onPick(o.id)}
          >
            {o.icon ? (
              <span aria-hidden className="flex h-5 items-center justify-center">
                {o.icon}
              </span>
            ) : null}
            <span className="max-w-full truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A labelled field on one line: its name at the left, its control at the right. */
export function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}
