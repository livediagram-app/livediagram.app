import type { ArticleOp, RoomElementOp } from '@livedocuments/document';
import type { RoomOp } from '@livedocuments/api-schema';

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
//
// An article's writing is held the same way, block by block and cell by cell (docs/specs/007-editor/article-pages.md
// "Collaboration"): two people committing the same paragraph at once each saw the other's text, for good, while the
// room kept the later one. A peer's put of a block we are writing, in its place, is left out; a put that moves it is
// still applied (its place is theirs), as is a remove.

export type OwnElementWrites = { held: Map<string, number> };

export function createOwnElementWrites(): OwnElementWrites {
  return { held: new Map() };
}

const keyOf = (tabId: string, elementId: string) => `${tabId}␟${elementId}`;

// The element an op writes in full, if any: an add or an update.
function writtenId(op: RoomElementOp): string | null {
  return op.kind === 'add' || op.kind === 'update' ? op.element.id : null;
}

const blockKey = (tabId: string, flow: string, id: string) => `${tabId}␟${flow}␟${id}`;
const cellKey = (tabId: string, flow: string, block: string, row: string, col: string) =>
  `${tabId}␟${flow}␟${block}␟${row}␟${col}`;

// The key of the block or cell one article op writes, if any: a put of a block, or a cell's text. Read
// defensively: a peer's op is untrusted until it is applied.
function articleKeyOf(tabId: string, flow: string, op: ArticleOp): string | null {
  if (!op || typeof op !== 'object') return null;
  if (op.kind === 'put') {
    const id = (op.block as { id?: unknown } | null)?.id;
    return typeof id === 'string' ? blockKey(tabId, flow, id) : null;
  }
  if (op.kind === 'cell') return cellKey(tabId, flow, op.block, op.row, op.col);
  return null;
}

function opsOf(op: RoomOp): readonly ArticleOp[] | null {
  return op.kind === 'article' && 'ops' in op && Array.isArray(op.ops) ? op.ops : null;
}

/** Holds what a save's room ops write: the elements of its `el` ops and the blocks and cells of its `article`
 *  ops. The returned function releases them, once. */
export function holdOwnRoomWrites(writes: OwnElementWrites, ops: readonly RoomOp[]): () => void {
  const keys: string[] = [];
  for (const op of ops) {
    if (op.kind === 'el') {
      const id = writtenId(op.op);
      if (id !== null) keys.push(keyOf(op.tabId, id));
      continue;
    }
    const flowOps = opsOf(op);
    if (!flowOps || op.kind !== 'article') continue;
    for (const o of flowOps) {
      const key = articleKeyOf(op.tabId, op.flow, o);
      if (key !== null) keys.push(key);
    }
  }
  return holdKeys(writes, keys);
}

function holdKeys(writes: OwnElementWrites, keys: readonly string[]): () => void {
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

/** A peer's article op without the in-place puts and cell texts of blocks and cells this editor is writing, which
 *  the room ordered before our write: the op itself when nothing is held back, null when nothing is left. */
export function withoutSupersededArticleOps<T extends RoomOp>(
  writes: OwnElementWrites,
  op: T,
): T | null {
  const flowOps = opsOf(op);
  if (!flowOps || op.kind !== 'article' || writes.held.size === 0) return op;
  const kept = flowOps.filter((o) => {
    // A put that places the block (new, or moved) is the peer's place for it: kept.
    if (o?.kind === 'put' && (o.after !== undefined || o.before !== undefined)) return true;
    const key = articleKeyOf(op.tabId, op.flow, o);
    return key === null || !writes.held.has(key);
  });
  if (kept.length === flowOps.length) return op;
  return kept.length === 0 ? null : { ...op, ops: kept };
}
