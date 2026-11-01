// The numbers field widgets read (docs/specs/026-plan/board-widgets.md "Field widgets"): one field's values over the
// cards a board shows, summed up once per field and kept until the cards, the field or the day change, so a header of
// several field widgets (and the gallery's previews of one field's views) costs one pass over the cards per field.
// Pure.
import {
  currencyText,
  dayNumber,
  durationMinutes,
  durationText,
  fieldPeople,
  fieldShapeOf,
  finishedStatuses,
  itemStatus,
  percentValue,
  rangeEndOf,
  todayNumber,
  voteTotalOf,
  checklistRowsProgress,
  type BoardField,
  type CalculatedRead,
  type CustomFieldDef,
  type FieldShape,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { DUE_SOON_DAYS } from './widget-stats';

// How many bars a Spread draws, and how many weeks a Timeline looks ahead.
export const SPREAD_BINS = 8;
export const TIMELINE_WEEKS = 4;

type NumberUnit = Extract<FieldShape, { kind: 'number' }>['unit'];

export type NumberSummary = {
  shape: 'number';
  unit: NumberUnit;
  // A Rating's top score; a Currency's code.
  scale?: number;
  currency?: string;
  cards: number;
  filled: number;
  sum: number;
  min: number;
  max: number;
  // Cards per eighth of min..max (all in the first when every value is the same).
  bins: number[];
};

export type CategoryValue = { key: string; label: string; count: number; color?: string };

export type CategorySummary = {
  shape: 'category';
  from: Extract<FieldShape, { kind: 'category' }>['from'];
  cards: number;
  filled: number;
  // Commonest first; a Choice's and Multiple Choice's in option order among equals.
  values: CategoryValue[];
};

export type TickedSummary = {
  shape: 'ticked';
  cards: number;
  filled: number;
  // Ticked of all: cards for a Checkbox, rows for a Checklist.
  ticked: number;
  total: number;
};

export type DateSummary = {
  shape: 'date';
  cards: number;
  filled: number;
  // Cards not done: overdue, due today to DUE_SOON_DAYS out, and per Timeline bar (overdue, then each week ahead).
  overdue: number;
  soon: number;
  weeks: number[];
  // Due in the TIMELINE_WEEKS ahead, not done.
  ahead: number;
};

export type FieldSummary = NumberSummary | CategorySummary | TickedSummary | DateSummary;

export type FieldReading = {
  setup: Pick<PlanBoardSetup, 'columns' | 'doneColumnId'>;
  now: Date;
  // A Calculated field's value on a card (calculatedReaderOf); without one a Calculated field reads none.
  read?: CalculatedRead | undefined;
};

type Value =
  | { kind: 'number'; n: number }
  | { kind: 'category'; keys: { key: string; label: string; color?: string }[] }
  | { kind: 'ticked'; ticked: number; total: number }
  | { kind: 'date'; day: number };

// A card's value for a field, as its shape reads it; undefined for none.
function valueOf(
  def: CustomFieldDef,
  shape: FieldShape,
  item: Item,
  read: CalculatedRead | undefined,
): Value | undefined {
  const raw = def.kind === 'calculated' ? read?.(def, item) : item.fields[def.id];
  if (raw === undefined || raw === null || raw === '') return undefined;
  switch (shape.kind) {
    case 'number': {
      let n: number | undefined;
      if (def.kind === 'duration') n = durationMinutes(def, item.fields[def.id]);
      else if (shape.unit === 'percent') n = percentValue(raw);
      else if (shape.unit === 'votes') n = voteTotalOf(raw) || undefined;
      else if (shape.unit === 'rating')
        n =
          typeof raw === 'number' && Number.isInteger(raw) && raw >= 1
            ? Math.min(raw, shape.scale)
            : undefined;
      else n = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
      return n === undefined ? undefined : { kind: 'number', n };
    }
    case 'category': {
      if (shape.from === 'person') {
        const people = fieldPeople(def, raw);
        return people.length
          ? {
              kind: 'category',
              keys: people.map((p) => ({ key: p.id, label: p.name, color: p.color })),
            }
          : undefined;
      }
      const list = Array.isArray(raw) ? raw : [raw];
      const keys = [...new Set(list.filter((v): v is string => typeof v === 'string' && v !== ''))];
      return keys.length
        ? { kind: 'category', keys: keys.map((k) => ({ key: k, label: k })) }
        : undefined;
    }
    case 'ticked': {
      if (shape.from === 'checklist') {
        const p = checklistRowsProgress(raw);
        return p ? { kind: 'ticked', ticked: p.done, total: p.total } : undefined;
      }
      return { kind: 'ticked', ticked: raw === true ? 1 : 0, total: 1 };
    }
    case 'date': {
      const text = shape.from === 'daterange' ? rangeEndOf(raw, 'due') : raw;
      const day = dayNumber(text);
      return day === undefined ? undefined : { kind: 'date', day };
    }
  }
}

// Whether a card is offered the field: its type is one of the board's types that has it.
const offeredBy = (field: BoardField) => {
  const ids = new Set(field.types.map((t) => t.id));
  return (item: Item) => ids.has(item.type);
};

// One field's summary over the board's cards (board-widgets.md "What each view reads"). Undefined for a field no
// widget reads.
export function fieldSummary(
  field: BoardField,
  items: readonly Item[],
  reading: FieldReading,
): FieldSummary | undefined {
  const { def } = field;
  const shape = fieldShapeOf(def);
  if (!shape) return undefined;
  const offered = offeredBy(field);
  let cards = 0;
  let filled = 0;
  if (shape.kind === 'number') {
    const values: number[] = [];
    let sum = 0;
    for (const it of items) {
      if (!offered(it)) continue;
      cards += 1;
      const v = valueOf(def, shape, it, reading.read);
      if (v?.kind !== 'number') continue;
      values.push(v.n);
      sum += v.n;
    }
    filled = values.length;
    let min = Infinity;
    let max = -Infinity;
    for (const n of values) {
      if (n < min) min = n;
      if (n > max) max = n;
    }
    const bins: number[] = new Array<number>(SPREAD_BINS).fill(0);
    const width = max - min;
    for (const n of values) {
      const at =
        width > 0 ? Math.min(SPREAD_BINS - 1, Math.floor(((n - min) / width) * SPREAD_BINS)) : 0;
      bins[at]! += 1;
    }
    return {
      shape: 'number',
      unit: shape.unit,
      ...(shape.unit === 'rating' ? { scale: shape.scale } : {}),
      ...(def.currency ? { currency: def.currency } : {}),
      cards,
      filled,
      sum,
      min: filled ? min : 0,
      max: filled ? max : 0,
      bins,
    };
  }
  if (shape.kind === 'category') {
    const counts = new Map<string, CategoryValue>();
    for (const it of items) {
      if (!offered(it)) continue;
      cards += 1;
      const v = valueOf(def, shape, it, reading.read);
      if (v?.kind !== 'category') continue;
      filled += 1;
      for (const k of v.keys) {
        const row = counts.get(k.key);
        if (row) row.count += 1;
        else counts.set(k.key, { ...k, count: 1 });
      }
    }
    const options = def.options ?? [];
    const rank = (k: string) => {
      const i = options.indexOf(k);
      return i < 0 ? options.length : i;
    };
    const values = [...counts.values()].sort(
      (a, b) => b.count - a.count || rank(a.key) - rank(b.key) || a.label.localeCompare(b.label),
    );
    return { shape: 'category', from: shape.from, cards, filled, values };
  }
  if (shape.kind === 'ticked') {
    let ticked = 0;
    let total = 0;
    for (const it of items) {
      if (!offered(it)) continue;
      cards += 1;
      const v = valueOf(def, shape, it, reading.read);
      if (v?.kind !== 'ticked') {
        // An unticked Checkbox is no value but still a card that could be ticked.
        if (shape.from === 'checkbox') total += 1;
        continue;
      }
      if (v.ticked > 0 || shape.from === 'checklist') filled += 1;
      ticked += v.ticked;
      total += v.total;
    }
    return { shape: 'ticked', cards, filled, ticked, total };
  }
  // A date: counted against the viewer's today, cards in a done column left out of what is due.
  const finished = new Set(finishedStatuses(reading.setup));
  const today = todayNumber(reading.now);
  const weeks: number[] = new Array<number>(TIMELINE_WEEKS + 1).fill(0);
  let overdue = 0;
  let soon = 0;
  for (const it of items) {
    if (!offered(it)) continue;
    cards += 1;
    const v = valueOf(def, shape, it, reading.read);
    if (v?.kind !== 'date') continue;
    filled += 1;
    const status = itemStatus(it);
    if (status !== undefined && finished.has(status)) continue;
    if (v.day < today) {
      overdue += 1;
      weeks[0]! += 1;
      continue;
    }
    if (v.day <= today + DUE_SOON_DAYS) soon += 1;
    const week = Math.floor((v.day - today) / 7);
    if (week < TIMELINE_WEEKS) weeks[week + 1]! += 1;
  }
  const ahead = weeks.slice(1).reduce((n, w) => n + w, 0);
  return { shape: 'date', cards, filled, overdue, soon, weeks, ahead };
}

// Summaries kept per list of cards (the board's, memoised by the board), then per field: a summary stands while its
// field's definition, the types offering it, the reader, the day and the board's done columns are the ones it was
// made with. The lists are weakly held, so a list the board has moved on from is dropped with its summaries.
type Kept = {
  def: CustomFieldDef;
  types: string;
  read: CalculatedRead | undefined;
  day: number;
  finished: string;
  summary: FieldSummary | undefined;
};
const kept = new WeakMap<readonly Item[], Map<string, Kept>>();

export function fieldSummaryOf(
  field: BoardField,
  items: readonly Item[],
  reading: FieldReading,
): FieldSummary | undefined {
  let byField = kept.get(items);
  if (!byField) {
    byField = new Map();
    kept.set(items, byField);
  }
  const types = field.types.map((t) => t.id).join(',');
  const day = todayNumber(reading.now);
  const finished = finishedStatuses(reading.setup).join(',');
  const hit = byField.get(field.def.id);
  if (
    hit &&
    hit.def === field.def &&
    hit.types === types &&
    hit.read === reading.read &&
    hit.day === day &&
    hit.finished === finished
  )
    return hit.summary;
  const summary = fieldSummary(field, items, reading);
  byField.set(field.def.id, { def: field.def, types, read: reading.read, day, finished, summary });
  return summary;
}

// How many of a field's cards hold a value, for every field at once: what For You ranks fields by. One pass over the
// cards, each card reading only the fields its type offers; kept per list of cards and list of fields like the
// summaries.
const fills = new WeakMap<
  readonly Item[],
  { fields: readonly BoardField[]; read: CalculatedRead | undefined; out: Map<string, Fill> }
>();
export type Fill = { cards: number; filled: number };

export function fieldFills(
  fields: readonly BoardField[],
  items: readonly Item[],
  read?: CalculatedRead,
): ReadonlyMap<string, Fill> {
  const hit = fills.get(items);
  if (hit && hit.fields === fields && hit.read === read) return hit.out;
  const byType = new Map<string, { field: BoardField; shape: FieldShape }[]>();
  const out = new Map<string, Fill>();
  for (const f of fields) {
    out.set(f.def.id, { cards: 0, filled: 0 });
    const shape = fieldShapeOf(f.def)!;
    for (const t of f.types) {
      const list = byType.get(t.id) ?? [];
      list.push({ field: f, shape });
      byType.set(t.id, list);
    }
  }
  for (const it of items) {
    for (const { field, shape } of byType.get(it.type) ?? []) {
      const row = out.get(field.def.id)!;
      row.cards += 1;
      const v = valueOf(field.def, shape, it, read);
      // An unticked Checkbox holds no value worth suggesting.
      if (
        v &&
        !(
          v.kind === 'ticked' &&
          v.ticked === 0 &&
          shape.kind === 'ticked' &&
          shape.from === 'checkbox'
        )
      )
        row.filled += 1;
    }
  }
  fills.set(items, { fields, read, out });
  return out;
}

// A number as its field writes it (board-widgets.md "Sum"): "£12,400", "14h 30m", "62%", "4.2", "1,250.5".
export function fieldNumberText(
  summary: Pick<NumberSummary, 'unit' | 'currency'>,
  n: number,
): string {
  switch (summary.unit) {
    case 'currency':
      return currencyText(Math.round(n * 100) / 100, summary.currency);
    case 'duration':
      return durationText(Math.round(n));
    case 'percent':
      return `${Math.round(n)}%`;
    case 'rating':
      return n.toFixed(1);
    default:
      return n.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(n) ? 0 : 1 });
  }
}

// The card types a field widget reads, as its name says them: "Feature", "Feature and Bug", "Feature, Bug and Task".
export function typeNamesText(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
