// "Something was just written to the api" — a module-level signal the
// Timeline listens to so the feed reflects the reader's own actions
// without a browser refresh (docs/specs/013-workspace/timeline.md §2.4b).
//
// Every write goes out through `apiFetch` (core.ts), which raises this
// after any successful non-GET, so a subscriber never has to enumerate
// the verbs that produce a timeline event: delete, rename, duplicate,
// move, a folder made, a theme saved, a teammate removed. Listing them
// at the call sites was the first design and the wrong one — the list
// would drift the first time a route gained an emit.
//
// A DELETE that ends an entity additionally names it, so the feed can
// drop that entity's earlier cards on the spot (mirroring the worker's
// cascade, docs/specs/013-workspace/timeline.md §3.5) instead of waiting for a re-read that only
// covers the first page anyway.
//
// Module-level rather than context: the api client has no React in it,
// and the Explorer's mutation hooks are spread over a dozen modules
// that shouldn't each have to thread a callback down.

export type ApiWriteSignal = {
  /** The entity a DELETE just ended, in the Timeline's own terms. */
  purge?: { sourceType: string; sourceId: string };
};

type Listener = (signal: ApiWriteSignal) => void;

const listeners = new Set<Listener>();

export function subscribeApiWrites(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyApiWrite(signal: ApiWriteSignal = {}): void {
  for (const listener of listeners) {
    try {
      listener(signal);
    } catch {
      // A subscriber's bug must never surface as a failed save.
    }
  }
}

// Test seam.
export function resetApiWriteListeners(): void {
  listeners.clear();
}
