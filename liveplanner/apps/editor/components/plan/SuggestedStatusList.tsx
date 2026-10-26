'use client';

// Suggested statuses (docs/specs/026-plan/plan-board.md "Suggested statuses"): the common statuses offered where a
// board's columns are chosen and the project has none to offer, one to a row, each added with one press, with Add
// All for two or more. Shared by Setup Board's Columns step (Suggested States, in the board's colours) and the
// column picker (Suggested Statuses, in the menu's).
import { useId } from 'react';
import { PlusIcon } from '@liveplanner/ui';
import type { SuggestedStatus } from '@liveplanner/items';
import { HEADING } from './ExistingStatusList';
import { OptionRows } from './OptionRows';
import type { PlanPalette } from './plan-palette';

const SETUP_HEADING = 'text-[11px] font-semibold uppercase tracking-wider';
const ADD_ALL =
  'inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none dark:text-brand-300 dark:hover:bg-brand-500/10';

export function SuggestedStatusList({
  heading,
  suggestions,
  palette,
  disabled = false,
  onPick,
  onPickAll,
}: {
  // "Suggested States" (Setup Board) or "Suggested Statuses" (the picker): the heading and the list's name.
  heading: string;
  suggestions: readonly SuggestedStatus[];
  // The board's colours (Setup Board); the menu's without.
  palette?: PlanPalette | undefined;
  // At the column limit: nothing more can be added.
  disabled?: boolean;
  onPick: (name: string) => void;
  onPickAll: (names: string[]) => void;
}) {
  const id = useId();
  if (!suggestions.length) return null;
  return (
    <div className="flex flex-col gap-1.5" data-suggested-statuses="">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p
          id={`${id}-label`}
          className={palette ? SETUP_HEADING : HEADING}
          style={palette ? { color: palette.muted } : undefined}
        >
          {heading}
        </p>
        {suggestions.length > 1 ? (
          <button
            type="button"
            className={ADD_ALL}
            disabled={disabled}
            onClick={() => onPickAll(suggestions.map((s) => s.name))}
          >
            <PlusIcon size={12} />
            Add All
          </button>
        ) : null}
      </div>
      <OptionRows
        kind="action"
        label={heading}
        {...(palette ? { palette } : {})}
        rows={suggestions.map((s) => ({
          id: s.name,
          label: s.name,
          ariaLabel: `Add ${s.name}`,
          disabled,
          detail: s.hint,
          icon: palette ? (
            <PlusIcon size={12} style={{ color: palette.muted }} />
          ) : (
            <PlusIcon size={12} className="text-slate-400" />
          ),
        }))}
        onPick={onPick}
      />
    </div>
  );
}
