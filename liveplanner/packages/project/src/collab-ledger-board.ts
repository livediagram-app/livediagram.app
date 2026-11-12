// A Plan board's set-up in the room's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md,
// phase 6): the latest value of each top-level field and each column field, each column added or removed, and the
// latest column order, recorded from `board` deltas and handed back to a save as one patch. Pure, used by
// collab-ledger.ts, which re-exports BoardLedger.

import type { ElementLedger } from './collab-ledger';
import { isPlanBoardPatch, type PlanBoardPatch } from './plan-board-patch';
import type { PlanColumn } from '@liveplanner/items';

// A bound on the columns one entry may hold (see collab-ledger.ts's bounds).
const BOARD_COLUMNS_MAX = 64;

// One field's latest change: a value, or removed.
export type FieldEntry = { value?: unknown; cleared?: true; seq: number };

export type BoardLedger = {
  set: Record<string, FieldEntry>;
  columns: Record<
    string,
    {
      set: Record<string, FieldEntry>;
      added?: { column: PlanColumn; seq: number };
      removed?: number;
    }
  >;
  order?: { ids: string[]; seq: number };
};

function fieldEntries(
  prev: Record<string, FieldEntry>,
  set: Record<string, unknown> | undefined,
  clear: string[] | undefined,
  seq: number,
): Record<string, FieldEntry> {
  const next = { ...prev };
  for (const [k, value] of Object.entries(set ?? {})) next[k] = { value, seq };
  for (const k of clear ?? []) next[k] = { cleared: true, seq };
  return next;
}

export function recordBoard(
  prev: ElementLedger | undefined,
  patch: unknown,
  seq: number,
): ElementLedger | null {
  if (!isPlanBoardPatch(patch)) return null;
  const p: PlanBoardPatch = patch;
  const board: BoardLedger = prev?.board ?? { set: {}, columns: {} };
  const columns = { ...board.columns };
  const column = (id: string) => columns[id] ?? { set: {} };
  const touched = new Set([
    ...Object.keys(p.columns ?? {}),
    ...(p.add ?? []).map((c) => c.id),
    ...(p.remove ?? []),
  ]);
  const fresh = [...touched].filter((id) => !(id in columns)).length;
  if (Object.keys(columns).length + fresh > BOARD_COLUMNS_MAX) return null;
  for (const [id, change] of Object.entries(p.columns ?? {})) {
    const c = column(id);
    columns[id] = { ...c, set: fieldEntries(c.set, change.set, change.clear, seq) };
  }
  for (const added of p.add ?? []) columns[added.id] = { set: {}, added: { column: added, seq } };
  for (const id of p.remove ?? []) columns[id] = { ...column(id), removed: seq };
  return {
    ...(prev ?? {}),
    board: {
      set: fieldEntries(board.set, p.set, p.clear, seq),
      columns,
      ...(p.order ? { order: { ids: p.order, seq } } : board.order ? { order: board.order } : {}),
    },
  };
}

// The board changes the saver hadn't seen, as one patch: re-applied through the same delta a peer would
// receive. A column the save already has isn't re-added (its fields come from the field entries); one it
// lacks is added with its later field changes folded in.
export function boardPatchSince(
  board: BoardLedger,
  has: ReadonlySet<string>,
  since: number,
): PlanBoardPatch | null {
  const patch: PlanBoardPatch = {};
  const split = (entries: Record<string, FieldEntry>) => {
    const set: Record<string, unknown> = {};
    const clear: string[] = [];
    for (const [k, e] of Object.entries(entries)) {
      if (e.seq <= since) continue;
      if (e.cleared) clear.push(k);
      else set[k] = e.value;
    }
    return { set, clear };
  };
  const top = split(board.set);
  if (Object.keys(top.set).length) patch.set = top.set;
  if (top.clear.length) patch.clear = top.clear;
  const remove: string[] = [];
  const add: PlanColumn[] = [];
  const columns: Record<string, { set?: Record<string, unknown>; clear?: string[] }> = {};
  for (const [id, c] of Object.entries(board.columns)) {
    if (c.removed !== undefined) {
      if (c.removed > since) remove.push(id);
      continue;
    }
    const f = split(c.set);
    if (c.added && c.added.seq > since && !has.has(id)) {
      const col = { ...c.added.column, ...f.set } as Record<string, unknown>;
      for (const k of f.clear) delete col[k];
      add.push(col as unknown as PlanColumn);
      continue;
    }
    if (Object.keys(f.set).length || f.clear.length) {
      columns[id] = {
        ...(Object.keys(f.set).length ? { set: f.set } : {}),
        ...(f.clear.length ? { clear: f.clear } : {}),
      };
    }
  }
  if (remove.length) patch.remove = remove;
  if (add.length) patch.add = add;
  if (Object.keys(columns).length) patch.columns = columns;
  if (board.order && board.order.seq > since) patch.order = board.order.ids;
  return Object.keys(patch).length ? patch : null;
}
