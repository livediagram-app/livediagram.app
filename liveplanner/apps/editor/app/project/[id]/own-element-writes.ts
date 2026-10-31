import {
  dashboardPatchFields,
  withoutDashboardFields,
  type DashboardPatch,
  type RoomElementOp,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';

// This editor's element writes the room has not sequenced yet (docs/specs/012-collaboration/realtime-conflict-resolution.md
// "Same-element edits converge").
//
// A save derives its element ops at the snapshot, writes the tab, then sends the ops; the room orders them after any
// peer op it already had. A peer's whole-element `update` for the same element that reaches this editor before the room
// confirms ours was therefore ordered BEFORE ours, and ours replaces it on every other screen. Applying it here would
// leave this screen alone on the peer's copy: both people dragging one element at once each ended up seeing the
// other's position, until a reload. So while an element is held, a peer's `update` of it is not applied (nor folded
// into the save baseline, so a failed save still carries the change when it retries).
//
// Only a peer's `update` or `patch` is held back: our later whole-element write replaces either on every screen. A
// peer's `remove` ordered first still wins, because our later `update` of a removed element is a no-op everywhere;
// an `add` is a new id. A hold is released when the room confirms the op, when the
// write fails, or when the room cannot say (a closed socket, a timeout), so an element is never held for good.

export type OwnElementWrites = { held: Map<string, number> };

export function createOwnElementWrites(): OwnElementWrites {
  return { held: new Map() };
}

const keyOf = (tabId: string, elementId: string) => `${tabId}␟${elementId}`;

// The element an op writes in full, if any: an add or an update.
function writtenId(op: RoomElementOp): string | null {
  return op.kind === 'add' || op.kind === 'update' ? op.element.id : null;
}

/** Holds the elements `ops` write on `tabId`; the returned function releases them, once. */
export function holdOwnWrites(
  writes: OwnElementWrites,
  tabId: string,
  ops: readonly RoomElementOp[],
): () => void {
  const keys = ops.flatMap((op) => {
    const id = writtenId(op);
    return id === null ? [] : [keyOf(tabId, id)];
  });
  for (const key of keys) writes.held.set(key, (writes.held.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const key of keys) {
      const n = (writes.held.get(key) ?? 0) - 1;
      if (n > 0) writes.held.set(key, n);
      else writes.held.delete(key);
    }
  };
}

// A Dashboard's layout fields work the same way (docs/specs/012-collaboration/collab-race-hardening.md "A
// Dashboard's layout travels as deltas"): the fields a save's `dashboard-delta` sets are held until the room confirms
// it, and a peer's change to a held field, ordered before ours, is left out; the rest of their patch applies.
const dashboardKeyOf = (tabId: string, field: string) => `${tabId}␟dash␟${field}`;

/** Holds the layout fields `patch` writes on `tabId`; the returned function releases them, once. */
export function holdOwnDashboardWrites(
  writes: OwnElementWrites,
  tabId: string,
  patch: DashboardPatch,
): () => void {
  const keys = dashboardPatchFields(patch).map((field) => dashboardKeyOf(tabId, field));
  for (const key of keys) writes.held.set(key, (writes.held.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const key of keys) {
      const n = (writes.held.get(key) ?? 0) - 1;
      if (n > 0) writes.held.set(key, n);
      else writes.held.delete(key);
    }
  };
}

/** A peer's op without the layout fields this editor is writing (ordered before our write, so ours wins); null
 *  when nothing of it is left. Any other op is returned as it is. */
export function withoutOwnDashboardWrites(writes: OwnElementWrites, op: RoomOp): RoomOp | null {
  if (op.kind !== 'dashboard-delta' || writes.held.size === 0) return op;
  const patch = withoutDashboardFields(op.patch, (field) =>
    writes.held.has(dashboardKeyOf(op.tabId, field)),
  );
  if (patch === op.patch) return op;
  return patch ? { ...op, patch } : null;
}

/** Whether a peer's op is a whole-element update of an element this editor is writing, ordered before our write. */
export function isSupersededByOwnWrite(writes: OwnElementWrites, op: RoomOp): boolean {
  if (op.kind !== 'el' || writes.held.size === 0) return false;
  const id =
    op.op.kind === 'update'
      ? (op.op.element as { id?: unknown } | null)?.id
      : op.op.kind === 'patch'
        ? op.op.id
        : undefined;
  return typeof id === 'string' && writes.held.has(keyOf(op.tabId, id));
}
