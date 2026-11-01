// What the four readers share (docs/specs/026-plan/tracker-import.md "What it makes"): a CSV header read by its names
// (case, spacing and punctuation aside), the columns in the order cards name them, and the cleaning every card field
// gets on its way in.
import {
  ITEM_CHECKLIST_MAX,
  ITEM_CHECKLIST_TEXT_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_LABEL_MAX,
  ITEM_LABELS_MAX,
  ITEM_TITLE_MAX,
  ITEM_UNKNOWN_STRING_MAX,
  PLAN_COLUMN_NAME_MAX,
} from '../limits';
import { statusKey } from '../status-names';
import { cleanText } from './tracker-text';
import type { TrackerCard, TrackerExtra, TrackerExtraValue } from './tracker-model';
import { TRACKER_CHOICE_MAX } from './tracker-model';

// A Choice option's longest (CUSTOM_CHOICE_OPTION_MAX).
const CHOICE_OPTION_MAX = 100;

export type Row = readonly string[];

// A CSV header by name: each header's key to its first index, and every index of a repeated one (Jira writes one
// Labels, Comment, Sprint and Attachment column per value).
export interface Header {
  at: (key: string) => number | undefined;
  all: (key: string) => readonly number[];
  // The first index whose key contains `part` ("Custom field (Story Points)" for `storypoint`).
  containing: (part: string) => number | undefined;
}

export function readHeader(row: Row | undefined): Header {
  const keys = (row ?? []).map((h) => statusKey(h));
  const first = new Map<string, number>();
  const every = new Map<string, number[]>();
  keys.forEach((k, i) => {
    if (!first.has(k)) first.set(k, i);
    every.set(k, [...(every.get(k) ?? []), i]);
  });
  return {
    at: (key) => first.get(key),
    all: (key) => every.get(key) ?? [],
    containing: (part) => {
      const i = keys.findIndex((k) => k.includes(part));
      return i < 0 ? undefined : i;
    },
  };
}

export function cellAt(row: Row, i: number | undefined): string {
  return i === undefined ? '' : (row[i] ?? '');
}

export function isEmptyRow(row: Row): boolean {
  return row.every((cell) => cell.trim() === '');
}

export const cardTitle = (raw: unknown) => cleanText(raw, ITEM_TITLE_MAX);
export const cardDescription = (raw: unknown) => cleanText(raw, ITEM_DESCRIPTION_MAX);
export const extraText = (raw: unknown) => cleanText(raw, ITEM_UNKNOWN_STRING_MAX);

// Labels as a card holds them: each cleaned and cut, the same label once, at most a card's count.
export function cardLabels(raw: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const l of raw) {
    const label = cleanText(l, ITEM_LABEL_MAX);
    if (label && !out.includes(label) && out.length < ITEM_LABELS_MAX) out.push(label);
  }
  return out;
}

// A checklist row: its text cleaned and cut; empty rows dropped, at most a card's count.
export function checklistRows(
  rows: readonly { text: unknown; done: boolean }[],
): { text: string; done: boolean }[] {
  const out: { text: string; done: boolean }[] = [];
  for (const r of rows) {
    const text = cleanText(r.text, ITEM_CHECKLIST_TEXT_MAX);
    if (text && out.length < ITEM_CHECKLIST_MAX) out.push({ text, done: r.done });
  }
  return out;
}

// The columns in the order cards (or the source's own list) name them, each named once, cut to a column's length.
export class ColumnOrder {
  private readonly names: string[] = [];
  private readonly keys = new Map<string, string>();

  add(raw: unknown): string {
    const name = cleanText(raw, PLAN_COLUMN_NAME_MAX);
    const key = statusKey(name);
    const known = this.keys.get(key);
    if (known !== undefined) return known;
    this.keys.set(key, name);
    this.names.push(name);
    return name;
  }

  get list(): readonly string[] {
    return this.names;
  }
}

// A card with every list empty, for a reader to fill.
export function blankCard(title: string, column: string): TrackerCard {
  return {
    title,
    column,
    description: '',
    labels: [],
    checklist: [],
    comments: [],
    links: [],
    extras: {},
  };
}

// An extra's values gathered across cards, then made a field only when some card has one: a Choice when it should be
// one and its distinct values fit, else Text.
export class ExtraCollector {
  private readonly seen = new Map<string, string[]>();
  private readonly defs: readonly TrackerExtra[];

  constructor(defs: readonly TrackerExtra[]) {
    this.defs = defs;
  }

  // Notes a card's text value of an extra, cleaned (an empty one is none).
  text(card: Record<string, TrackerExtraValue>, key: string, raw: unknown): void {
    const def = this.defs.find((d) => d.key === key)!;
    const value = def.kind === 'choice' ? cleanText(raw, CHOICE_OPTION_MAX) : extraText(raw);
    if (!value) return;
    card[key] = value;
    const list = this.seen.get(key) ?? [];
    if (!list.includes(value)) list.push(value);
    this.seen.set(key, list);
  }

  // Notes that a card filled a Person extra.
  person(card: Record<string, TrackerExtraValue>, key: string, value: TrackerExtraValue): void {
    if (value.length === 0) return;
    card[key] = value;
    this.seen.set(key, this.seen.get(key) ?? ['person']);
  }

  // The extras some card filled, in their order; a Choice of too many values as Text.
  fields(): TrackerExtra[] {
    return this.defs
      .filter((d) => this.seen.has(d.key))
      .map((d) => {
        if (d.kind !== 'choice') return d;
        const options = this.seen.get(d.key)!;
        return options.length <= TRACKER_CHOICE_MAX
          ? { ...d, options }
          : { key: d.key, label: d.label, kind: 'text' as const };
      });
  }
}
