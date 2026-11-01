'use client';

// The selection bar's pickers (docs/specs/026-plan/plan-board.md "Several cards at once"): Move To, Assign, Priority,
// Labels and Set Field, each a small panel of option rows drawn over the page (AnchoredPopover), so it reads at its own
// size whatever the canvas zoom. Picking writes once for every selected card and closes the panel.
import { useState } from 'react';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  labelUsage,
  type CustomFieldDef,
  type Item,
  type ItemFieldValue,
  type ItemPerson,
  type PlanColumn,
  type Priority,
} from '@liveplanner/items';
import { BackBar, TextInput } from '@liveplanner/ui';
import { OptionRows, type OptionRow } from './OptionRows';
import { PersonDisc } from './PersonDisc';
import { PRIORITY_COLOURS } from './plan-palette';
import { labelColour } from './label-colour';
import { selectionLabels, type SetFieldKind } from './board-selection-edits';

const PANEL =
  'flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900';
const HEADING =
  'px-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

const Dot = ({ colour }: { colour?: string | undefined }) => (
  <span
    aria-hidden
    className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
    style={colour ? { backgroundColor: colour, borderColor: colour } : undefined}
  />
);

export function MoveToMenu({
  columns,
  onPick,
}: {
  columns: readonly PlanColumn[];
  onPick: (status: string) => void;
}) {
  return (
    <div className={PANEL}>
      <span className={HEADING}>Move To</span>
      <OptionRows
        kind="action"
        label="Move the selected cards to"
        rows={columns.map((c) => ({ id: c.status, label: c.name, icon: <Dot colour={c.color} /> }))}
        onPick={onPick}
      />
    </div>
  );
}

export function AssignMenu({
  people,
  onPick,
}: {
  people: readonly ItemPerson[];
  onPick: (person: ItemPerson | null) => void;
}) {
  const rows: OptionRow[] = [
    ...people.map((p) => ({ id: p.id, label: p.name, icon: <PersonDisc person={p} /> })),
    { id: '', label: 'Unassign' },
  ];
  return (
    <div className={PANEL}>
      <span className={HEADING}>Assign To</span>
      <OptionRows
        kind="action"
        label="Assign the selected cards to"
        rows={rows}
        onPick={(id) => onPick(id ? (people.find((p) => p.id === id) ?? null) : null)}
      />
    </div>
  );
}

export function PriorityMenu({ onPick }: { onPick: (priority: Priority | null) => void }) {
  return (
    <div className={PANEL}>
      <span className={HEADING}>Priority</span>
      <OptionRows
        kind="action"
        label="Set the selected cards' priority"
        rows={[
          ...PRIORITIES.map((p) => ({
            id: p,
            label: PRIORITY_LABELS[p],
            icon: <Dot colour={PRIORITY_COLOURS[p]} />,
          })),
          { id: '', label: 'No Priority', icon: <Dot /> },
        ]}
        onPick={(id) => onPick(id ? (id as Priority) : null)}
      />
    </div>
  );
}

export function LabelsMenu({
  planItems,
  selected,
  onAdd,
  onRemove,
}: {
  // Every card of the plan, for its labels (most used first).
  planItems: Iterable<Item>;
  selected: readonly Item[];
  onAdd: (label: string) => void;
  onRemove: (label: string) => void;
}) {
  const [text, setText] = useState('');
  const q = text.trim().toLowerCase();
  const all = labelUsage(planItems).map((u) => u.label);
  const shown = q ? all.filter((l) => l.toLowerCase().includes(q)) : all;
  const exact = all.some((l) => l.toLowerCase() === q);
  const carried = selectionLabels(selected);
  const chip = (l: string) => (
    <span
      aria-hidden
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: labelColour(l) }}
    />
  );
  return (
    <div className={PANEL}>
      <span className={HEADING}>Add Label</span>
      <div className="px-1">
        <TextInput
          compact
          aria-label="Find or create a label"
          placeholder="Find or create a label"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && text.trim())
              onAdd(shown[0] && !exact ? text.trim() : (shown[0] ?? text.trim()));
          }}
        />
      </div>
      <OptionRows
        kind="action"
        label="Add a label to the selected cards"
        rows={[
          ...shown.slice(0, 12).map((l) => ({ id: `+${l}`, label: l, icon: chip(l) })),
          ...(q && !exact ? [{ id: `+${text.trim()}`, label: `Create “${text.trim()}”` }] : []),
        ]}
        onPick={(id) => onAdd(id.slice(1))}
      />
      {carried.length ? (
        <>
          <span className={HEADING}>Remove</span>
          <OptionRows
            kind="action"
            label="Take a label off the selected cards"
            rows={carried.map((l) => ({ id: `-${l}`, label: l, icon: chip(l) }))}
            onPick={(id) => onRemove(id.slice(1))}
          />
        </>
      ) : null}
    </div>
  );
}

// A value typed or picked for one field, as the field stores it, or undefined while it is not a value yet.
export function fieldValueOf(
  field: CustomFieldDef & { kind: SetFieldKind },
  raw: string,
): ItemFieldValue | undefined {
  const t = raw.trim();
  if (field.kind === 'text') return t ? t : undefined;
  if (field.kind === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
  const n = Number(t);
  if (!t || !Number.isFinite(n)) return undefined;
  if (field.kind === 'percent') return Math.max(0, Math.min(100, Math.round(n)));
  return n;
}

export function SetFieldMenu({
  fields,
  people,
  onPick,
}: {
  fields: readonly (CustomFieldDef & { kind: SetFieldKind })[];
  people: readonly ItemPerson[];
  onPick: (fieldId: string, value: ItemFieldValue | null) => void;
}) {
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [raw, setRaw] = useState('');
  const field = fields.find((f) => f.id === fieldId);
  if (!field)
    return (
      <div className={PANEL}>
        <span className={HEADING}>Set Field</span>
        {fields.length ? (
          <OptionRows
            kind="action"
            label="Pick a field to set"
            rows={fields.map((f) => ({ id: f.id, label: f.label }))}
            onPick={(id) => {
              setFieldId(id);
              setRaw('');
            }}
          />
        ) : (
          <p className="px-2 py-1.5 text-[12px] text-slate-500 dark:text-slate-400">
            The selected cards share no field to set.
          </p>
        )}
      </div>
    );
  const back = (
    <BackBar label="Set Field" current={field.label} onClick={() => setFieldId(null)} gap="tight" />
  );
  const clear = { id: '\u0000clear', label: 'Clear' };
  const pick = (id: string, value: ItemFieldValue | null) =>
    id === clear.id ? onPick(field.id, null) : onPick(field.id, value);
  if (
    field.kind === 'choice' ||
    field.kind === 'checkbox' ||
    field.kind === 'rating' ||
    field.kind === 'person'
  ) {
    const rows: OptionRow[] =
      field.kind === 'choice'
        ? (field.options ?? []).map((o) => ({ id: o, label: o }))
        : field.kind === 'checkbox'
          ? [
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
            ]
          : field.kind === 'person'
            ? people.map((p) => ({ id: p.id, label: p.name, icon: <PersonDisc person={p} /> }))
            : Array.from({ length: field.scale ?? 5 }, (_, i) => ({
                id: String(i + 1),
                label: `${i + 1} of ${field.scale ?? 5}`,
              }));
    const valueOf = (id: string): ItemFieldValue =>
      field.kind === 'checkbox'
        ? id === 'yes'
        : field.kind === 'rating'
          ? Number(id)
          : field.kind === 'person'
            ? { ...people.find((p) => p.id === id)! }
            : id;
    return (
      <div className={PANEL}>
        {back}
        <OptionRows
          kind="action"
          label={`Set ${field.label}`}
          rows={[...rows, clear]}
          onPick={(id) => pick(id, id === clear.id ? null : valueOf(id))}
        />
      </div>
    );
  }
  const value = fieldValueOf(field, raw);
  return (
    <div className={PANEL}>
      {back}
      <form
        className="flex items-center gap-1.5 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (value !== undefined) onPick(field.id, value);
        }}
      >
        <TextInput
          compact
          autoFocus
          aria-label={field.label}
          type={field.kind === 'date' ? 'date' : field.kind === 'text' ? 'text' : 'number'}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          type="submit"
          disabled={value === undefined}
          className="h-7 shrink-0 cursor-pointer rounded-md bg-brand-700 px-2.5 text-[12px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-600"
        >
          Set
        </button>
      </form>
      <OptionRows
        kind="action"
        label={`Clear ${field.label}`}
        rows={[clear]}
        onPick={() => onPick(field.id, null)}
      />
    </div>
  );
}
