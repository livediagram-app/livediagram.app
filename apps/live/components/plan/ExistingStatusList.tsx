'use client';

// The column picker's Existing Statuses (docs/specs/026-plan/plan-board.md "The column picker"): a listbox of the
// statuses the document has that this board lacks, each a row with its colour swatch, its name, the boards that use
// it and how many of its cards this board would show. Driven from the picker's field (a combobox): the field keeps
// focus and the highlighted row is its active descendant, so arrows move through the rows, Enter adds the
// highlighted one, and a press on a row adds it.
import { useEffect } from 'react';
import { PlusIcon } from '@livediagram/ui';
import type { MissingStatus } from '@livediagram/items';

export const HEADING =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

// The id of row `index` in the listbox `listId`.
export const optionId = (listId: string, index: number) => `${listId}-option-${index}`;

// "4 cards", "1 card", "No cards".
export function cardCount(n: number): string {
  return n === 0 ? 'No cards' : n === 1 ? '1 card' : `${n} cards`;
}

// Where a status is used: "On Sprint, Roadmap", else "Not on any board".
export function usedOn(s: Pick<MissingStatus, 'boards'>): string {
  return s.boards.length ? `On ${s.boards.join(', ')}` : 'Not on any board';
}

// A status's swatch: the colour its first board gives its column, or a hollow ring when none does. Shared with Setup
// Board's Existing States.
export function StatusSwatch({ colour }: { colour?: string | undefined }) {
  return (
    <span
      aria-hidden
      className={`block h-2.5 w-2.5 shrink-0 rounded-full ${
        colour ? '' : 'border-[1.5px] border-slate-300 dark:border-slate-600'
      }`}
      style={colour ? { backgroundColor: colour } : undefined}
    />
  );
}

export function ExistingStatusList({
  listId,
  statuses,
  total,
  active,
  query,
  onActive,
  onPick,
  onPickAll,
}: {
  listId: string;
  // The rows shown (narrowed by the field), and how many there are before narrowing.
  statuses: readonly MissingStatus[];
  total: number;
  // The highlighted row, -1 for none.
  active: number;
  // The field's text, for the nothing-matches line.
  query: string;
  onActive: (index: number) => void;
  onPick: (status: MissingStatus) => void;
  // Add All, offered with two or more; absent while the field narrows the rows.
  onPickAll?: (() => void) | undefined;
}) {
  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(listId, active))?.scrollIntoView?.({ block: 'nearest' });
  }, [listId, active]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p id={`${listId}-label`} className={`${HEADING} flex items-center gap-1.5`}>
          Existing Statuses
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {total}
          </span>
        </p>
        {onPickAll ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none dark:text-brand-300 dark:hover:bg-brand-500/10"
            onClick={onPickAll}
          >
            <PlusIcon size={12} />
            Add All
          </button>
        ) : null}
      </div>
      {statuses.length ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${listId}-label`}
          // A bordered box, one status to a row, as Plan's option lists are (plan-board.md "Option lists").
          className="flex max-h-56 flex-col divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
        >
          {statuses.map((s, i) => {
            const on = i === active;
            return (
              <li
                key={s.status}
                id={optionId(listId, i)}
                role="option"
                aria-selected={on}
                data-status={s.status}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors motion-reduce:transition-none ${
                  on
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`}
                // The field keeps focus: a press here must not take it.
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => !on && onActive(i)}
                onClick={() => onPick(s)}
              >
                <StatusSwatch colour={s.colour} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`truncate text-[13px] font-medium ${
                      on
                        ? 'text-brand-800 dark:text-brand-100'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {usedOn(s)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                    s.cards
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-400'
                  }`}
                >
                  {cardCount(s.cards)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-slate-200 px-2 py-2 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No existing status matches “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
