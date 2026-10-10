// Element-level operations for realtime conflict resolution (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0).
//
// The realtime room used to broadcast a whole `Tab` on every edit, so two
// people editing *different* elements on the same tab clobbered each other
// (last full-tab write wins). These granular, id-addressed ops let each edit
// ship only what it touched, so different-element edits merge instead.
//
// Pure + reusable: `diffToElementOps` derives the ops from the before/after
// element arrays the editor already computes on every commit, and `applyElementOp` applies one op to an
// element array by id. Both are transport-agnostic — the room wraps an
// `ElementOp` in a `{ tabId, op }` frame (see @livediagram/api-schema).
//
// Level 0 scope: `update` replaces the whole element by id (simple + correct;
// two peers editing the same element still last-writer-wins, which the docs/specs/007-editor/live-app.md
// selection lock covers). Field-level merge of the same element is deferred to
// the CRDT (Level 2).

import type { Element } from './index';
import { preferNewerQa } from './qa-board';

export type ElementOp =
  // A new element appeared; `at` is its z-order index in the tab.
  | { kind: 'add'; element: Element; at: number }
  // An existing element changed; carries the full element, applied by id.
  | { kind: 'update'; element: Element }
  // An element was deleted.
  | { kind: 'remove'; id: string }
  // Pure z-order change: the new full element-id order for the tab.
  | { kind: 'reorder'; ids: string[] };

// Structural equality for "did this element change". A false positive only
// yields a redundant (idempotent) `update` op, so a cheap stable compare is
// fine — immutable updates ({ ...el, field }) preserve key order.
function elementsEqual(a: Element, b: Element): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Derive the element ops that turn `before` into `after`. Order of emission:
// removes, then adds/updates (in after order), then a single reorder if the
// surviving elements' relative z-order changed. Applying them in order to a
// copy of `before` reproduces `after`.
export function diffToElementOps(before: Element[], after: Element[]): ElementOp[] {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const afterById = new Map(after.map((e) => [e.id, e]));
  const ops: ElementOp[] = [];

  for (const e of before) {
    if (!afterById.has(e.id)) ops.push({ kind: 'remove', id: e.id });
  }
  after.forEach((e, i) => {
    const prev = beforeById.get(e.id);
    if (!prev) ops.push({ kind: 'add', element: e, at: i });
    else if (!elementsEqual(prev, e)) ops.push({ kind: 'update', element: e });
  });

  // Reorder: compare the order of elements present in BOTH snapshots. If it
  // changed (a bring-to-front / send-to-back that didn't alter fields, or a
  // reorder alongside adds/removes), ship the full new id order so receivers
  // converge exactly.
  const commonBefore = before.filter((e) => afterById.has(e.id)).map((e) => e.id);
  const commonAfter = after.filter((e) => beforeById.has(e.id)).map((e) => e.id);
  if (!sameOrder(commonBefore, commonAfter)) {
    ops.push({ kind: 'reorder', ids: after.map((e) => e.id) });
  }
  return ops;
}

// Apply one element op to a tab's element array, by id. Returns a new array
// (never mutates). Ops for an unknown id are safe no-ops (a peer already
// removed the element); a racing double-add degrades to an update.
export function applyElementOp(elements: Element[], op: ElementOp): Element[] {
  switch (op.kind) {
    case 'add': {
      if (elements.some((e) => e.id === op.element.id)) {
        return elements.map((e) => (e.id === op.element.id ? preferNewerQa(e, op.element) : e));
      }
      const next = elements.slice();
      const at = Math.max(0, Math.min(op.at, next.length));
      next.splice(at, 0, op.element);
      return next;
    }
    case 'update':
      return elements.some((e) => e.id === op.element.id)
        ? // A Q&A board keeps whichever notes carry the newer rev (docs/specs/012-collaboration/qa-board.md):
          // a peer who moved the board before a vote reached them must not
          // send that vote back out of existence.
          elements.map((e) => (e.id === op.element.id ? preferNewerQa(e, op.element) : e))
        : elements;
    case 'remove':
      return elements.filter((e) => e.id !== op.id);
    case 'reorder': {
      const byId = new Map(elements.map((e) => [e.id, e]));
      const ordered = op.ids.map((id) => byId.get(id)).filter((e): e is Element => e !== undefined);
      const orderedIds = new Set(op.ids);
      const extras = elements.filter((e) => !orderedIds.has(e.id));
      return [...ordered, ...extras];
    }
  }
}

// Some fields of one element changed (docs/specs/013-workspace/share-roles.md "Integrity"). Only the room sends
// it, for a Participant's change: peers take exactly the fields that changed and keep their own live copy of the
// rest, which may be newer than anything saved. `set` writes fields, `clear` removes them. A room op, never a
// changeset's or a save's, so it lives beside ElementOp rather than in it.
export type ElementPatchOp = {
  kind: 'patch';
  id: string;
  set: Record<string, unknown>;
  clear?: string[];
};
export type RoomElementOp = ElementOp | ElementPatchOp;

export function applyElementPatch(elements: Element[], op: ElementPatchOp): Element[] {
  if (!elements.some((e) => e.id === op.id)) return elements;
  return elements.map((e) => {
    if (e.id !== op.id) return e;
    const next: Record<string, unknown> = { ...(e as Record<string, unknown>), ...op.set };
    for (const field of op.clear ?? []) delete next[field];
    // A patch never changes what an element is.
    next.id = e.id;
    next.type = e.type;
    return next as Element;
  });
}

// One room `el` op: a patch, or any ElementOp.
export function applyRoomElementOp(elements: Element[], op: RoomElementOp): Element[] {
  return op.kind === 'patch' ? applyElementPatch(elements, op) : applyElementOp(elements, op);
}

// Apply a sequence of ops in order (a whole commit's ops): exactly `ops.reduce(applyElementOp, elements)`,
// with runs of updates written through an index of ids rather than a pass over every element each, so a
// changeset touching thousands of elements stays linear.
export function applyElementOps(elements: Element[], ops: ElementOp[]): Element[] {
  let out = elements;
  // Whether `out` is a copy this call made, safe to write into.
  let owned = false;
  let positions: Map<string, number[]> | null = null;
  for (const op of ops) {
    if (op.kind !== 'update') {
      const next = applyElementOp(out, op);
      owned ||= next !== out;
      out = next;
      positions = null;
      continue;
    }
    positions ??= positionsOf(out);
    const at = positions.get(op.element.id);
    if (!at) continue;
    if (!owned) {
      out = out.slice();
      owned = true;
    }
    for (const i of at) out[i] = preferNewerQa(out[i]!, op.element);
  }
  return out;
}

// Where each id sits, every place for an id held twice.
function positionsOf(elements: readonly Element[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  elements.forEach((el, i) => {
    const known = positions.get(el.id);
    if (known) known.push(i);
    else positions.set(el.id, [i]);
  });
  return positions;
}

// The ops that undo `ops` applied to `before` (docs/specs/024-agents/agent-changesets.md "Revert"):
// shared by the edit-operations engine and the changeset revert. Derived by diffing back from the
// result, so removes, adds and a reorder in one changeset come back in exactly their places.
export function invertElementOps(before: Element[], ops: ElementOp[]): ElementOp[] {
  return diffToElementOps(applyElementOps(before, ops), before);
}
