'use client';

// A column's settings (docs/specs/025-plan/plan-board.md "The board set-up"): the popover a column's cog
// opens, hanging under the cog. Name, colour, WIP limit and Counts as done; move left or right; add a
// column after it; remove it, first asking where its cards go when it has any. Each change is one
// element edit, made as it happens. Escape or an outside press closes it; on a phone it is a sheet.
import { useLayoutEffect, useRef, useState } from 'react';
import { type PlanBoardSetup, type PlanColumn } from '@livediagram/items';
import { Button, useClickOutside, useEscape } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import {
  COLUMN_COLOURS,
  COLUMN_NAME_MAX,
  WIP_LIMIT_MAX,
  addColumnAfter,
  moveColumn,
  recolourColumn,
  removeColumn,
  renameColumn,
  setDoneColumn,
  setWipLimit,
} from './board-setup-edits';
import { FIELD_CLASS } from './PlanModal';

const WIDTH = 272;
const GAP = 6;

const LABEL =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const QUIET =
  'rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:enabled:hover:bg-slate-800';

export function PlanColumnPopover({
  getAnchor,
  setup,
  column,
  cardCount,
  onChange,
  onMoveCards,
  onClose,
}: {
  getAnchor: () => HTMLElement | null;
  setup: PlanBoardSetup;
  column: PlanColumn;
  // How many cards the board shows in the column (they move before it goes).
  cardCount: number;
  // A new set-up, and the telemetry part it changed.
  onChange: (next: PlanBoardSetup, part: string) => void;
  onMoveCards: (fromStatus: string, toStatus: string) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const others = setup.columns.filter((c) => c.id !== column.id);
  const [target, setTarget] = useState(others[0]?.status ?? '');
  const at = setup.columns.findIndex((c) => c.id === column.id);
  const done = setup.doneColumnId === column.id;

  useLayoutEffect(() => {
    const a = getAnchor()?.getBoundingClientRect();
    if (!a) return;
    const h = box.current?.offsetHeight ?? 0;
    const left = Math.max(EDGE, Math.min(a.right - WIDTH, window.innerWidth - WIDTH - EDGE));
    const below = a.bottom + GAP;
    const top = below + h + EDGE <= window.innerHeight ? below : Math.max(EDGE, a.top - GAP - h);
    setPos({ left, top });
  }, [getAnchor, removing]);
  useClickOutside(box, () => onClose(false), true, '[data-column-cog]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });

  const body = (
    <div
      className={mobile ? 'flex flex-col gap-3 px-4 pb-3' : 'flex flex-col gap-3 p-3'}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div>
        <label htmlFor={`column-${column.id}-name`} className={LABEL}>
          Column
        </label>
        <input
          id={`column-${column.id}-name`}
          className={FIELD_CLASS}
          defaultValue={column.name}
          maxLength={COLUMN_NAME_MAX}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const next = renameColumn(setup, column.id, e.target.value);
            if (next !== setup && e.target.value.trim() !== column.name)
              onChange(next, 'ColumnRenamed');
          }}
        />
      </div>
      <div>
        <span className={LABEL}>Colour</span>
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={!column.color}
            aria-label="No colour"
            className="h-5 w-5 rounded-full border border-dashed border-slate-300 ring-offset-2 aria-checked:ring-2 aria-checked:ring-brand-500 dark:border-slate-600 dark:ring-offset-slate-900"
            onClick={() => onChange(recolourColumn(setup, column.id, null), 'ColumnColour')}
          />
          {COLUMN_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={column.color === c}
              aria-label={`Colour ${c}`}
              className="h-5 w-5 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-brand-500 dark:ring-offset-slate-900"
              style={{ backgroundColor: c }}
              onClick={() => onChange(recolourColumn(setup, column.id, c), 'ColumnColour')}
            />
          ))}
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor={`column-${column.id}-wip`} className={LABEL}>
            WIP Limit
          </label>
          <input
            id={`column-${column.id}-wip`}
            type="number"
            min={1}
            max={WIP_LIMIT_MAX}
            placeholder="None"
            className={`${FIELD_CLASS} w-24`}
            defaultValue={column.wipLimit ?? ''}
            onBlur={(e) => {
              const n = e.target.value ? Number(e.target.value) : null;
              const next = setWipLimit(setup, column.id, n);
              if (next.columns[at]?.wipLimit !== column.wipLimit) onChange(next, 'WipLimit');
            }}
          />
        </div>
        <label className="mb-1.5 flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={done}
            onChange={(e) =>
              onChange(setDoneColumn(setup, column.id, e.target.checked), 'DoneColumn')
            }
          />
          Counts as done
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          className={QUIET}
          disabled={at <= 0}
          onClick={() => onChange(moveColumn(setup, column.id, -1), 'ColumnReordered')}
        >
          ← Move Left
        </button>
        <button
          type="button"
          className={QUIET}
          disabled={at >= setup.columns.length - 1}
          onClick={() => onChange(moveColumn(setup, column.id, 1), 'ColumnReordered')}
        >
          Move Right →
        </button>
        <button
          type="button"
          className={QUIET}
          disabled={!addColumnAfter(setup, column.id)}
          onClick={() => {
            const added = addColumnAfter(setup, column.id);
            if (added) onChange(added.setup, 'ColumnAdded');
          }}
        >
          + Add Column After
        </button>
      </div>
      {others.length > 0 ? (
        removing ? (
          <div
            role="alertdialog"
            aria-label={`Remove ${column.name}`}
            className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p>Move {cardCount === 1 ? 'its card' : `its ${cardCount} cards`} to</p>
            <select
              className={FIELD_CLASS}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {others.map((c) => (
                <option key={c.id} value={c.status}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="xs"
                onClick={() => {
                  onMoveCards(column.status, target);
                  onChange(removeColumn(setup, column.id), 'ColumnRemoved');
                  onClose(false);
                }}
              >
                Move and Remove
              </Button>
              <Button variant="secondary" size="xs" onClick={() => setRemoving(false)}>
                Keep It
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="self-start rounded-md px-2 py-1 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            onClick={() => {
              if (cardCount > 0) setRemoving(true);
              else {
                onChange(removeColumn(setup, column.id), 'ColumnRemoved');
                onClose(false);
              }
            }}
          >
            Remove Column
          </button>
        )
      ) : null}
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={box}
        role="dialog"
        aria-label={`${column.name} column`}
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label={`${column.name} column`}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
      >
        {body}
      </div>
    </Portal>
  );
}
