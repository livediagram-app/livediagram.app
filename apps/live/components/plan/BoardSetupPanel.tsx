'use client';

// A Plan board's set-up (docs/specs/025-plan/plan-board.md "The board set-up"): title, columns (add,
// rename, recolour, reorder, WIP limit, done, remove), rows, scope, what a card shows, voting and hide
// writing. Every change is an element edit, undone like any other. Removing a column that holds cards
// first asks where they go.
import { useState } from 'react';
import {
  CARD_FIELDS,
  ITEM_TYPES,
  PLAN_COLUMNS_MAX,
  SWIMLANE_BY,
  itemStatus,
  type CardField,
  type Item,
  type PlanBoardSetup,
  type PlanColumn,
  type SwimlaneBy,
} from '@livediagram/items';
import { track } from '@/lib/telemetry';
import { FIELD_CLASS, PlanSheet, SheetRow } from './PlanSheet';

const COLUMN_COLOURS = [
  '',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0d9488',
  '#db2777',
  '#64748b',
];

const SWIMLANE_LABELS: Record<SwimlaneBy, string> = {
  none: 'No rows',
  assignee: 'A row per assignee',
  type: 'A row per item type',
  priority: 'A row per priority',
  parent: 'A row per parent (epic)',
};

const CARD_FIELD_LABELS: Record<CardField, string> = {
  key: 'Number',
  type: 'Type',
  assignee: 'Assignee',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  due: 'Due date',
  votes: 'Votes',
  checklist: 'Checklist progress',
};

// A status for a new column: its name, as a slug, unique on the board.
export function newColumnStatus(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'column';
  let status = base;
  for (let n = 2; taken.includes(status); n++) status = `${base}-${n}`;
  return status;
}

export function BoardSetupPanel({
  setup,
  items,
  onChange,
  onMoveItems,
  onClose,
}: {
  setup: PlanBoardSetup;
  items: ReadonlyMap<string, Item>;
  onChange: (next: PlanBoardSetup, part: string) => void;
  onMoveItems: (fromStatus: string, toStatus: string) => void;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState<PlanColumn | null>(null);
  const [target, setTarget] = useState('');
  const set = (patch: Partial<PlanBoardSetup>, part: string) =>
    onChange({ ...setup, ...patch }, part);
  const setColumn = (id: string, patch: Partial<PlanColumn>, part: string) =>
    set({ columns: setup.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, part);
  const countIn = (status: string) =>
    [...items.values()].filter((i) => itemStatus(i) === status).length;
  const move = (index: number, step: -1 | 1) => {
    const cols = [...setup.columns];
    const [c] = cols.splice(index, 1);
    cols.splice(index + step, 0, c!);
    set({ columns: cols }, 'ColumnReordered');
  };
  const remove = (col: PlanColumn) => {
    const columns = setup.columns.filter((c) => c.id !== col.id);
    set(
      {
        columns,
        ...(setup.doneColumnId === col.id ? { doneColumnId: undefined } : {}),
      },
      'ColumnRemoved',
    );
  };
  return (
    <PlanSheet
      label="Board set-up"
      onClose={onClose}
      header={<div className="text-[14px] font-semibold">Board Set-Up</div>}
    >
      <SheetRow label="Title" htmlFor="plan-setup-title">
        <input
          id="plan-setup-title"
          className={FIELD_CLASS}
          defaultValue={setup.title}
          maxLength={80}
          onBlur={(e) => {
            const title = e.target.value.trim();
            if (title && title !== setup.title) set({ title }, 'Title');
          }}
        />
      </SheetRow>
      <SheetRow label="Columns">
        <div className="flex flex-col gap-2">
          {setup.columns.map((col, i) => (
            <div
              key={col.id}
              className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
            >
              <div className="flex items-center gap-1.5">
                <input
                  aria-label={`Column ${i + 1} name`}
                  className={`${FIELD_CLASS} flex-1`}
                  defaultValue={col.name}
                  maxLength={40}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== col.name) setColumn(col.id, { name }, 'ColumnRenamed');
                  }}
                />
                <button
                  type="button"
                  aria-label={`Move ${col.name} left`}
                  disabled={i === 0}
                  className="h-7 w-7 rounded-md text-slate-500 transition enabled:hover:bg-slate-100 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
                  onClick={() => move(i, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Move ${col.name} right`}
                  disabled={i === setup.columns.length - 1}
                  className="h-7 w-7 rounded-md text-slate-500 transition enabled:hover:bg-slate-100 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
                  onClick={() => move(i, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${col.name}`}
                  disabled={setup.columns.length === 1}
                  className="h-7 w-7 rounded-md text-slate-500 transition enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:opacity-30 dark:enabled:hover:bg-red-950/40"
                  onClick={() => {
                    if (countIn(col.status) === 0) remove(col);
                    else {
                      setRemoving(col);
                      setTarget(setup.columns.find((c) => c.id !== col.id)!.status);
                    }
                  }}
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-1.5">
                  WIP limit
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="w-14 rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                    defaultValue={col.wipLimit ?? ''}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      const wipLimit =
                        e.target.value && Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined;
                      if (wipLimit !== col.wipLimit) {
                        const { wipLimit: _old, ...rest } = col;
                        set(
                          {
                            columns: setup.columns.map((c) =>
                              c.id === col.id ? (wipLimit ? { ...rest, wipLimit } : rest) : c,
                            ),
                          },
                          'WipLimit',
                        );
                      }
                    }}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="plan-done-column"
                    checked={setup.doneColumnId === col.id}
                    onChange={() => set({ doneColumnId: col.id }, 'DoneColumn')}
                  />
                  Done column
                </label>
                <span
                  className="flex items-center gap-1"
                  role="radiogroup"
                  aria-label={`${col.name} colour`}
                >
                  {COLUMN_COLOURS.map((c) => (
                    <button
                      key={c || 'none'}
                      type="button"
                      role="radio"
                      aria-checked={(col.color ?? '') === c}
                      aria-label={c ? `Colour ${c}` : 'No colour'}
                      className="h-4 w-4 rounded-full border border-slate-300 aria-checked:ring-2 aria-checked:ring-brand-400 dark:border-slate-600"
                      style={{ backgroundColor: c || 'transparent' }}
                      onClick={() => {
                        const { color: _old, ...rest } = col;
                        set(
                          {
                            columns: setup.columns.map((x) =>
                              x.id === col.id ? (c ? { ...rest, color: c } : rest) : x,
                            ),
                          },
                          'ColumnColour',
                        );
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          ))}
          {setup.columns.length < PLAN_COLUMNS_MAX ? (
            <button
              type="button"
              className="self-start rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => {
                const status = newColumnStatus(
                  'New column',
                  setup.columns.map((c) => c.status),
                );
                set(
                  { columns: [...setup.columns, { id: status, status, name: 'New column' }] },
                  'ColumnAdded',
                );
              }}
            >
              + Add column
            </button>
          ) : null}
        </div>
      </SheetRow>
      {removing ? (
        <div
          role="alertdialog"
          aria-label={`Remove ${removing.name}`}
          className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="mb-2">
            Move {countIn(removing.status)} items from {removing.name} to
          </p>
          <select
            className={FIELD_CLASS}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {setup.columns
              .filter((c) => c.id !== removing.id)
              .map((c) => (
                <option key={c.id} value={c.status}>
                  {c.name}
                </option>
              ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-amber-600 px-2.5 py-1 font-medium text-white hover:bg-amber-700"
              onClick={() => {
                onMoveItems(removing.status, target);
                remove(removing);
                setRemoving(null);
              }}
            >
              Move and remove
            </button>
            <button
              type="button"
              className="rounded-md px-2.5 py-1 font-medium"
              onClick={() => setRemoving(null)}
            >
              Keep the column
            </button>
          </div>
        </div>
      ) : null}
      <SheetRow label="Rows" htmlFor="plan-setup-rows">
        <select
          id="plan-setup-rows"
          className={FIELD_CLASS}
          value={setup.swimlaneBy}
          onChange={(e) => set({ swimlaneBy: e.target.value as SwimlaneBy }, 'Rows')}
        >
          {SWIMLANE_BY.map((s) => (
            <option key={s} value={s}>
              {SWIMLANE_LABELS[s]}
            </option>
          ))}
        </select>
      </SheetRow>
      <SheetRow label="Shows">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px]">
          {ITEM_TYPES.map((t) => {
            const on = !setup.scope.types || setup.scope.types.includes(t.id);
            return (
              <label key={t.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const current = setup.scope.types ?? ITEM_TYPES.map((x) => x.id);
                    const types = on ? current.filter((x) => x !== t.id) : [...current, t.id];
                    const all = types.length === ITEM_TYPES.length;
                    set(
                      { scope: { ...setup.scope, ...(all ? { types: undefined } : { types }) } },
                      'Scope',
                    );
                  }}
                />
                {t.label}
              </label>
            );
          })}
        </div>
        <input
          aria-label="Only items with this label"
          placeholder="Only items with this label (optional)"
          className={`${FIELD_CLASS} mt-2`}
          defaultValue={setup.scope.label ?? ''}
          onBlur={(e) => {
            const label = e.target.value.trim().replace(/^#/, '');
            if (label !== (setup.scope.label ?? '')) {
              const { label: _old, ...rest } = setup.scope;
              set({ scope: label ? { ...rest, label } : rest }, 'Scope');
            }
          }}
        />
      </SheetRow>
      <SheetRow label="Cards Show">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          {CARD_FIELDS.map((f) => (
            <label key={f} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={setup.cardFields.includes(f)}
                onChange={(e) =>
                  set(
                    {
                      cardFields: CARD_FIELDS.filter((x) =>
                        x === f ? e.target.checked : setup.cardFields.includes(x),
                      ),
                    },
                    'CardFields',
                  )
                }
              />
              {CARD_FIELD_LABELS[f]}
            </label>
          ))}
        </div>
      </SheetRow>
      <SheetRow label="Voting">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={setup.voting.on}
            onChange={(e) => set({ voting: { ...setup.voting, on: e.target.checked } }, 'Voting')}
          />
          Let people vote on cards
        </label>
        {setup.voting.on ? (
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
            Votes each
            <input
              type="number"
              min={1}
              max={99}
              placeholder="Any"
              className="w-16 rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
              defaultValue={setup.voting.budget ?? ''}
              onBlur={(e) => {
                const n = Number(e.target.value);
                const budget =
                  e.target.value && Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined;
                if (budget !== setup.voting.budget)
                  set({ voting: budget ? { on: true, budget } : { on: true } }, 'VoteBudget');
              }}
            />
          </label>
        ) : null}
      </SheetRow>
      <SheetRow label="Hide Writing">
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={setup.hideWriting}
            onChange={(e) => set({ hideWriting: e.target.checked }, 'HideWriting')}
          />
          <span>
            Show everyone else&rsquo;s cards face down until someone presses Reveal.
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              It hides cards on this board, not the items themselves.
            </span>
          </span>
        </label>
      </SheetRow>
    </PlanSheet>
  );
}

export function trackSetup(part: string): void {
  track('Plan', 'Changed', part);
}
