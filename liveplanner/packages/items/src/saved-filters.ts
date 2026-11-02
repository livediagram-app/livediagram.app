// Saved filters (docs/specs/026-plan/board-widgets.md "Saved filters"; blueprint board-widgets.md "Filter field and
// saved filters"): a board's named quick filters, kept on its set-up for everyone, applied by each person as their own
// quick filter. Only Mine and the Due Soon windows are kept as what they mean, never as the saver's id or the day it
// was saved, so they resolve for whoever applies one, on the day.
import type { QuickDueWindow, QuickFilter } from './board';
import { isCardSearchFilters, type CardSearchFilter } from './card-search';
import { isPriority, type Priority } from './fields';
import { dayKey } from './plan-view-dates';
import { ITEM_TYPE_PATTERN } from './limits';
import { isObj } from './validate';

// The most saved filters a board keeps (as plan views keep 8 filters).
export const SAVED_FILTERS_MAX = 8;
export const SAVED_FILTER_NAME_MAX = 40;
export const SAVED_FILTER_TEXT_MAX = 200;
const ID_MAX = 40;
const PERSON_MAX = 128;

// A Due Soon narrowing as it was meant: due by yesterday, or due from today to the widget's window.
export type SavedDueWindow = 'overdue' | 'soon';

export interface SavedBoardFilter {
  id: string;
  name: string;
  text?: string;
  // Only Mine: the viewer's cards, whoever applies it.
  mine?: true;
  filters?: CardSearchFilter[];
  person?: string;
  type?: string;
  priority?: Priority;
  due?: SavedDueWindow;
}

const isName = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= SAVED_FILTER_NAME_MAX;

// One saved filter as validation accepts it; anything else is refused.
function isSavedBoardFilter(v: unknown): v is SavedBoardFilter {
  if (!isObj(v)) return false;
  if (typeof v['id'] !== 'string' || !v['id'] || v['id'].length > ID_MAX) return false;
  if (!isName(v['name'])) return false;
  if (
    v['text'] !== undefined &&
    (typeof v['text'] !== 'string' || v['text'].length > SAVED_FILTER_TEXT_MAX)
  )
    return false;
  if (v['mine'] !== undefined && v['mine'] !== true) return false;
  if (v['filters'] !== undefined && !isCardSearchFilters(v['filters'])) return false;
  if (
    v['person'] !== undefined &&
    (typeof v['person'] !== 'string' || !v['person'] || v['person'].length > PERSON_MAX)
  )
    return false;
  if (
    v['type'] !== undefined &&
    (typeof v['type'] !== 'string' || !ITEM_TYPE_PATTERN.test(v['type']))
  )
    return false;
  if (v['priority'] !== undefined && !isPriority(v['priority'])) return false;
  if (v['due'] !== undefined && v['due'] !== 'overdue' && v['due'] !== 'soon') return false;
  return true;
}

// A board set-up's saved filters as the api accepts them: at most SAVED_FILTERS_MAX, each well formed, ids unique.
export function isSavedBoardFilters(v: unknown): v is SavedBoardFilter[] {
  if (!Array.isArray(v) || v.length > SAVED_FILTERS_MAX) return false;
  if (!v.every(isSavedBoardFilter)) return false;
  return new Set(v.map((f) => f.id)).size === v.length;
}

// The saved filters a stored set-up keeps: the well-formed ones, each id once, at most SAVED_FILTERS_MAX. Undefined
// when there are none.
export function readSavedFilters(v: unknown): SavedBoardFilter[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: SavedBoardFilter[] = [];
  for (const f of v) {
    if (out.length >= SAVED_FILTERS_MAX) break;
    if (!isSavedBoardFilter(f) || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out.length ? out : undefined;
}

// Whether a quick filter narrows the board at all (the words, Only Mine, a chip or a widget narrowing).
export function quickNarrows(quick: QuickFilter): boolean {
  return (
    !!quick.text?.trim() ||
    quick.mine !== undefined ||
    !!quick.filters?.length ||
    quick.person !== undefined ||
    quick.type !== undefined ||
    quick.priority !== undefined ||
    quick.due !== undefined
  );
}

// The quick filter kept as a saved filter named `name`: Only Mine as a flag, a Due Soon window as what it means.
export function savedFilterFrom(quick: QuickFilter, name: string, id: string): SavedBoardFilter {
  const text = quick.text?.trim().slice(0, SAVED_FILTER_TEXT_MAX);
  return {
    id,
    name: name.trim().slice(0, SAVED_FILTER_NAME_MAX),
    ...(text ? { text } : {}),
    ...(quick.mine !== undefined ? { mine: true as const } : {}),
    ...(quick.filters?.length ? { filters: quick.filters.map((f) => ({ ...f })) } : {}),
    ...(quick.person !== undefined ? { person: quick.person } : {}),
    ...(quick.type !== undefined ? { type: quick.type } : {}),
    ...(quick.priority !== undefined ? { priority: quick.priority } : {}),
    ...(quick.due ? { due: quick.due.from === undefined ? 'overdue' : 'soon' } : {}),
  };
}

// A saved filter as the quick filter it means for this viewer, today: Only Mine their own cards (left out for someone
// with no person id), a Due Soon window counted from `today` (a day number), the board's done statuses left out.
export function resolveSavedFilter(
  saved: SavedBoardFilter,
  opts: { mine: string | null; today: number; soonDays: number; finished: readonly string[] },
): QuickFilter {
  let due: QuickDueWindow | undefined;
  if (saved.due) {
    const window: QuickDueWindow =
      saved.due === 'overdue'
        ? { to: dayKey(opts.today - 1) }
        : { from: dayKey(opts.today), to: dayKey(opts.today + opts.soonDays) };
    due = opts.finished.length ? { ...window, finished: [...opts.finished] } : window;
  }
  return {
    ...(saved.text ? { text: saved.text } : {}),
    ...(saved.mine && opts.mine ? { mine: opts.mine } : {}),
    ...(saved.filters?.length ? { filters: saved.filters.map((f) => ({ ...f })) } : {}),
    ...(saved.person !== undefined ? { person: saved.person } : {}),
    ...(saved.type !== undefined ? { type: saved.type } : {}),
    ...(saved.priority !== undefined ? { priority: saved.priority } : {}),
    ...(due ? { due } : {}),
  };
}

// Whether another saved filter on the board already has this name (case and outer spaces aside).
export function savedFilterNameTaken(
  list: readonly SavedBoardFilter[] | undefined,
  name: string,
  exceptId?: string,
): boolean {
  const n = name.trim().toLowerCase();
  return (list ?? []).some((f) => f.id !== exceptId && f.name.trim().toLowerCase() === n);
}

export function addSavedFilter(
  list: readonly SavedBoardFilter[] | undefined,
  filter: SavedBoardFilter,
): SavedBoardFilter[] {
  const now = list ?? [];
  return now.length >= SAVED_FILTERS_MAX ? [...now] : [...now, filter];
}

export function renameSavedFilter(
  list: readonly SavedBoardFilter[],
  id: string,
  name: string,
): SavedBoardFilter[] {
  return list.map((f) =>
    f.id === id ? { ...f, name: name.trim().slice(0, SAVED_FILTER_NAME_MAX) } : f,
  );
}

// The saved filter `id` keeping today's quick filter, its id and name kept.
export function updateSavedFilter(
  list: readonly SavedBoardFilter[],
  id: string,
  quick: QuickFilter,
): SavedBoardFilter[] {
  return list.map((f) => (f.id === id ? savedFilterFrom(quick, f.name, f.id) : f));
}

export function removeSavedFilter(
  list: readonly SavedBoardFilter[],
  id: string,
): SavedBoardFilter[] {
  return list.filter((f) => f.id !== id);
}
