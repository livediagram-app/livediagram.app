// A Dashboard's layout in the room's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md
// "A Dashboard's layout travels as deltas"): one entry per tab, keeping the minimum that reproduces every layout
// change the room sequenced, each part with the seq that last set it, so a save merges in only what its saver had not
// seen (collab-ledger.ts `mergeLedgerIntoTab`).
//
// Kept: the latest value of each layout, row and slot field; each row and slot added (whole) or removed (its seq
// only); each row's latest slot list and the latest row order. A whole layout (an agent's rebuild, a tab-meta that
// carried one) is a reset: everything before it goes.
//
// Pure, and a leaf module like collab-ledger.ts: the room stores these values, it doesn't interpret them.

import type { DashboardLayout, DashboardRow, DashboardSlot } from './dashboard';
import {
  applyDashboardPatch,
  isDashboardPatch,
  type DashboardFieldChange,
  type DashboardPatch,
} from './dashboard-patch';

// One field's latest change: a value, or removed.
type FieldEntry = { value?: unknown; cleared?: true; seq: number };
type Fields = Record<string, FieldEntry>;

export type DashboardLedger = {
  reset?: { layout: DashboardLayout; seq: number };
  set: Fields;
  rows: Record<
    string,
    {
      set?: Fields;
      added?: { row: DashboardRow; seq: number };
      removed?: number;
      slots?: { ids: string[]; seq: number };
    }
  >;
  slots: Record<
    string,
    { set?: Fields; added?: { row: string; slot: DashboardSlot; seq: number }; removed?: number }
  >;
  order?: { ids: string[]; seq: number };
};

// How many rows and slots one tab's entry tracks, well past a real Dashboard (12 rows of 4 slots) and its history of
// added and removed ones. Past it the oldest removals are forgotten first; then new ids are not tracked, and a save
// carries itself as before. Safe range: 64 to ~2,000 (the storage value limit bounds it too).
export const DASHBOARD_LEDGER_IDS_MAX = 512;

const CONTENT_FIELD = 'content.';

const empty = (): DashboardLedger => ({ set: {}, rows: {}, slots: {} });

function fieldEntries(prev: Fields | undefined, change: DashboardFieldChange, seq: number): Fields {
  const next = { ...(prev ?? {}) };
  for (const [k, value] of Object.entries(change.set ?? {})) next[k] = { value, seq };
  for (const k of change.clear ?? []) next[k] = { cleared: true, seq };
  // What a slot shows set (or cleared) whole: its earlier per-field changes are part of the past.
  const whole =
    Object.hasOwn(change.set ?? {}, 'content') || (change.clear ?? []).includes('content');
  if (whole) {
    for (const k of Object.keys(next)) {
      if (k.startsWith(CONTENT_FIELD) && next[k]!.seq < seq) delete next[k];
    }
  }
  return next;
}

// Forget the oldest removals until the entry tracks at most the bound; null when it still does not.
function bounded(ledger: DashboardLedger): DashboardLedger | null {
  const count = () => Object.keys(ledger.rows).length + Object.keys(ledger.slots).length;
  if (count() <= DASHBOARD_LEDGER_IDS_MAX) return ledger;
  const removals = [
    ...Object.entries(ledger.rows).map(([id, r]) => ({ id, seq: r.removed, rows: true })),
    ...Object.entries(ledger.slots).map(([id, s]) => ({ id, seq: s.removed, rows: false })),
  ]
    .filter((r): r is { id: string; seq: number; rows: boolean } => r.seq !== undefined)
    .sort((a, b) => a.seq - b.seq);
  for (const r of removals) {
    if (count() <= DASHBOARD_LEDGER_IDS_MAX) break;
    if (r.rows) delete ledger.rows[r.id];
    else delete ledger.slots[r.id];
  }
  return count() <= DASHBOARD_LEDGER_IDS_MAX ? ledger : null;
}

// One `dashboard-delta` recorded into the tab's entry; null when the patch is malformed or the entry is full.
export function recordDashboardPatch(
  prev: DashboardLedger | undefined,
  patch: unknown,
  seq: number,
): DashboardLedger | null {
  if (!isDashboardPatch(patch)) return null;
  const p: DashboardPatch = patch;
  const base = prev ?? empty();
  const next: DashboardLedger = {
    ...base,
    set: fieldEntries(base.set, { set: p.set, clear: p.clear }, seq),
    rows: { ...base.rows },
    slots: { ...base.slots },
  };
  for (const [id, change] of Object.entries(p.rows ?? {})) {
    const r = next.rows[id] ?? {};
    next.rows[id] = { ...r, set: fieldEntries(r.set, change, seq) };
  }
  for (const [id, change] of Object.entries(p.slots ?? {})) {
    const s = next.slots[id] ?? {};
    next.slots[id] = { ...s, set: fieldEntries(s.set, change, seq) };
  }
  for (const row of p.addRows ?? []) next.rows[row.id] = { added: { row, seq } };
  for (const { row, slot } of p.addSlots ?? []) next.slots[slot.id] = { added: { row, slot, seq } };
  for (const [id, ids] of Object.entries(p.rowSlots ?? {})) {
    next.rows[id] = { ...(next.rows[id] ?? {}), slots: { ids, seq } };
  }
  // A removal keeps only its seq: nothing about the row or slot can come back through a merge.
  for (const id of p.removeRows ?? []) next.rows[id] = { removed: seq };
  for (const id of p.removeSlots ?? []) next.slots[id] = { removed: seq };
  if (p.order) next.order = { ids: p.order, seq };
  return bounded(next);
}

// A whole layout (an agent's rebuild, a tab-meta that carried one) recorded as a reset; null when it is not a layout.
export function recordDashboardReset(layout: unknown, seq: number): DashboardLedger | null {
  if (!layout || typeof layout !== 'object' || !Array.isArray((layout as { rows?: unknown }).rows))
    return null;
  return { ...empty(), reset: { layout: layout as DashboardLayout, seq } };
}

function changeSince(fields: Fields | undefined, since: number): DashboardFieldChange | null {
  const set: Record<string, unknown> = {};
  const clear: string[] = [];
  for (const [k, e] of Object.entries(fields ?? {})) {
    if (e.seq <= since) continue;
    if (e.cleared) clear.push(k);
    else set[k] = e.value;
  }
  if (Object.keys(set).length === 0 && clear.length === 0) return null;
  return { ...(Object.keys(set).length ? { set } : {}), ...(clear.length ? { clear } : {}) };
}

// The layout changes the saver hadn't seen (seq past `since`), as one patch, re-applied through the same apply a peer
// runs. A row or slot the save already has isn't re-added (its fields come from the field entries).
export function dashboardLedgerPatchSince(
  ledger: DashboardLedger,
  since: number,
  has: { rows: ReadonlySet<string>; slots: ReadonlySet<string> },
): DashboardPatch | null {
  const patch: DashboardPatch = {};
  const top = changeSince(ledger.set, since);
  if (top?.set) patch.set = top.set;
  if (top?.clear) patch.clear = top.clear;
  const rows: Record<string, DashboardFieldChange> = {};
  const slots: Record<string, DashboardFieldChange> = {};
  const rowSlots: Record<string, string[]> = {};
  const addRows: DashboardRow[] = [];
  const addSlots: DashboardPatch['addSlots'] = [];
  const removeRows: string[] = [];
  const removeSlots: string[] = [];
  for (const [id, r] of Object.entries(ledger.rows)) {
    if (r.removed !== undefined) {
      if (r.removed > since) removeRows.push(id);
      continue;
    }
    if (r.added && r.added.seq > since && !has.rows.has(id)) addRows.push(r.added.row);
    const change = changeSince(r.set, since);
    if (change) rows[id] = change;
    if (r.slots && r.slots.seq > since) rowSlots[id] = r.slots.ids;
  }
  for (const [id, s] of Object.entries(ledger.slots)) {
    if (s.removed !== undefined) {
      if (s.removed > since) removeSlots.push(id);
      continue;
    }
    if (s.added && s.added.seq > since && !has.slots.has(id))
      addSlots.push({ row: s.added.row, slot: s.added.slot });
    const change = changeSince(s.set, since);
    if (change) slots[id] = change;
  }
  if (Object.keys(rows).length) patch.rows = rows;
  if (Object.keys(slots).length) patch.slots = slots;
  if (Object.keys(rowSlots).length) patch.rowSlots = rowSlots;
  if (addRows.length) patch.addRows = addRows;
  if (addSlots.length) patch.addSlots = addSlots;
  if (removeRows.length) patch.removeRows = removeRows;
  if (removeSlots.length) patch.removeSlots = removeSlots;
  if (ledger.order && ledger.order.seq > since) patch.order = ledger.order.ids;
  return Object.keys(patch).length ? patch : null;
}

const isLayout = (v: unknown): v is DashboardLayout =>
  !!v && typeof v === 'object' && Array.isArray((v as { rows?: unknown }).rows);

// A saved tab's layout with the ledger's later changes folded in: the reset, when the saver had not seen it, then
// every change after `since`. The same value when there is nothing to fold, and when the save has no layout and no
// reset gives it one (a tab that stopped being a Dashboard keeps that).
export function mergeDashboardLedger(
  dashboard: unknown,
  ledger: DashboardLedger | undefined,
  since: number,
): unknown {
  if (!ledger) return dashboard;
  const base = ledger.reset && ledger.reset.seq > since ? ledger.reset.layout : dashboard;
  if (!isLayout(base)) return dashboard;
  const has = { rows: new Set<string>(), slots: new Set<string>() };
  for (const r of base.rows) {
    const row = r as Partial<DashboardRow> | null;
    if (typeof row?.id === 'string') has.rows.add(row.id);
    for (const s of Array.isArray(row?.slots) ? row.slots : [])
      if (typeof (s as Partial<DashboardSlot> | null)?.id === 'string') has.slots.add(s.id);
  }
  const patch = dashboardLedgerPatchSince(ledger, since, has);
  return patch ? applyDashboardPatch(base, patch) : base;
}
