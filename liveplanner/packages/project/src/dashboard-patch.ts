// A Dashboard's layout change as a patch (docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's
// layout travels as deltas").
//
// The whole layout sits in one tab field, `dashboard`, edited from handles and cogs that select nothing, so two
// Editors changing one Dashboard collide often. A whole-layout copy made each receiver take the other's layout and
// both lost their own change. A patch names only what changed, by row and slot id, so changes to different rows,
// slots or fields commute and every screen lands on one layout.
//
// Pure. `dashboardPatch` diffs two layouts; `applyDashboardPatch` applies one, checking the frame (it arrives off the
// wire). Nothing is normalised here: spans are kept as written and `readDashboard` fits them on every read, so two
// screens holding the same fields draw the same layout whatever order the patches reached them in.

import {
  readDashboard,
  type DashboardLayout,
  type DashboardRow,
  type DashboardSlot,
} from './dashboard';

// One row's, slot's or the layout's changed fields: set to a value, or removed.
export type DashboardFieldChange = { set?: Record<string, unknown>; clear?: string[] };

// A slot added to a row that was already there: the slot whole, and the row it joins.
export type DashboardSlotAdd = { row: string; slot: DashboardSlot };

export type DashboardPatch = {
  // The layout's own fields (`background`).
  set?: Record<string, unknown>;
  clear?: string[];
  // Changed fields of rows (`height`, `fill`) and of slots (`span`, `content`, `content.<field>`), by id.
  rows?: Record<string, DashboardFieldChange>;
  slots?: Record<string, DashboardFieldChange>;
  // Rows added (whole, with their slots) and removed; slots added to a row both sides had, and removed.
  addRows?: DashboardRow[];
  removeRows?: string[];
  addSlots?: DashboardSlotAdd[];
  removeSlots?: string[];
  // A row's slot ids in order, when a slot joined, left or moved within it.
  rowSlots?: Record<string, string[]>;
  // The row order, when a row moved or was added.
  order?: string[];
};

const LAYOUT_KEYS = new Set(['background']);
const ROW_KEYS = new Set(['height', 'fill']);
// A slot's own fields; `content.<field>` names one field of what it shows (CONTENT_FIELD).
const SLOT_KEYS = new Set(['span', 'content']);
const CONTENT_FIELD = 'content.';
// Bounds on one frame, well past any real layout (12 rows of 4 slots), so a forged one can't make a receiver loop.
const PATCH_IDS_MAX = 256;
const ID_MAX = 200;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= ID_MAX;

function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: Iterable<string>,
  prefix = '',
): { set: Record<string, unknown>; clear: string[] } {
  const set: Record<string, unknown> = {};
  const clear: string[] = [];
  for (const k of keys) {
    const had = before[k] !== undefined;
    const has = after[k] !== undefined;
    if (!has) {
      if (had) clear.push(prefix + k);
    } else if (!had || !same(before[k], after[k])) set[prefix + k] = after[k];
  }
  return { set, clear };
}

function asChange(c: {
  set: Record<string, unknown>;
  clear: string[];
}): DashboardFieldChange | null {
  const hasSet = Object.keys(c.set).length > 0;
  if (!hasSet && c.clear.length === 0) return null;
  return { ...(hasSet ? { set: c.set } : {}), ...(c.clear.length ? { clear: c.clear } : {}) };
}

// A slot's changes: its span, and what it shows, whole when it was filled, cleared or shows another kind of thing,
// else field by field, so two people changing different settings of one slot both keep theirs.
function slotChange(before: DashboardSlot, after: DashboardSlot): DashboardFieldChange | null {
  const out = fieldChanges(before, after, ['span']);
  const was = before.content as Record<string, unknown> | undefined;
  const now = after.content as Record<string, unknown> | undefined;
  if (was && now && was['type'] === now['type']) {
    const inner = fieldChanges(
      was,
      now,
      new Set([...Object.keys(was), ...Object.keys(now)]),
      CONTENT_FIELD,
    );
    Object.assign(out.set, inner.set);
    out.clear.push(...inner.clear);
  } else if (now) out.set['content'] = now;
  else if (was) out.clear.push('content');
  return asChange(out);
}

// What changed between two layouts, or null when nothing did (or either is absent: a layout appearing or going
// travels whole, as the tab's field).
export function dashboardPatch(
  before: DashboardLayout | undefined,
  after: DashboardLayout | undefined,
): DashboardPatch | null {
  if (!before || !after) return null;
  const patch: DashboardPatch = {};
  const top = asChange(fieldChanges(before, after, LAYOUT_KEYS));
  if (top?.set) patch.set = top.set;
  if (top?.clear) patch.clear = top.clear;

  const rowWas = new Map(before.rows.map((r) => [r.id, r]));
  const rowNow = new Set(after.rows.map((r) => r.id));
  const slotWas = new Map<string, DashboardSlot>();
  for (const r of before.rows) for (const s of r.slots) slotWas.set(s.id, s);
  const slotNow = new Set<string>();
  for (const r of after.rows) for (const s of r.slots) slotNow.add(s.id);

  const rows: Record<string, DashboardFieldChange> = {};
  const slots: Record<string, DashboardFieldChange> = {};
  const rowSlots: Record<string, string[]> = {};
  const addRows: DashboardRow[] = [];
  const addSlots: DashboardSlotAdd[] = [];
  for (const row of after.rows) {
    const prev = rowWas.get(row.id);
    // Every slot that was there before has its own changes, wherever it is now (a moved slot too).
    for (const s of row.slots) {
      const had = slotWas.get(s.id);
      if (!had) continue;
      const change = slotChange(had, s);
      if (change) slots[s.id] = change;
    }
    if (!prev) {
      addRows.push(row);
      continue;
    }
    const change = asChange(fieldChanges(prev, row, ROW_KEYS));
    if (change) rows[row.id] = change;
    for (const s of row.slots) if (!slotWas.has(s.id)) addSlots.push({ row: row.id, slot: s });
    const ids = row.slots.map((s) => s.id);
    if (
      !same(
        ids,
        prev.slots.map((s) => s.id),
      )
    )
      rowSlots[row.id] = ids;
  }
  const removeRows = before.rows.filter((r) => !rowNow.has(r.id)).map((r) => r.id);
  const removeSlots = [...slotWas.keys()].filter((id) => !slotNow.has(id));
  if (Object.keys(rows).length) patch.rows = rows;
  if (Object.keys(slots).length) patch.slots = slots;
  if (addRows.length) patch.addRows = addRows;
  if (removeRows.length) patch.removeRows = removeRows;
  if (addSlots.length) patch.addSlots = addSlots;
  if (removeSlots.length) patch.removeSlots = removeSlots;
  if (Object.keys(rowSlots).length) patch.rowSlots = rowSlots;
  // The order travels when the rows both had moved relative to each other, or one was added.
  const kept = before.rows.filter((r) => rowNow.has(r.id)).map((r) => r.id);
  const keptAfter = after.rows.filter((r) => rowWas.has(r.id)).map((r) => r.id);
  if (addRows.length || !same(kept, keptAfter)) patch.order = after.rows.map((r) => r.id);
  return Object.keys(patch).length ? patch : null;
}

function isChange(v: unknown, keyOk: (k: string) => boolean): v is DashboardFieldChange {
  if (!isObject(v)) return false;
  if (v['set'] !== undefined && (!isObject(v['set']) || !Object.keys(v['set']).every(keyOk)))
    return false;
  const clear = v['clear'];
  if (clear === undefined) return true;
  return Array.isArray(clear) && clear.every((k) => typeof k === 'string' && keyOk(k));
}

const isSlotKey = (k: string) =>
  SLOT_KEYS.has(k) || (k.startsWith(CONTENT_FIELD) && isId(k.slice(CONTENT_FIELD.length)));

function isIdList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= PATCH_IDS_MAX && v.every(isId);
}

function isChangeMap(v: unknown, keyOk: (k: string) => boolean): boolean {
  if (v === undefined) return true;
  if (!isObject(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length <= PATCH_IDS_MAX && entries.every(([id, c]) => isId(id) && isChange(c, keyOk))
  );
}

const isSlotShape = (v: unknown): v is DashboardSlot => isObject(v) && isId(v['id']);
const isRowShape = (v: unknown): v is DashboardRow =>
  isObject(v) && isId(v['id']) && Array.isArray(v['slots']) && v['slots'].every(isSlotShape);

// Is this a well-formed patch frame? Values are checked by `readDashboard` on every read.
export function isDashboardPatch(v: unknown): v is DashboardPatch {
  if (!isObject(v)) return false;
  if (!isChange({ set: v['set'], clear: v['clear'] }, (k) => LAYOUT_KEYS.has(k))) return false;
  if (!isChangeMap(v['rows'], (k) => ROW_KEYS.has(k))) return false;
  if (!isChangeMap(v['slots'], isSlotKey)) return false;
  const addRows = v['addRows'];
  if (addRows !== undefined) {
    if (!Array.isArray(addRows) || addRows.length > PATCH_IDS_MAX || !addRows.every(isRowShape))
      return false;
  }
  const addSlots = v['addSlots'];
  if (addSlots !== undefined) {
    if (!Array.isArray(addSlots) || addSlots.length > PATCH_IDS_MAX) return false;
    if (!addSlots.every((a) => isObject(a) && isId(a['row']) && isSlotShape(a['slot'])))
      return false;
  }
  for (const k of ['removeRows', 'removeSlots', 'order'] as const) {
    if (v[k] !== undefined && !isIdList(v[k])) return false;
  }
  const rowSlots = v['rowSlots'];
  if (rowSlots !== undefined) {
    if (!isObject(rowSlots)) return false;
    const entries = Object.entries(rowSlots);
    if (entries.length > PATCH_IDS_MAX || !entries.every(([id, l]) => isId(id) && isIdList(l)))
      return false;
  }
  return true;
}

// `base` with the change, or `base` itself when the change leaves every field as it is (so a patch applied to an undo
// snapshot that already holds it, or lacks what it names, keeps that snapshot's identity).
function withChange<T extends object>(base: T, change: DashboardFieldChange | undefined): T {
  if (!change) return base;
  const b = base as Record<string, unknown>;
  const set = Object.entries(change.set ?? {}).filter(([k, v]) => !same(b[k], v));
  const clear = (change.clear ?? []).filter((k) => b[k] !== undefined);
  if (set.length === 0 && clear.length === 0) return base;
  const next = { ...b, ...Object.fromEntries(set) };
  for (const k of clear) delete next[k];
  return next as T;
}

// A slot's change: its own fields, then each field of what it shows (only while it shows something).
function withSlotChange(
  slot: DashboardSlot,
  change: DashboardFieldChange | undefined,
): DashboardSlot {
  if (!change) return slot;
  const own: DashboardFieldChange = {};
  const inner: DashboardFieldChange = {};
  for (const [k, value] of Object.entries(change.set ?? {})) {
    if (k.startsWith(CONTENT_FIELD)) (inner.set ??= {})[k.slice(CONTENT_FIELD.length)] = value;
    else (own.set ??= {})[k] = value;
  }
  for (const k of change.clear ?? []) {
    if (k.startsWith(CONTENT_FIELD)) (inner.clear ??= []).push(k.slice(CONTENT_FIELD.length));
    else (own.clear ??= []).push(k);
  }
  const next = withChange(slot, own);
  if (!next.content || (!inner.set && !inner.clear)) return next;
  const content = withChange(next.content, inner);
  return content === next.content ? next : { ...next, content };
}

// Put `items` in `order`, keeping any the order doesn't name (one added meanwhile by somebody else) right after the
// item it followed here.
function reorder<T extends { id: string }>(items: T[], order: readonly string[]): T[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  const named = order.filter((id) => byId.has(id));
  const placed = new Set(named);
  const out = [...new Set(named)].map((id) => byId.get(id)!);
  let after: string | null = null;
  for (const c of items) {
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

// Apply a patch (the spec's four steps). Returns `layout` itself when the patch changes nothing or is malformed, so
// callers keep identity and a bad frame is a no-op.
export function applyDashboardPatch(stored: DashboardLayout, patch: unknown): DashboardLayout {
  if (!isDashboardPatch(patch)) return stored;
  // A stored or forged layout that isn't rows of slots with ids is read safely first; one that can't be is left.
  const layout =
    Array.isArray(stored?.rows) && stored.rows.every(isRowShape) ? stored : readDashboard(stored);
  if (!layout) return stored;
  // 1. A removal wins.
  const goneRows = new Set(patch.removeRows ?? []);
  const goneSlots = new Set(patch.removeSlots ?? []);
  let rows = layout.rows
    .filter((r) => !goneRows.has(r.id))
    .map((r) =>
      r.slots.some((s) => goneSlots.has(s.id))
        ? { ...r, slots: r.slots.filter((s) => !goneSlots.has(s.id)) }
        : r,
    );
  // 2. Placement. Every slot the patch places, and where: a row's list, an added row, an added slot.
  const pool = new Map<string, DashboardSlot>();
  for (const r of rows) for (const s of r.slots) pool.set(s.id, s);
  const rowIds = new Set(rows.map((r) => r.id));
  const added = (patch.addRows ?? []).filter((r) => !goneRows.has(r.id));
  const lists = new Map<string, string[]>();
  for (const [rowId, ids] of Object.entries(patch.rowSlots ?? {})) lists.set(rowId, ids);
  for (const r of added) {
    // An added row this layout already has (a patch applied twice) is its list; a new one brings its own slots.
    if (rowIds.has(r.id))
      lists.set(
        r.id,
        r.slots.map((s) => s.id),
      );
    for (const s of r.slots) if (!pool.has(s.id) && !goneSlots.has(s.id)) pool.set(s.id, s);
  }
  const joins = new Map<string, string>();
  for (const { row, slot } of patch.addSlots ?? []) {
    if (goneSlots.has(slot.id) || pool.has(slot.id)) continue;
    pool.set(slot.id, slot);
    joins.set(slot.id, row);
  }
  // Where each placed slot goes. A slot sent into a row that is not here (someone removed it) goes with that row.
  const target = new Map<string, string | null>();
  for (const [rowId, ids] of lists) {
    const lands = rowIds.has(rowId) ? rowId : null;
    for (const id of ids) if (!target.has(id)) target.set(id, lands);
  }
  for (const r of added) {
    if (rowIds.has(r.id)) continue;
    for (const s of r.slots) if (!target.has(s.id)) target.set(s.id, r.id);
  }
  for (const [id, row] of joins) if (!target.has(id)) target.set(id, rowIds.has(row) ? row : null);
  const elsewhere = (s: DashboardSlot, rowId: string) =>
    target.has(s.id) && target.get(s.id) !== rowId;
  rows = rows.map((r) => {
    const list = lists.get(r.id);
    let slots = r.slots.filter((s) => !elsewhere(s, r.id));
    if (list) {
      const incoming = list.filter((id) => target.get(id) === r.id && pool.has(id));
      const have = new Set(slots.map((s) => s.id));
      slots = reorder(
        [...slots, ...incoming.filter((id) => !have.has(id)).map((id) => pool.get(id)!)],
        incoming,
      );
    }
    for (const [id, row] of joins) {
      if (row === r.id && target.get(id) === r.id && !slots.some((s) => s.id === id))
        slots = [...slots, pool.get(id)!];
    }
    return slots.length === r.slots.length && slots.every((s, i) => s === r.slots[i])
      ? r
      : { ...r, slots };
  });
  for (const r of added) {
    if (rowIds.has(r.id)) continue;
    const slots = r.slots.filter((s) => target.get(s.id) === r.id).map((s) => pool.get(s.id)!);
    rows.push({ ...r, slots });
    rowIds.add(r.id);
  }
  // 3. Fields by id.
  rows = rows.map((r) => {
    const next = withChange(r, patch.rows?.[r.id]);
    const slots = next.slots.map((s) => withSlotChange(s, patch.slots?.[s.id]));
    return slots.every((s, i) => s === next.slots[i]) ? next : { ...next, slots };
  });
  if (patch.order) rows = reorder(rows, patch.order);
  // A row left with no slots is gone.
  rows = rows.filter((r) => r.slots.length > 0);
  const kept = rows.length === layout.rows.length && rows.every((r, i) => r === layout.rows[i]);
  return withChange(kept ? layout : { ...layout, rows }, { set: patch.set, clear: patch.clear });
}

// The field keys a patch writes, for holding them until the room orders it (own-element-writes.ts): the layout's
// (`background`), a row's (`r:<id>:height`) and a slot's (`s:<id>:span`, `s:<id>:content.name`).
export function dashboardPatchFields(patch: DashboardPatch): string[] {
  const keys: string[] = [];
  const named = (c: DashboardFieldChange) => [...Object.keys(c.set ?? {}), ...(c.clear ?? [])];
  keys.push(...named({ set: patch.set, clear: patch.clear }));
  for (const [id, c] of Object.entries(patch.rows ?? {}))
    for (const k of named(c)) keys.push(`r:${id}:${k}`);
  for (const [id, c] of Object.entries(patch.slots ?? {}))
    for (const k of named(c)) keys.push(`s:${id}:${k}`);
  return keys;
}

function withoutKeys(
  change: DashboardFieldChange,
  held: (key: string) => boolean,
  key: (k: string) => string,
): DashboardFieldChange | null {
  const set = Object.fromEntries(Object.entries(change.set ?? {}).filter(([k]) => !held(key(k))));
  const clear = (change.clear ?? []).filter((k) => !held(key(k)));
  return asChange({ set, clear });
}

function withoutKeyMap(
  map: Record<string, DashboardFieldChange> | undefined,
  held: (key: string) => boolean,
  prefix: string,
): Record<string, DashboardFieldChange> | undefined {
  if (!map) return undefined;
  const out: Record<string, DashboardFieldChange> = {};
  for (const [id, c] of Object.entries(map)) {
    const kept = withoutKeys(c, held, (k) => `${prefix}:${id}:${k}`);
    if (kept) out[id] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}

// The patch without the fields `held` names (dashboardPatchFields' keys); the patch itself when it names none, null
// when nothing is left. The structure (rows and slots added, removed or moved) always stays: only a field has a last
// writer.
export function withoutDashboardFields(
  patch: DashboardPatch,
  held: (key: string) => boolean,
): DashboardPatch | null {
  if (!dashboardPatchFields(patch).some(held)) return patch;
  const top = withoutKeys({ set: patch.set, clear: patch.clear }, held, (k) => k);
  const { set: _set, clear: _clear, rows: _rows, slots: _slots, ...structure } = patch;
  const rows = withoutKeyMap(patch.rows, held, 'r');
  const slots = withoutKeyMap(patch.slots, held, 's');
  const next: DashboardPatch = {
    ...structure,
    ...(top?.set ? { set: top.set } : {}),
    ...(top?.clear ? { clear: top.clear } : {}),
    ...(rows ? { rows } : {}),
    ...(slots ? { slots } : {}),
  };
  return Object.keys(next).length ? next : null;
}
