'use client';

// Setup Board's two steps (docs/specs/026-plan/plan-board.md "Setup Board"): the card types the board is for, then
// its columns (existing statuses to pick, new ones to name, in order). Drawn in the board's own colours.
import { useId, useState } from 'react';
import type { ItemTypeDef } from '@livediagram/items';
import { CheckIcon, CountBadge, PlusIcon } from '@livediagram/ui';
import { COLUMN_NAME_MAX } from './board-setup-edits';
import { matchStatus } from './column-status-picks';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars, type PlanPalette } from './plan-palette';
import { columnFromName, setupColumnKey, type SetupColumn } from './setup-board';
import { SetupColumnList } from './SetupColumnList';

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider';
const LINK =
  'cursor-pointer rounded px-1.5 py-0.5 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-default disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10';

// Step 1: a tile per card type, pressed when the board takes it.
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
      <div role="group" aria-label="Card types" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {types.map((t) => {
          const on = chosen.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(
                  types.map((x) => x.id).filter((id) => (id === t.id ? !on : chosen.includes(id))),
                )
              }
              className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-[13px] font-medium transition ${
                on
                  ? 'border-brand-500 shadow-sm dark:border-brand-400'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
              style={{
                backgroundColor: palette.card,
                color: palette.text,
                ...(on ? {} : { borderColor: palette.cardBorder }),
              }}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ACCENT_TINT} ${ACCENT_TEXT}`}
                style={accentVars(t.color)}
              >
                <PlanTypeGlyph glyph={t.glyph} size={16} />
              </span>
              {/* The whole name, wrapping to two lines rather than cut short. */}
              <span className="line-clamp-2 min-w-0 flex-1 leading-tight [overflow-wrap:anywhere]">
                {t.label}
              </span>
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition ${
                  on ? 'bg-brand-500 text-white dark:bg-brand-600' : 'border'
                }`}
                style={on ? undefined : { borderColor: palette.cardBorder }}
              >
                {on ? <CheckIcon size={10} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {onCreateType ? (
        <button
          type="button"
          onClick={onCreateType}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 text-[13px] font-medium transition hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          style={{ borderColor: palette.cardBorder, color: palette.muted }}
        >
          <PlusIcon size={12} />
          Add New Card Type
        </button>
      ) : null}
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
  max,
  palette,
  onChange,
}: {
  chosen: readonly SetupColumn[];
  statusNames: ReadonlyMap<string, string>;
  // The most columns a board holds.
  max: number;
  palette: PlanPalette;
  onChange: (next: SetupColumn[]) => void;
}) {
  const inputId = useId();
  const [name, setName] = useState('');
  const chosenKeys = new Set(chosen.map(setupColumnKey));
  const existing = [...statusNames]
    .map(([status, label]) => ({ kind: 'existing' as const, status, name: label }))
    .filter((c) => !chosenKeys.has(setupColumnKey(c)));
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
                onClick={() => onChange([...chosen, ...existing].slice(0, max))}
              >
                Add All
              </button>
            ) : null}
          </div>
          <div role="group" aria-label="Existing states" className="flex flex-wrap gap-1.5">
            {existing.map((c) => (
              <button
                key={c.status}
                type="button"
                disabled={full}
                onClick={() => add(c)}
                className="flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: palette.cardBorder,
                  color: palette.text,
                  backgroundColor: palette.card,
                }}
              >
                <PlusIcon size={10} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
            className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 text-[13px] font-medium transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: palette.cardBorder,
              backgroundColor: palette.card,
              color: palette.text,
            }}
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
    </div>
  );
}
