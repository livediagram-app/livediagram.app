// The project's cards as a sheet's card functions read them (docs/specs/029-sheets/formulas.md "Plan cards"): every
// live card (not archived, not in the Trash), and each field by the name the card panel gives it. Structural, so
// neither package imports the other: the sheets engine takes any object of this shape.
import { isArchived, isTrashed, statusLabel } from './board';
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { hasResult } from './calculated-result';
import { durationMinutes } from './duration-fields';
import { calculatedReaderOf, type CalculatedRead, type IsDoneStatus } from './calculated-fields';

type Scalar = string | number | boolean | null;

type CardSourceShape = {
  cards(): readonly { key: number }[];
  fieldOf(card: { key: number }, name: string): Scalar | undefined;
  knowsField(name: string): boolean;
  version: number;
};

// Built-in fields by the names people type, lower case.
const BUILT_IN: Record<string, string> = {
  title: 'title',
  state: 'status',
  status: 'status',
  assignee: 'assignee',
  'assigned to': 'assignee',
  owner: 'assignee',
  priority: 'priority',
  estimate: 'estimate',
  points: 'estimate',
  due: 'due',
  'due date': 'due',
  start: 'start',
  'start date': 'start',
  labels: 'labels',
  label: 'labels',
  description: 'description',
  type: '#type',
  'card type': '#type',
  number: '#key',
  key: '#key',
};

// A built-in field by a name people type ("State", "Due Date", "Owner"): its id, '#type' for the card's type, '#key' for
// its number; undefined for any other name (a custom field's label). The one table of those names.
export function builtInFieldOf(name: string): string | undefined {
  return BUILT_IN[name.trim().toLowerCase()];
}

// A field name that is a date: Due or Start, by any of their names.
export function isCardDateField(name: string): boolean {
  const id = builtInFieldOf(name);
  return id === 'due' || id === 'start';
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EPOCH = Date.UTC(1899, 11, 30);

function dateSerial(text: string): number | null {
  const m = DATE_RE.exec(text);
  return m
    ? Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EPOCH) / 86_400_000)
    : null;
}

// A list entry as text: a value as written, an entry object (a link, a checklist row) by its `text`.
function listEntryText(x: unknown): string {
  if (typeof x !== 'object' || x === null) return String(x);
  const text = 'text' in x ? x.text : undefined;
  return typeof text === 'string' ? text : '';
}

function asScalar(v: unknown): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const d = dateSerial(v);
    return d ?? v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(listEntryText).join(', ');
  if (typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string')
    return (v as { name: string }).name;
  return null;
}

export function cardSourceOf(
  items: Iterable<Item>,
  types: readonly ItemTypeDef[],
  opts: {
    statusNames?: ReadonlyMap<string, string>;
    version?: number;
    // The boards' done rule, for a Rollup's Count Done (none without it).
    isDone?: IsDoneStatus;
  } = {},
): CardSourceShape {
  const all = [...items];
  const live = all.filter((i) => !isArchived(i) && !isTrashed(i)).sort((a, b) => a.key - b.key);
  // Worked-out values (a Formula's Card fields read "#12 Title", a Rollup its children), made on first need.
  let calculated: CalculatedRead | undefined;
  const byKey = new Map(live.map((i) => [i.key, i]));
  // Custom fields by label, across the catalogue (the first type naming a label wins).
  const custom = new Map<string, string>();
  for (const t of types)
    for (const f of t.custom ?? [])
      if (!custom.has(f.label.toLowerCase())) custom.set(f.label.toLowerCase(), f.id);
  const idOf = (name: string): string | undefined =>
    builtInFieldOf(name) ?? custom.get(name.trim().toLowerCase());
  return {
    version: opts.version ?? 0,
    cards: () => live,
    knowsField: (name) => idOf(name) !== undefined,
    fieldOf: (card, name) => {
      const id = idOf(name);
      const item = byKey.get(card.key);
      if (!id || !item) return undefined;
      if (id === '#key') return item.key;
      const type = typeIn(types, item.type);
      if (id === '#type') return type.label;
      // A Formula, Rollup or Lookup is worked out (docs/specs/026-plan/item-types.md "Formula fields", "Rollup and
      // Lookup fields"): a day reads as a date, as a Date field does.
      const def = type.custom?.find((f) => f.id === id);
      if (def && hasResult(def) && type.fields.includes(id)) {
        calculated ??= calculatedReaderOf(new Map(all.map((i) => [i.id, i])), types, opts.isDone);
        return asScalar(calculated(def, item));
      }
      const v = item.fields[id];
      // A Duration as its whole minutes, a Time Spent field as its total (item-types.md "Duration").
      if (def?.kind === 'duration') return durationMinutes(def, v) ?? null;
      if (id === 'status')
        return typeof v === 'string' && v ? statusLabel(v, opts.statusNames) : null;
      return asScalar(v);
    },
  };
}
