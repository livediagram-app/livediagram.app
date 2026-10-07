'use client';

// The column picker (docs/specs/026-plan/plan-board.md "The column picker"): how every column is added. Chips for
// the statuses the document's other boards use that this board lacks (and Add All), then a field to name a new
// status, which says when the name is one the document already has and uses it rather than a near-duplicate.
// Drawn on an empty board (in the board's colours) and in a column's settings popover (in the menu's).
import { useId, useState } from 'react';
import { Button, PlusIcon } from '@livediagram/ui';
import { COLUMN_NAME_MAX } from './board-setup-edits';
import { matchStatus, missingStatuses, type StatusPick } from './column-status-picks';
import type { PlanBoardSetup } from '@livediagram/items';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const HEADING = 'text-[10px] font-semibold uppercase tracking-wider';

export function AddColumnPicker({
  setup,
  statusNames,
  palette,
  autoFocus = false,
  onPick,
  onPickAll,
  onName,
}: {
  setup: Pick<PlanBoardSetup, 'columns'>;
  statusNames: ReadonlyMap<string, string>;
  // The board's colours on an empty board; absent in the popover, which wears the menu's.
  palette?: PlanPalette;
  autoFocus?: boolean;
  onPick: (pick: StatusPick) => void;
  onPickAll: (picks: StatusPick[]) => void;
  // A new status's name (a name matching an existing status arrives as a pick instead).
  onName: (name: string) => void;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const picks = missingStatuses(setup, statusNames);
  const match = matchStatus(name, setup, statusNames);
  const muted = palette ? { color: palette.muted } : undefined;
  const add = () => {
    if (!name.trim() || match.kind === 'on-board') return;
    if (match.kind === 'existing') onPick(match.pick);
    else onName(name.trim());
    setName('');
  };
  return (
    <div className="flex w-full flex-col gap-3 text-left" onPointerDown={stop} onKeyDown={stop}>
      {picks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p
            className={`${HEADING} ${palette ? '' : 'text-slate-500 dark:text-slate-400'}`}
            style={muted}
          >
            Use an Existing Status
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Existing statuses">
            {picks.map((p) => (
              <button
                key={p.status}
                type="button"
                className={`max-w-full cursor-pointer truncate rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                  palette
                    ? 'hover:brightness-95'
                    : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-500/10'
                }`}
                style={
                  palette
                    ? {
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.card,
                      }
                    : undefined
                }
                onClick={() => onPick(p)}
              >
                {p.name}
              </button>
            ))}
            {picks.length >= 2 ? (
              <button
                type="button"
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                  palette
                    ? 'hover:underline'
                    : 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10'
                }`}
                style={palette ? { color: palette.focus } : undefined}
                onClick={() => onPickAll(picks)}
              >
                <PlusIcon size={12} />
                Add All
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${id}-name`}
          className={`${HEADING} ${palette ? '' : 'text-slate-500 dark:text-slate-400'}`}
          style={muted}
        >
          {picks.length > 0 ? 'Or Name a New Status' : 'Name a New Status'}
        </label>
        <div className="flex w-full gap-2">
          <input
            id={`${id}-name`}
            aria-label="New column name"
            aria-describedby={match.kind === 'new' ? undefined : `${id}-match`}
            placeholder="To do"
            maxLength={COLUMN_NAME_MAX}
            value={name}
            autoFocus={autoFocus}
            className={`h-9 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-[13px] outline-none focus:ring-2 ${
              palette
                ? ''
                : 'border-slate-200 text-slate-800 focus:ring-brand-400 dark:border-slate-700 dark:text-slate-100'
            }`}
            style={
              palette
                ? {
                    borderColor: palette.border,
                    color: palette.text,
                    ['--tw-ring-color' as string]: palette.focus,
                  }
                : undefined
            }
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button
            disabled={!name.trim() || match.kind === 'on-board'}
            onClick={add}
            className="h-9 shrink-0 gap-1 px-3 text-[13px] font-semibold"
          >
            <PlusIcon size={14} />
            Add Column
          </Button>
        </div>
        {match.kind === 'existing' ? (
          <p id={`${id}-match`} role="status" className="text-[12px]" style={muted}>
            Uses the existing {match.pick.name} status
          </p>
        ) : match.kind === 'on-board' ? (
          <p
            id={`${id}-match`}
            role="status"
            className="text-[12px] text-rose-600 dark:text-rose-400"
          >
            This board already has {match.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
