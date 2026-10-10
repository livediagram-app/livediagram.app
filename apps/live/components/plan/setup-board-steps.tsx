'use client';

// Setup Board's two steps (docs/specs/026-plan/plan-board.md "Setup Board"): the card types the board is for, then
// its columns (existing statuses to pick, new ones to name, in order). Drawn in the board's own colours.
import { useId, useState } from 'react';
import { missingBoardStatuses, type ItemTypeDef } from '@livediagram/items';
import { CountBadge, PlusIcon } from '@livediagram/ui';
import { COLUMN_NAME_MAX } from './board-setup-edits';
import { matchStatus } from './column-status-picks';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars, type PlanPalette } from './plan-palette';
import { columnFromName, setupColumnKey, type SetupColumn } from './setup-board';
import { usePlan } from './PlanContext';
import { SetupColumnList } from './SetupColumnList';
import { AddCardTypeButton } from './AddCardTypeButton';
import { OptionRows } from './OptionRows';
import { StatusSwatch, cardCount, usedOn } from './ExistingStatusList';

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider';

// The board's colours as CSS variables, so a button's hover classes (a brand border and tint) win over them, where
// inline colours would not.
const boardVars = (palette: PlanPalette) =>
  ({
    '--line': palette.cardBorder,
    '--muted': palette.muted,
    '--ink': palette.text,
    '--fill': palette.card,
  }) as React.CSSProperties;
// A bordered button in the board's colours: Add.
const BOARD_BUTTON =
  'flex cursor-pointer items-center gap-1 border border-[var(--line)] bg-[var(--fill)] font-medium text-[var(--ink)] transition hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300';
const ADD_BUTTON = `${BOARD_BUTTON} rounded-lg px-3 text-[13px]`;
const LINK =
  'cursor-pointer rounded px-1.5 py-0.5 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-default disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10';

// Step 1: a row per card type, ticked when the board takes it.
export function SetupTypesStep({
  types,
  chosen,
  palette,
  onChange,
  onCreateType,
}: {
  types: readonly ItemTypeDef[];
  chosen: readonly string[];
  palette: PlanPalette;
  onChange: (ids: string[]) => void;
  // Add New Card Type: opens the type editor (absent while the catalogue is full); a type made there joins the picks.
  onCreateType?: (() => void) | undefined;
}) {
  const all = types.every((t) => chosen.includes(t.id));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px]" style={{ color: palette.muted }}>
          Which cards belong on this board? Only these can be added to it.
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className={LINK}
            disabled={all}
            onClick={() => onChange(types.map((t) => t.id))}
          >
            Select All
          </button>
          <button
            type="button"
            className={LINK}
            disabled={chosen.length === 0}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>
      <OptionRows
        kind="multiple"
        label="Card Types"
        palette={palette}
        selected={chosen}
        rows={types.map((t) => ({
          id: t.id,
          label: t.label,
          icon: (
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${ACCENT_TINT} ${ACCENT_TEXT}`}
              style={accentVars(t.color)}
            >
              <PlanTypeGlyph glyph={t.glyph} size={15} />
            </span>
          ),
        }))}
        onPick={(id) => {
          const on = chosen.includes(id);
          onChange(types.map((x) => x.id).filter((x) => (x === id ? !on : chosen.includes(x))));
        }}
      />
      {onCreateType ? <AddCardTypeButton onClick={onCreateType} palette={palette} /> : null}
      <p className="text-[12px] tabular-nums" style={{ color: palette.muted }}>
        {chosen.length === 0
          ? 'Pick at least one card type.'
          : all
            ? `Every card type, ${types.length} in all`
            : `${chosen.length} of ${types.length} card types`}
      </p>
    </div>
  );
}

// Step 2: the board's columns, in order, then existing statuses to add, then a new one to name.
export function SetupColumnsStep({
  chosen,
  statusNames,
  typeIds,
  max,
  palette,
  onChange,
}: {
  chosen: readonly SetupColumn[];
  statusNames: ReadonlyMap<string, string>;
  // The card types chosen in step 1: an existing state's card count counts only these.
  typeIds?: readonly string[];
  // The most columns a board holds.
  max: number;
  palette: PlanPalette;
  onChange: (next: SetupColumn[]) => void;
}) {
  const inputId = useId();
  const [name, setName] = useState('');
  const plan = usePlan();
  // The states the board does not have yet, as the column picker lists them (missingBoardStatuses): the same order,
  // card counts, boards and colours.
  const existing = missingBoardStatuses(
    {
      columns: chosen.map((c) => ({
        id: setupColumnKey(c),
        status: c.kind === 'existing' ? c.status : '',
        name: c.name,
      })),
      ...(typeIds ? { addTypes: [...typeIds] } : {}),
    },
    statusNames,
    { items: plan?.items?.values() ?? [], types: plan?.types, boards: plan?.statusBoards },
  );
  const full = chosen.length >= max;
  const typed = columnFromName(name, chosen, statusNames);
  const reuses = name.trim() ? matchStatus(name, { columns: [] }, statusNames) : null;
  const add = (c: SetupColumn) => !full && onChange([...chosen, c]);
  const submit = () => {
    if (!typed || full) return;
    add(typed);
    setName('');
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px]" style={{ color: palette.muted }}>
        The stages your cards move through. Drag to reorder: top to bottom is left to right on the
        board.
      </p>

      {/* The columns so far, as the board will show them. */}
      <div className="flex flex-col gap-1.5">
        <p className={`${HEADING} flex items-center gap-1.5`} style={{ color: palette.muted }}>
          Columns
          <CountBadge size="sm" background="#64748b26" color="#64748b">
            {chosen.length}
          </CountBadge>
        </p>
        {chosen.length === 0 ? (
          <p
            className="rounded-xl border-2 border-dashed px-3 py-4 text-center text-[12px]"
            style={{ borderColor: palette.cardBorder, color: palette.muted }}
          >
            No columns yet. Add one below.
          </p>
        ) : (
          <SetupColumnList chosen={chosen} palette={palette} onChange={onChange} />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className={HEADING} style={{ color: palette.muted }}>
          Add a New State
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={name}
            maxLength={COLUMN_NAME_MAX}
            placeholder="In Review"
            disabled={full}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            className="min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-[13px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            style={{
              borderColor: palette.cardBorder,
              backgroundColor: palette.card,
              color: palette.text,
            }}
          />
          <button
            type="button"
            disabled={!typed || full}
            onClick={submit}
            className={ADD_BUTTON}
            style={boardVars(palette)}
          >
            <PlusIcon size={12} />
            Add
          </button>
        </div>
        <p className="min-h-4 text-[12px]" style={{ color: palette.muted }}>
          {full
            ? `A board holds up to ${max} columns.`
            : name.trim() && !typed
              ? 'That column is already on the board.'
              : reuses?.kind === 'existing'
                ? `Uses the existing ${reuses.pick.name} state, so its cards show here.`
                : ' '}
        </p>
      </div>

      {existing.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className={HEADING} style={{ color: palette.muted }}>
              Use an Existing State
            </p>
            {existing.length > 1 ? (
              <button
                type="button"
                className={LINK}
                disabled={full}
                onClick={() =>
                  onChange(
                    [
                      ...chosen,
                      ...existing.map((c) => ({
                        kind: 'existing' as const,
                        status: c.status,
                        name: c.name,
                      })),
                    ].slice(0, max),
                  )
                }
              >
                Add All
              </button>
            ) : null}
          </div>
          {/* A row per state, as the column picker shows it: its colour, its name, the boards that use it and its
              cards. */}
          <OptionRows
            kind="action"
            label="Existing States"
            palette={palette}
            rows={existing.map((c) => ({
              id: c.status,
              label: c.name,
              ariaLabel: `Add ${c.name}`,
              disabled: full,
              detail: usedOn(c),
              icon: <StatusSwatch colour={c.colour} />,
              trailing: (
                <span
                  className="shrink-0 text-[11px] tabular-nums"
                  style={{ color: palette.muted }}
                >
                  {cardCount(c.cards)}
                </span>
              ),
            }))}
            onPick={(status) => {
              const c = existing.find((x) => x.status === status);
              if (c) add({ kind: 'existing', status: c.status, name: c.name });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
