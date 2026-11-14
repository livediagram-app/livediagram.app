// The board's filter (docs/specs/026-plan/board-widgets.md "The board's filter"; blueprint board-widgets.md): what the
// board's widgets narrow it to, kept on its set-up and shared with everyone on it. Kept as a saved filter is (a
// saved filter without its id and name), so Only Mine and a Due Soon window resolve for each viewer, on the day.
import type { QuickFilter } from './board';
import {
  resolveSavedFilter,
  SAVED_FILTER_TEXT_MAX,
  savedFilterFieldsValid,
  type SavedBoardFilter,
} from './saved-filters';
import { isObj } from './validate';

export type BoardFilter = Omit<SavedBoardFilter, 'id' | 'name'>;

// How long the Filter widget's words wait after the last key before they are written (never per keystroke).
export const BOARD_FILTER_TYPING_MS = 400;

const KEYS = ['text', 'mine', 'filters', 'person', 'type', 'priority', 'due'] as const;

// Whether a board's filter is one the api accepts: only what a saved filter narrows by, each well formed.
export function isBoardFilter(v: unknown): v is BoardFilter {
  if (!isObj(v)) return false;
  if (Object.keys(v).some((k) => !(KEYS as readonly string[]).includes(k))) return false;
  return savedFilterFieldsValid(v);
}

// Whether a board's filter narrows by anything.
function narrows(f: BoardFilter): boolean {
  return KEYS.some((k) => (k === 'text' ? !!f.text?.trim() : f[k] !== undefined));
}

// The board's filter a stored set-up keeps: a valid one that narrows, else none.
export function readBoardFilter(v: unknown): BoardFilter | undefined {
  return isBoardFilter(v) && narrows(v) ? v : undefined;
}

// The quick filter kept as the board's filter, or undefined when nothing narrows. The words are kept as typed (a
// trailing space survives the round trip while someone types), cut to SAVED_FILTER_TEXT_MAX.
export function boardFilterFrom(quick: QuickFilter): BoardFilter | undefined {
  const text = quick.text?.trim() ? quick.text.slice(0, SAVED_FILTER_TEXT_MAX) : undefined;
  const f: BoardFilter = {
    ...(text ? { text } : {}),
    ...(quick.mine !== undefined ? { mine: true as const } : {}),
    ...(quick.filters?.length ? { filters: quick.filters.map((c) => ({ ...c })) } : {}),
    ...(quick.person !== undefined ? { person: quick.person } : {}),
    ...(quick.type !== undefined ? { type: quick.type } : {}),
    ...(quick.priority !== undefined ? { priority: quick.priority } : {}),
    ...(quick.due ? { due: quick.due.from === undefined ? 'overdue' : 'soon' } : {}),
  };
  return narrows(f) ? f : undefined;
}

// The board's filter as the quick filter it means for this viewer, today (resolveSavedFilter); none is `{}`.
export function resolveBoardFilter(
  filter: BoardFilter | undefined,
  opts: Parameters<typeof resolveSavedFilter>[1],
): QuickFilter {
  return filter ? resolveSavedFilter(filter, opts) : {};
}

// A board's filter as a comparable string, its keys in one order; none is ''.
export function boardFilterKey(filter: BoardFilter | undefined): string {
  if (!filter) return '';
  return JSON.stringify(KEYS.map((k) => filter[k] ?? null));
}
