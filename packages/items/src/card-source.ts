// The document's cards as a sheet's card functions read them (docs/specs/029-sheets/formulas.md "Plan cards"): every
// live card (not archived, not in the Trash), and each field by the name the card panel gives it. Structural, so
// neither package imports the other: the sheets engine takes any object of this shape.
import { isArchived, isTrashed, statusLabel } from './board';
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';

type Scalar = string | number | boolean | null;

export type CardSourceShape = {
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

function asScalar(v: unknown): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const d = dateSerial(v);
    return d ?? v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === 'object' && x !== null
          ? String((x as { text?: unknown }).text ?? '')
          : String(x),
      )
      .join(', ');
  if (typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string')
    return (v as { name: string }).name;
  return null;
}

export function cardSourceOf(
  items: Iterable<Item>,
  types: readonly ItemTypeDef[],
  opts: { statusNames?: ReadonlyMap<string, string>; version?: number } = {},
): CardSourceShape {
  const live = [...items]
    .filter((i) => !isArchived(i) && !isTrashed(i))
    .sort((a, b) => a.key - b.key);
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
      if (id === '#type') return typeIn(types, item.type).label;
      const v = item.fields[id];
      if (id === 'status')
        return typeof v === 'string' && v ? statusLabel(v, opts.statusNames) : null;
      return asScalar(v);
    },
  };
}
