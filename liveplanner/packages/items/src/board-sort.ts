// Sort Cards (docs/specs/026-plan/plan-board.md "The board set-up"): a board orders each column's cards by up to two
// fields, then by rank. Pure: the board's projection runs it, the menu lists what it can sort by, and the agents'
// listing orders a column's cards the same way.
import type { Item } from './item';
import type { CustomFieldKind, ItemTypeDef } from './item-types';
import { PRIORITIES } from './fields';
import { CUSTOM_FIELD_ID_PATTERN, customFieldOf } from './type-catalogue';
import { isObj } from './validate';
import { statusKey } from './status-names';

// Sort By and Then By.
export const BOARD_SORT_LEVELS_MAX = 2;

export const BOARD_SORT_DIRS = ['asc', 'desc'] as const;
// 'asc' is lowest (or earliest, or a Choice's first option) first.
export type BoardSortDir = (typeof BOARD_SORT_DIRS)[number];

export interface BoardSortLevel {
  // A built-in (BOARD_SORT_BUILT_INS) or a custom field id.
  field: string;
  dir: BoardSortDir;
}

export const BOARD_SORT_BUILT_INS = ['priority', 'estimate', 'start', 'due'] as const;
type BuiltInSortField = (typeof BOARD_SORT_BUILT_INS)[number];

// The custom field kinds a board sorts by.
export const BOARD_SORT_KINDS: readonly CustomFieldKind[] = [
  'number',
  'currency',
  'date',
  'rating',
  'choice',
];

export type BoardSortKind = 'priority' | 'number' | 'currency' | 'date' | 'rating' | 'choice';

export interface BoardSortField {
  id: string;
  label: string;
  kind: BoardSortKind;
}

const BUILT_IN_SORT_FIELDS: Readonly<Record<BuiltInSortField, BoardSortField>> = {
  priority: { id: 'priority', label: 'Priority', kind: 'priority' },
  estimate: { id: 'estimate', label: 'Estimate', kind: 'number' },
  start: { id: 'start', label: 'Start Date', kind: 'date' },
  due: { id: 'due', label: 'Due Date', kind: 'date' },
};

const isBuiltIn = (field: string): field is BuiltInSortField =>
  (BOARD_SORT_BUILT_INS as readonly string[]).includes(field);

// The fields a board showing `types` can sort by: the built-ins one of them has, then every sortable custom field in
// catalogue order, each once (named as the first type that has it names it).
export function boardSortFieldsOf(types: readonly ItemTypeDef[]): BoardSortField[] {
  const out: BoardSortField[] = BOARD_SORT_BUILT_INS.filter((f) =>
    types.some((t) => t.fields.includes(f)),
  ).map((f) => BUILT_IN_SORT_FIELDS[f]);
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (!BOARD_SORT_KINDS.includes(c.kind) || !t.fields.includes(c.id)) continue;
      if (out.some((f) => f.id === c.id)) continue;
      out.push({ id: c.id, label: c.label, kind: c.kind as BoardSortKind });
    }
  return out;
}

// A sort field by id, offered or not (a board keeps a sort its types no longer offer); undefined when no type has
// ever had it.
export function boardSortFieldOf(
  id: string,
  types: readonly ItemTypeDef[],
): BoardSortField | undefined {
  if (isBuiltIn(id)) return BUILT_IN_SORT_FIELDS[id];
  for (const t of types) {
    const c = customFieldOf(t, id);
    if (c && BOARD_SORT_KINDS.includes(c.kind))
      return { id: c.id, label: c.label, kind: c.kind as BoardSortKind };
  }
  return undefined;
}

// A direction's name, by the kind of field it orders.
export function boardSortLabel(kind: BoardSortKind | undefined, dir: BoardSortDir): string {
  const asc = dir === 'asc';
  if (kind === 'date') return asc ? 'Earliest First' : 'Latest First';
  if (kind === 'choice') return asc ? 'In Option Order' : 'Reverse Option Order';
  return asc ? 'Lowest First' : 'Highest First';
}

// The direction a field starts on when picked: the most pressing first for Priority and Rating, else the first.
export function defaultBoardSortDir(kind: BoardSortKind | undefined): BoardSortDir {
  return kind === 'priority' || kind === 'rating' ? 'desc' : 'asc';
}

// A stored sort read back: at most BOARD_SORT_LEVELS_MAX levels, each a built-in or a custom field id, once each,
// its direction 'asc' unless 'desc'. Undefined for none.
export function normaliseBoardSort(input: unknown): BoardSortLevel[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: BoardSortLevel[] = [];
  for (const l of input) {
    if (out.length === BOARD_SORT_LEVELS_MAX) break;
    if (!isObj(l)) continue;
    const field = l['field'];
    if (typeof field !== 'string' || !(isBuiltIn(field) || CUSTOM_FIELD_ID_PATTERN.test(field)))
      continue;
    if (out.some((x) => x.field === field)) continue;
    out.push({ field, dir: l['dir'] === 'desc' ? 'desc' : 'asc' });
  }
  return out.length ? out : undefined;
}

type SortKey = number | string | undefined;
type KeyReader = (item: Item) => SortKey;

const DAY = /^\d{4}-\d{2}-\d{2}/;
const num = (v: unknown): SortKey => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const day = (v: unknown): SortKey => (typeof v === 'string' && DAY.test(v) ? v : undefined);
const none: KeyReader = () => undefined;

// How a card of `type` reads `field`: no value when its type does not have the field, or has it as a kind no board
// sorts by.
function readerFor(field: string, type: ItemTypeDef | undefined): KeyReader {
  if (!type || !type.fields.includes(field)) return none;
  if (field === 'priority')
    return (item) => {
      const at = PRIORITIES.indexOf(item.fields['priority'] as (typeof PRIORITIES)[number]);
      // Low reads lowest, Urgent highest.
      return at < 0 ? undefined : PRIORITIES.length - 1 - at;
    };
  if (field === 'estimate') return (item) => num(item.fields['estimate']);
  if (field === 'start' || field === 'due') return (item) => day(item.fields[field]);
  const def = customFieldOf(type, field);
  if (!def) return none;
  if (def.kind === 'number' || def.kind === 'currency' || def.kind === 'rating')
    return (item) => num(item.fields[field]);
  if (def.kind === 'date') return (item) => day(item.fields[field]);
  if (def.kind === 'choice') {
    const options = def.options ?? [];
    return (item) => {
      const at = options.indexOf(item.fields[field] as string);
      return at < 0 ? undefined : at;
    };
  }
  return none;
}

// A level's reader, resolved once per card type.
function levelReader(field: string, types: readonly ItemTypeDef[]): KeyReader {
  const byType = new Map<string, KeyReader>();
  return (item) => {
    let read = byType.get(item.type);
    if (!read) {
      read = readerFor(
        field,
        types.find((t) => t.id === item.type),
      );
      byType.set(item.type, read);
    }
    return read(item);
  };
}

// No value last whichever way the level runs; a number before a date where one field id is both in two types.
function compareKeys(a: SortKey, b: SortKey, dir: BoardSortDir): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
  if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1;
  const c = a < b ? -1 : a > b ? 1 : 0;
  return dir === 'asc' ? c : -c;
}

// A comparator for cards under `sortBy`: each card's keys read once, rank (the order given) breaking ties.
export function boardSortComparator(
  sortBy: readonly BoardSortLevel[],
  types: readonly ItemTypeDef[],
): (a: Item, b: Item) => number {
  const readers = sortBy.map((l) => levelReader(l.field, types));
  const keys = new Map<string, SortKey[]>();
  const keysOf = (item: Item) => {
    let k = keys.get(item.id);
    if (!k) {
      k = readers.map((r) => r(item));
      keys.set(item.id, k);
    }
    return k;
  };
  return (a, b) => {
    const ka = keysOf(a);
    const kb = keysOf(b);
    for (let i = 0; i < sortBy.length; i++) {
      const c = compareKeys(ka[i], kb[i], sortBy[i]!.dir);
      if (c) return c;
    }
    return 0;
  };
}

// The cards in rank order sorted by `sortBy` (stable, so rank breaks ties); a copy, as given, when there is none.
export function sortCards<T extends Item>(
  items: readonly T[],
  sortBy: readonly BoardSortLevel[] | undefined,
  types: readonly ItemTypeDef[],
): T[] {
  if (!sortBy?.length) return [...items];
  return [...items].sort(boardSortComparator(sortBy, types));
}

// Sort levels an agent names (docs/specs/026-plan/plan-agents.md "Changing a board"): each field by its name or id
// among those the board's types offer, its direction 'ascending' (the default) or 'descending'. Refused, naming the
// fields there are, for an unknown field, one named twice or more than BOARD_SORT_LEVELS_MAX levels.
export function boardSortNamed(
  levels: readonly { field: string; direction?: 'ascending' | 'descending' | undefined }[],
  types: readonly ItemTypeDef[],
): { ok: true; sortBy: BoardSortLevel[] } | { ok: false; code: 'board_invalid'; message: string } {
  const fields = boardSortFieldsOf(types);
  const refuse = (message: string) => ({
    ok: false as const,
    code: 'board_invalid' as const,
    message,
  });
  const names = `Sortable fields: ${fields.map((f) => f.label).join(', ') || 'none'}.`;
  if (levels.length > BOARD_SORT_LEVELS_MAX)
    return refuse(`A board sorts by at most ${BOARD_SORT_LEVELS_MAX} fields.`);
  const sortBy: BoardSortLevel[] = [];
  for (const l of levels) {
    const key = statusKey(l.field);
    const f = fields.find((x) => x.id === l.field || statusKey(x.label) === key);
    if (!f) return refuse(`"${l.field}" is not a field this board can sort by. ${names}`);
    if (sortBy.some((x) => x.field === f.id)) return refuse(`"${f.label}" is named twice.`);
    sortBy.push({ field: f.id, dir: l.direction === 'descending' ? 'desc' : 'asc' });
  }
  return { ok: true, sortBy };
}

// A board's sort as the agents' answers name it: "Priority (Highest First), Due Date (Earliest First)".
export function boardSortText(
  sortBy: readonly BoardSortLevel[] | undefined,
  types: readonly ItemTypeDef[],
): string[] {
  return (sortBy ?? []).map((l) => {
    const f = boardSortFieldOf(l.field, types);
    return `${f?.label ?? l.field} (${boardSortLabel(f?.kind, l.dir)})`;
  });
}

// A board's sort after the menu's pick at `level` (0 is Sort By, 1 Then By): a field (null for None) or a direction.
// None at Sort By turns sorting off; a new field starts on its default direction (a field kept keeps its own); Then By
// needs a Sort By, and goes when Sort By takes its field.
export function withBoardSortPick(
  sortBy: readonly BoardSortLevel[] | undefined,
  level: 0 | 1,
  pick: { field: string | null; kind?: BoardSortKind | undefined } | { dir: BoardSortDir },
): BoardSortLevel[] {
  const levels = [...(sortBy ?? [])];
  const at = levels[level];
  if (level === 1 && !levels[0]) return levels;
  if ('dir' in pick) {
    if (at) levels[level] = { ...at, dir: pick.dir };
    return levels;
  }
  if (pick.field === null) return levels.slice(0, level);
  levels[level] =
    at?.field === pick.field ? at : { field: pick.field, dir: defaultBoardSortDir(pick.kind) };
  return levels[1]?.field === levels[0]!.field ? levels.slice(0, 1) : levels;
}
