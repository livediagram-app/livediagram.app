'use client';

import { useSyncExternalStore } from 'react';

// The machinery behind "is the user currently holding <key>": one singleton
// store per key, so subscribers re-render on the transitions (down -> up, up ->
// down) and not on every keystroke while the key is down.
//
// Two hooks wanted this — Shift (the hint banner, spec/09) and Cmd/Ctrl (the
// palette's shortcut badges) — and each had written the whole store out: the
// held flag, the listener set, the attached guard, fan-out, subscribe, and both
// snapshot functions. Byte-identical between them; only the key policy differed.
//
// Three properties live here so neither caller has to remember them:
//
//   - ONE window listener set serves the whole app. The alternative, every
//     button attaching its own keydown/keyup pair, is N listeners for a feature
//     that flips at human speed.
//   - Listeners attach lazily and only in the browser, so the store is inert
//     under SSR and `getServerSnapshot` reports not-held.
//   - `set` is a no-op when the value has not changed, which is what keeps a
//     held key from fanning out on every repeat event.
//
// `attach` receives that setter and wires whatever events its key needs. It is
// called at most once, and only where `window` exists.
export type HeldKeyStore = {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => boolean;
  getServerSnapshot: () => boolean;
};

export function createHeldKeyStore(attach: (set: (next: boolean) => void) => void): HeldKeyStore {
  let held = false;
  let attached = false;
  const listeners = new Set<() => void>();

  const set = (next: boolean): void => {
    if (next === held) return;
    held = next;
    for (const fn of listeners) fn();
  };

  const subscribe = (cb: () => void): (() => void) => {
    if (!attached && typeof window !== 'undefined') {
      attached = true;
      attach(set);
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  const getSnapshot = (): boolean => held;
  // Never "held" on the server: there is no keyboard, and reporting true would
  // hydrate a badge the client immediately removes.
  const getServerSnapshot = (): boolean => false;

  return { subscribe, getSnapshot, getServerSnapshot };
}

/** Subscribe a component to one of these stores. */
export function useHeldKey(store: HeldKeyStore): boolean {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
