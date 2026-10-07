'use client';

// A column's settings (docs/specs/026-plan/plan-board.md "The board set-up"): the popover a column's cog
// opens, hanging under the cog. Its name as the header; colour, WIP limit (a stepper) and Counts as
// Done (a switch); move left or right; add a
// column after it (the column picker: an existing status, or a new one); remove it, first asking where its cards go when it has any. Each change is one
// element edit, made as it happens. Escape or an outside press closes it; on a phone it is a sheet.
import { useLayoutEffect, useRef, useState } from 'react';
import { COLUMN_WIDTHS, type PlanBoardSetup, type PlanColumn } from '@livediagram/items';
import {
  Button,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  useClickOutside,
  useEscape,
  Select,
} from '@livediagram/ui';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { Portal } from '@livediagram/ui';
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
  setColumnWidth,
  setWipLimit,
} from './board-setup-edits';
import { requestColumnSettings } from './column-settings-request';
import { AddColumnPickerPopover } from './AddColumnPickerPopover';
import { addStatusColumn, addStatusColumns } from './column-status-picks';
import { usePlan } from './PlanContext';

const NO_STATUSES: ReadonlyMap<string, string> = new Map();

const WIDTH = 280;
const GAP = 6;

const LABEL = 'mb-1.5 block text-[13px] text-slate-700 dark:text-slate-200';
const STEP =
  'w-8 text-[15px] text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35 dark:text-slate-300 dark:enabled:hover:bg-slate-800';
const MOVE =
  'flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[12px] font-medium text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-800';
// The element menu's plain row (PortalMenu MenuActionRow `plain`): icon left, 13px.
const ROW_BASE =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition disabled:opacity-35';
const ROW = `${ROW_BASE} text-slate-700 enabled:hover:bg-slate-100 dark:text-slate-200 dark:enabled:hover:bg-slate-800`;
const DANGER_ROW = `${ROW_BASE} text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15`;

// One colour choice: a filled dot (or a dashed ring for none) with a check when chosen.
function Swatch({
  label,
  color,
  checked,
  onPick,
}: {
  label: string;
  color?: string;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      className={`flex aspect-square w-full items-center justify-center rounded-full transition hover:scale-110 ${
        color ? '' : 'border border-dashed border-slate-300 text-slate-500 dark:border-slate-600'
      } ${checked ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}`}
      style={color ? { backgroundColor: color } : undefined}
      onClick={onPick}
    >
      {checked ? <CheckIcon size={12} className={color ? 'text-white' : ''} /> : null}
    </button>
  );
}

export function PlanColumnPopover({
  getAnchor,
  setup,
  column,
  cardCount,
  selectName = false,
  onChange,
  onMoveCards,
  onClose,
}: {
  getAnchor: () => HTMLElement | null;
  // A column just added: its name opens selected, ready to type over.
  selectName?: boolean;
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
  // + Add Column After opens the column picker as its own popover hung from the button
  // (docs/specs/026-plan/plan-board.md "The column picker"); this one stays open behind it.
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const statusNames = usePlan()?.statusNames ?? NO_STATUSES;
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
  // A press in the picker (portalled) is not outside, and Escape is the picker's while it is open.
  useClickOutside(box, () => onClose(false), true, '[data-column-cog], [data-add-column-picker]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true, enabled: !adding });

  const wip = column.wipLimit ?? null;
  const setWip = (n: number | null) => {
    const next = setWipLimit(setup, column.id, n);
    if (next.columns[at]?.wipLimit !== column.wipLimit) onChange(next, 'WipLimit');
  };
  const added = addColumnAfter(setup, column.id);

  const body = (
    <div
      className={mobile ? 'flex flex-col px-1 pb-2' : 'flex flex-col'}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
          style={
            column.color ? { backgroundColor: column.color, borderColor: column.color } : undefined
          }
        />
        <input
          id={`column-${column.id}-name`}
          aria-label="Column name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold text-slate-800 outline-none transition hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-950"
          defaultValue={column.name}
          maxLength={COLUMN_NAME_MAX}
          autoFocus
          onFocus={selectName ? (e) => e.currentTarget.select() : undefined}
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
      <div className="flex flex-col gap-3 px-3 py-3">
        <div>
          <span className={LABEL}>Colour</span>
          <div role="radiogroup" aria-label="Colour" className="grid grid-cols-9 gap-1.5">
            <Swatch
              label="No colour"
              checked={!column.color}
              onPick={() => onChange(recolourColumn(setup, column.id, null), 'ColumnColour')}
            />
            {COLUMN_COLOURS.map((c) => (
              <Swatch
                key={c}
                label={`Colour ${c}`}
                color={c}
                checked={column.color === c}
                onPick={() => onChange(recolourColumn(setup, column.id, c), 'ColumnColour')}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <label
              htmlFor={`column-${column.id}-wip`}
              className="block text-[13px] text-slate-700 dark:text-slate-200"
            >
              WIP Limit
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {wip ? `Warns past ${wip} cards` : 'No limit'}
            </p>
          </div>
          <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              aria-label="Lower the WIP limit"
              disabled={!wip}
              className={STEP}
              onClick={() => setWip(wip && wip > 1 ? wip - 1 : null)}
            >
              −
            </button>
            <input
              id={`column-${column.id}-wip`}
              type="number"
              inputMode="numeric"
              min={1}
              max={WIP_LIMIT_MAX}
              placeholder="Off"
              key={wip ?? 'none'}
              className="w-11 border-x border-slate-200 bg-transparent text-center text-[13px] tabular-nums text-slate-800 outline-none [appearance:textfield] focus:bg-brand-50 dark:border-slate-700 dark:text-slate-100 dark:focus:bg-brand-500/10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              defaultValue={wip ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              onBlur={(e) => setWip(e.target.value ? Number(e.target.value) : null)}
            />
            <button
              type="button"
              aria-label="Raise the WIP limit"
              disabled={(wip ?? 0) >= WIP_LIMIT_MAX}
              className={STEP}
              onClick={() => setWip((wip ?? 0) + 1)}
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[13px] text-slate-700 dark:text-slate-200">Width</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Slots across the board</p>
          </div>
          <div
            role="radiogroup"
            aria-label="Column width"
            className="flex h-8 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
          >
            {COLUMN_WIDTHS.map((w) => {
              const on = (column.width ?? 1) === w;
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${w} ${w === 1 ? 'slot' : 'slots'}`}
                  className={`flex w-10 items-center justify-center gap-[2px] border-r border-slate-200 transition last:border-r-0 dark:border-slate-700 ${
                    on
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => onChange(setColumnWidth(setup, column.id, w), 'ColumnWidth')}
                >
                  {Array.from({ length: w }, (_, i) => (
                    <span key={i} aria-hidden className="h-3.5 w-1.5 rounded-sm bg-current" />
                  ))}
                </button>
              );
            })}
          </div>
        </div>
        <SwitchRow
          checked={done}
          onChange={(on) => onChange(setDoneColumn(setup, column.id, on), 'DoneColumn')}
        >
          <span className="block text-[13px] text-slate-700 dark:text-slate-200">
            Counts as Done
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
            Counts toward the board’s progress
          </span>
        </SwitchRow>
      </div>
      <div className="border-t border-slate-100 px-1.5 py-1.5 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-1 px-1.5 pb-1 pt-1.5">
          <button
            type="button"
            className={MOVE}
            disabled={at <= 0}
            onClick={() => onChange(moveColumn(setup, column.id, -1), 'ColumnReordered')}
          >
            <ChevronLeftIcon size={14} />
            Move Left
          </button>
          <button
            type="button"
            className={MOVE}
            disabled={at >= setup.columns.length - 1}
            onClick={() => onChange(moveColumn(setup, column.id, 1), 'ColumnReordered')}
          >
            Move Right
            <ChevronRightIcon size={14} />
          </button>
        </div>
        <button
          ref={addButton}
          type="button"
          data-add-column-after=""
          className={ROW}
          disabled={!added}
          aria-haspopup="dialog"
          aria-expanded={adding}
          onClick={() => setAdding((a) => !a)}
        >
          <PlusIcon size={16} className="text-slate-400" />
          Add Column After
        </button>
        {adding && added ? (
          <AddColumnPickerPopover
            anchor={addButton}
            onClose={() => setAdding(false)}
            setup={setup}
            statusNames={statusNames}
            onPick={(pick) => {
              const made = addStatusColumn(setup, column.id, pick);
              if (!made) return;
              // The settings move to the new column: this popover closes, and the new column's head opens its own.
              requestColumnSettings(made.column.id);
              onChange(made.setup, 'ColumnAdded');
              onClose(false);
            }}
            onPickAll={(picks) => {
              onChange(addStatusColumns(setup, column.id, picks), 'ColumnAdded');
              onClose(false);
            }}
            onName={(name) => {
              const made = addColumnAfter(setup, column.id, name);
              if (!made) return;
              requestColumnSettings(made.column.id);
              onChange(made.setup, 'ColumnAdded');
              onClose(false);
            }}
          />
        ) : null}
        {others.length > 0 && !removing ? (
          <button
            type="button"
            className={DANGER_ROW}
            onClick={() => {
              if (cardCount > 0) setRemoving(true);
              else {
                onChange(removeColumn(setup, column.id), 'ColumnRemoved');
                onClose(false);
              }
            }}
          >
            <TrashIcon size={16} />
            Remove Column
          </button>
        ) : null}
        {others.length > 0 && removing ? (
          <div
            role="alertdialog"
            aria-label={`Remove ${column.name}`}
            className="m-1.5 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <p>
              Move {cardCount === 1 ? 'its card' : `its ${cardCount} cards`} to another column first
            </p>
            <Select
              aria-label="Move cards to"
              className="w-full"
              selectClassName="text-[13px]"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {others.map((c) => (
                <option key={c.id} value={c.status}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="xs" onClick={() => setRemoving(false)}>
                Keep It
              </Button>
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
            </div>
          </div>
        ) : null}
      </div>
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
        className="fixed z-[var(--z-overlay)] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
      >
        {body}
      </div>
    </Portal>
  );
}
