'use client';

// A column's settings (docs/specs/026-plan/plan-board.md "The board set-up"): the popover a column's cog
// opens, hanging under the cog. Its name as the header; colour, WIP limit (a stepper) and Counts as
// Done (a switch); move left or right; add a
// column after it (the column picker: an existing status, or a new one); remove it, first asking where its cards go when it has any. Each change is one
// element edit, made as it happens. Escape or an outside press closes it; on a phone it is a sheet.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  COLUMN_WIDTHS,
  isTrashed,
  missingBoardStatuses,
  type PlanBoardSetup,
  type PlanColumn,
} from '@livediagram/items';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  useClickOutside,
  useEscape,
} from '@livediagram/ui';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { Portal, lucideGlyph } from '@livediagram/ui';
import { lucideBetweenVerticalEnd } from '@livediagram/icons/lucide';

// Remove Column's glyph: a column taken out from between its neighbours.
const ColumnOffIcon = lucideGlyph(lucideBetweenVerticalEnd, 16);
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
  reuseColumnStatus,
} from './board-setup-edits';
import { requestColumnSettings } from './column-settings-request';
import { AddColumnPickerPopover } from './AddColumnPickerPopover';
import {
  addStatusColumn,
  addStatusColumns,
  columnRename,
  pickableStatuses,
} from './column-status-picks';
import { usePlan } from './PlanContext';
import { RemoveColumnPopover } from './RemoveColumnPopover';

const NO_STATUSES: ReadonlyMap<string, string> = new Map();

const WIDTH = 280;
const GAP = 6;

const LABEL = 'mb-1.5 block text-[13px] text-slate-700 dark:text-slate-200';
const STEP =
  'w-8 text-[15px] text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35 dark:text-slate-300 dark:enabled:hover:bg-slate-800';
// The element menu's plain row (PortalMenu MenuActionRow `plain`): icon left, 13px.
const ROW_BASE =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition disabled:opacity-35';
const ROW = `${ROW_BASE} text-slate-700 enabled:hover:bg-slate-100 dark:text-slate-200 dark:enabled:hover:bg-slate-800`;

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
  selectName = false,
  onChange,
  onMoveCards,
  onTrashCards,
  onDeleteStatus,
  onClose,
}: {
  getAnchor: () => HTMLElement | null;
  // A column just added: its name opens selected, ready to type over.
  selectName?: boolean;
  setup: PlanBoardSetup;
  column: PlanColumn;
  // A new set-up, and the telemetry part it changed.
  onChange: (next: PlanBoardSetup, part: string) => void;
  onMoveCards: (fromStatus: string, toStatus: string) => void;
  // Every card in the state to the Trash (a removed column's, when asked).
  onTrashCards: (status: string) => void;
  onClose: (restoreFocus: boolean) => void;
  // Delete Status: the state's columns come off the document's other boards too.
  onDeleteStatus?: ((status: string) => void) | undefined;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // The Remove Column button while its popover is open.
  const [removingAt, setRemovingAt] = useState<HTMLElement | null>(null);
  // + Add Column After opens the column picker as its own popover hung from the button
  // (docs/specs/026-plan/plan-board.md "The column picker"); this one stays open behind it.
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const plan = usePlan();
  // The statuses a column can take: the boards', any a card is in, and the card types' Default States.
  const statusNames = useMemo(
    () =>
      pickableStatuses(plan?.statusNames ?? NO_STATUSES, plan?.items?.values() ?? [], plan?.types),
    [plan?.statusNames, plan?.items, plan?.types],
  );
  // The ones this board lacks, with their cards on it, for the column picker: worked out only while it is open.
  const existing = useMemo(
    () =>
      adding
        ? missingBoardStatuses(setup, statusNames, {
            items: plan?.items?.values() ?? [],
            types: plan?.types,
            boards: plan?.statusBoards,
          })
        : [],
    [adding, setup, statusNames, plan?.items, plan?.types, plan?.statusBoards],
  );
  // Whether any card (out of the Trash) is in this column's status anywhere: a rename never strands them.
  const hasCards = [...(plan?.items?.values() ?? [])].some(
    (it) => it.fields['status'] === column.status && !isTrashed(it),
  );
  // The cards in this column's state anywhere (out of the Trash): what a removal moves.
  const stateCards = [...(plan?.items?.values() ?? [])].filter(
    (it) => it.fields['status'] === column.status && !isTrashed(it),
  ).length;
  // The state a typed name already belongs to, when the rename was refused.
  const [renameClash, setRenameClash] = useState<string | null>(null);
  const others = setup.columns.filter((c) => c.id !== column.id);
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
  }, [getAnchor]);
  // A press in the picker (portalled) is not outside, and Escape is the picker's while it is open.
  useClickOutside(
    box,
    () => onClose(false),
    true,
    '[data-column-cog], [data-add-column-picker], [data-anchored-popover]',
  );
  useEscape(() => onClose(true), {
    capture: true,
    stopPropagation: true,
    enabled: !adding && !removingAt,
  });

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
          onChange={() => setRenameClash(null)}
          onBlur={(e) => {
            const typed = e.target.value;
            if (typed.trim() === column.name) return;
            // One name, one status: a name another status has switches an empty column to it, or is refused.
            const outcome = columnRename(setup, column.id, typed, statusNames, hasCards);
            if (outcome.kind === 'clash') {
              setRenameClash(outcome.name);
              e.target.value = column.name;
              return;
            }
            const next =
              outcome.kind === 'reuse'
                ? reuseColumnStatus(setup, column.id, outcome.status, outcome.name)
                : renameColumn(setup, column.id, typed);
            if (next !== setup) onChange(next, 'ColumnRenamed');
          }}
        />
      </div>
      {renameClash ? (
        <p
          role="alert"
          className="border-b border-slate-100 px-3 py-2 text-[12px] text-amber-700 dark:border-slate-800 dark:text-amber-300"
        >
          A {renameClash} state already exists. Add it from Add Column, so its cards show here.
        </p>
      ) : null}
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
        {/* One to a row, icon left, as the actions under them are (docs/specs/026-plan/plan-board.md "Option lists"). */}
        <button
          type="button"
          className={ROW}
          disabled={at <= 0}
          onClick={() => onChange(moveColumn(setup, column.id, -1), 'ColumnReordered')}
        >
          <ChevronLeftIcon size={16} className="text-slate-400" />
          Move Left
        </button>
        <button
          type="button"
          className={ROW}
          disabled={at >= setup.columns.length - 1}
          onClick={() => onChange(moveColumn(setup, column.id, 1), 'ColumnReordered')}
        >
          <ChevronRightIcon size={16} className="text-slate-400" />
          Move Right
        </button>
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
            existing={existing}
            onPick={(pick) => {
              const made = addStatusColumn(setup, column.id, pick);
              if (!made) return;
              // The settings move to the new column: this popover closes, and the new column's head opens its own.
              requestColumnSettings(made.column.id);
              onChange(made.setup, 'ColumnAddedExisting');
              onClose(false);
            }}
            onPickAll={(picks) => {
              onChange(addStatusColumns(setup, column.id, picks), 'ColumnAddedExisting');
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
        {/* Remove Column takes it off this board only: the state and its cards stay, so another board's column
            for it still shows them. Delete Status deletes the state: its cards go where asked, and every board's
            column for it goes. */}
        {others.length > 0 ? (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              onChange(removeColumn(setup, column.id), 'ColumnRemoved');
              onClose(false);
            }}
          >
            <ColumnOffIcon />
            Remove Column
          </button>
        ) : null}
        {others.length > 0 ? (
          <button
            type="button"
            className={ROW}
            aria-haspopup={stateCards > 0 ? 'dialog' : undefined}
            aria-expanded={stateCards > 0 ? removingAt !== null : undefined}
            onClick={(e) => {
              if (stateCards > 0) setRemovingAt(e.currentTarget);
              else {
                onChange(removeColumn(setup, column.id), 'ColumnRemoved');
                onDeleteStatus?.(column.status);
                onClose(false);
              }
            }}
          >
            <TrashIcon size={16} />
            Delete Status
          </button>
        ) : null}
        {removingAt ? (
          <RemoveColumnPopover
            anchor={removingAt}
            column={column}
            others={others}
            cardCount={stateCards}
            onCancel={() => setRemovingAt(null)}
            onRemove={(choice) => {
              if (choice.kind === 'move') onMoveCards(column.status, choice.to);
              else onTrashCards(column.status);
              onChange(removeColumn(setup, column.id), 'ColumnRemoved');
              onDeleteStatus?.(column.status);
              setRemovingAt(null);
              onClose(false);
            }}
          />
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
