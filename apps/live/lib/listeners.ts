// The listener set behind every module store in the editor (a value held outside React and read through
// useSyncExternalStore): subscribe returns its own unsubscribe, notify tells every subscriber once.
export type Listeners = {
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
  // Drops every subscriber (a test's reset).
  clear: () => void;
};

export function createListeners(): Listeners {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: () => {
      // A snapshot: a notified component may unsubscribe and resubscribe synchronously, and a Set iterated
      // while it changes would call that listener again.
      for (const listener of [...listeners]) listener();
    },
    clear: () => listeners.clear(),
  };
}
