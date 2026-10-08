// A Plan board's set-up change as a patch (docs/specs/012-collaboration/collab-race-hardening.md, phase 6).
//
// The whole set-up sits in one element field, `planBoard`, and its column cogs and Board flyout edit it
// without selecting the board, so two people setting up one board collide often. A whole-element update
// made each receiver take the other's copy and the screens diverged. A patch names only what changed, so
// edits to different fields or different columns commute and every peer lands on one board.
//
// Pure. `planBoardPatch` diffs two set-ups; `applyPlanBoardPatch` applies one, checking the frame (it
// arrives off the wire) and refusing a result that is not a readable set-up.

import { normaliseBoardSetup, type PlanBoardSetup, type PlanColumn } from '@livediagram/items';

export type ColumnChange = { set?: Record<string, unknown>; clear?: string[] };

export type PlanBoardPatch = {
  // Top-level set-up fields given a new value, and ones removed. Never `columns`.
  set?: Record<string, unknown>;
  clear?: string[];
  // Changed fields of columns both sides have, by column id.
  columns?: Record<string, ColumnChange>;
  // Columns added (whole) and removed (by id).
  add?: PlanColumn[];
  remove?: string[];
  // The column order after the change, when a column moved or was added.
  order?: string[];
};

// The top-level fields a patch may set or clear, and a column's. `columns` itself only moves through
// the column parts of a patch.
const SETUP_KEYS = new Set([
  'title',
  'doneColumnId',
  'swimlaneBy',
  'cardFields',
  'cardSize',
  'archive',
  'allCards',
  'addTypes',
  'widgets',
  // Boards no longer vote (a vote is the tab's session vote); kept so an older editor's patch still applies.
  'voting',
  'hideWriting',
]);
const COLUMN_KEYS = new Set(['status', 'name', 'wipLimit', 'color', 'width']);
// Bounds on one frame, well past any real board (PLAN_COLUMNS_MAX columns, a handful of fields).
const PATCH_COLUMNS_MAX = 64;
const ID_MAX = 40;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: ReadonlySet<string>,
): ColumnChange | null {
  const set: Record<string, unknown> = {};
  const clear: string[] = [];
  for (const k of keys) {
    const had = k in before && before[k] !== undefined;
    const has = k in after && after[k] !== undefined;
    if (!has) {
      if (had) clear.push(k);
    } else if (!had || !same(before[k], after[k])) set[k] = after[k];
  }
  if (Object.keys(set).length === 0 && clear.length === 0) return null;
  return { ...(Object.keys(set).length ? { set } : {}), ...(clear.length ? { clear } : {}) };
}

// What changed between two set-ups, or null when nothing did.
export function planBoardPatch(
  before: PlanBoardSetup | undefined,
  after: PlanBoardSetup | undefined,
): PlanBoardPatch | null {
  if (!before || !after) return null;
  const patch: PlanBoardPatch = {};
  const top = fieldChanges(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    SETUP_KEYS,
  );
  if (top?.set) patch.set = top.set;
  if (top?.clear) patch.clear = top.clear;

  const was = new Map(before.columns.map((c) => [c.id, c]));
  const now = new Map(after.columns.map((c) => [c.id, c]));
  const columns: Record<string, ColumnChange> = {};
  const add: PlanColumn[] = [];
  for (const c of after.columns) {
    const prev = was.get(c.id);
    if (!prev) {
      add.push(c);
      continue;
    }
    const change = fieldChanges(
      prev as unknown as Record<string, unknown>,
      c as unknown as Record<string, unknown>,
      COLUMN_KEYS,
    );
    if (change) columns[c.id] = change;
  }
  const remove = before.columns.filter((c) => !now.has(c.id)).map((c) => c.id);
  if (Object.keys(columns).length) patch.columns = columns;
  if (add.length) patch.add = add;
  if (remove.length) patch.remove = remove;
  // The order travels when the columns both had moved relative to each other, or one was added.
  const kept = before.columns.filter((c) => now.has(c.id)).map((c) => c.id);
  const keptAfter = after.columns.filter((c) => was.has(c.id)).map((c) => c.id);
  if (add.length || !same(kept, keptAfter)) patch.order = after.columns.map((c) => c.id);
  return Object.keys(patch).length ? patch : null;
}

const isId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= ID_MAX;

function isChange(v: unknown, keys: ReadonlySet<string>): v is ColumnChange {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as { set?: unknown; clear?: unknown };
  if (c.set !== undefined) {
    if (!c.set || typeof c.set !== 'object' || Array.isArray(c.set)) return false;
    if (!Object.keys(c.set).every((k) => keys.has(k))) return false;
  }
  if (c.clear !== undefined) {
    if (!Array.isArray(c.clear) || !c.clear.every((k) => typeof k === 'string' && keys.has(k))) {
      return false;
    }
  }
  return true;
}

// Is this a well-formed patch frame? Values are checked by `normaliseBoardSetup` on the result.
export function isPlanBoardPatch(v: unknown): v is PlanBoardPatch {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  if (!isChange({ set: p['set'], clear: p['clear'] }, SETUP_KEYS)) return false;
  if (p['columns'] !== undefined) {
    const cols = p['columns'];
    if (!cols || typeof cols !== 'object' || Array.isArray(cols)) return false;
    const entries = Object.entries(cols);
    if (entries.length > PATCH_COLUMNS_MAX) return false;
    if (!entries.every(([id, c]) => isId(id) && isChange(c, COLUMN_KEYS))) return false;
  }
  if (p['add'] !== undefined) {
    const add = p['add'];
    if (!Array.isArray(add) || add.length > PATCH_COLUMNS_MAX) return false;
    if (!add.every((c) => c && typeof c === 'object' && isId((c as PlanColumn).id))) return false;
  }
  for (const k of ['remove', 'order'] as const) {
    const list = p[k];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length > PATCH_COLUMNS_MAX || !list.every(isId)) return false;
  }
  return true;
}

function withChange<T extends object>(base: T, change: ColumnChange): T {
  const next = { ...base, ...(change.set ?? {}) } as Record<string, unknown>;
  for (const k of change.clear ?? []) delete next[k];
  return next as T;
}

// Put the columns in `order`, keeping any the order doesn't name (one added meanwhile by somebody else)
// right after the column it followed here.
function reorder(columns: PlanColumn[], order: readonly string[]): PlanColumn[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const named = order.filter((id) => byId.has(id));
  const placed = new Set(named);
  const out = named.map((id) => byId.get(id)!);
  let after: string | null = null;
  for (const c of columns) {
    if (placed.has(c.id)) {
      after = c.id;
      continue;
    }
    const at = after === null ? 0 : out.findIndex((x) => x.id === after) + 1;
    out.splice(at, 0, c);
    after = c.id;
  }
  return out;
}

// Apply a patch. Returns `setup` itself when the patch changes nothing, is malformed, or would leave a
// set-up that can't be read, so callers keep identity and a bad frame is a no-op.
export function applyPlanBoardPatch(setup: PlanBoardSetup, patch: unknown): PlanBoardSetup {
  if (!isPlanBoardPatch(patch)) return setup;
  let next = withChange(setup, { set: patch.set, clear: patch.clear });
  const remove = new Set(patch.remove ?? []);
  let columns = next.columns.filter((c) => !remove.has(c.id));
  columns = columns.map((c) => {
    const change = patch.columns?.[c.id];
    return change ? withChange(c, change) : c;
  });
  for (const c of patch.add ?? []) {
    if (remove.has(c.id)) continue;
    const at = columns.findIndex((x) => x.id === c.id);
    if (at === -1) columns.push(c);
    else columns[at] = c;
  }
  if (patch.order) columns = reorder(columns, patch.order);
  next = { ...next, columns };
  if (same(next, setup)) return setup;
  return normaliseBoardSetup(next) ? next : setup;
}
