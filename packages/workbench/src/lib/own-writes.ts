// This editor's writes the room has not sequenced yet: one tracker every editor shares
// (docs/specs/012-collaboration/realtime-conflict-resolution.md "Same-element edits converge" in each product).
//
// A save derives its room ops at the snapshot, writes the tab, then sends the ops; the room orders them after any peer
// op it already had. While a write is held, a peer's op for the same thing that reaches this editor was ordered BEFORE
// ours, and ours replaces it on every other screen. Each editor's `own-element-writes.ts` turns its own op shapes into
// keys (an element, an article block or cell, a Dashboard field) and decides what a held key leaves out; this module
// keeps the counts. A hold is released when the room confirms the op, when the write fails, or when the room cannot
// say (a closed socket, a timeout), so nothing is held for good.
//
// Whoever needs to know when a hold ends (the selection lock, which keeps holding an element we let go of until our
// change to it lands: selection-write-hold.ts) listens through `onOwnWritesReleased`.

export type OwnWrites = { held: Map<string, number>; released: Set<() => void> };

export function createOwnWrites(): OwnWrites {
  return { held: new Map(), released: new Set() };
}

/** The key of an element on a tab. */
export const ownWriteKey = (tabId: string, elementId: string): string => `${tabId}␟${elementId}`;

/** Whether this editor is writing `elementId` on `tabId`: its save's op has not been sequenced yet. */
export function isOwnWriteHeld(writes: OwnWrites, tabId: string, elementId: string): boolean {
  return writes.held.has(ownWriteKey(tabId, elementId));
}

/** Calls `listener` after every release of a hold; the returned function stops it. */
export function onOwnWritesReleased(writes: OwnWrites, listener: () => void): () => void {
  writes.released.add(listener);
  return () => void writes.released.delete(listener);
}

/** Holds `keys` (a key held twice needs two releases); the returned function releases them, once, then tells every
 *  `onOwnWritesReleased` listener. */
export function holdOwnWriteKeys(writes: OwnWrites, keys: readonly string[]): () => void {
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
    for (const listener of writes.released) listener();
  };
}
