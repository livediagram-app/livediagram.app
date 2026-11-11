// "An old livediagram.app guest's work was just merged into the person"
// (docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site"): a module-level signal
// the views that list documents re-read off, so the merged work shows without a browser refresh.
//
// Module-level rather than context: the claim runs outside React, and the views that listen are spread over
// modules that shouldn't each have to thread a callback down.

export type ApiWriteSignal = {
  /** An old guest's work was just merged into the person: views that list documents re-read. */
  claimed?: true;
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
