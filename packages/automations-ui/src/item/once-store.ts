// A list read once per item and kept while the screen is open (blueprint item-ui.md "Performance": Reads): the
// item's snapshots, and its connections for what a listed rule needs. Outside React, so every reader shares one
// read. `ask` reads only the first time; `retry` reads again after a failure; the list is dropped when the last
// holder lets go (the screen closed), so the next opening reads afresh, if it needs to at all.

import type { OnceStatus } from './types';

export type OnceState<T> = { status: OnceStatus; list: readonly T[] };

type Entry<T> = {
  state: OnceState<T>;
  listeners: Set<() => void>;
  holders: number;
  // Which reading of the list this is: an answer to one since forgotten is dropped.
  reading: number;
};

export interface OnceStore<T> {
  get: (key: string) => OnceState<T>;
  subscribe: (key: string, listener: () => void) => () => void;
  /** Reads the list the first time it is asked for; later asks do nothing. */
  ask: (key: string, read: () => Promise<readonly T[]>) => void;
  /** Reads it again, unless a read is under way. */
  retry: (key: string, read: () => Promise<readonly T[]>) => void;
  /** Keeps the key's list until the returned release is called; with no holder left it is forgotten. */
  hold: (key: string) => () => void;
}

export function onceStore<T>(): OnceStore<T> {
  const idle: OnceState<T> = { status: 'idle', list: [] };
  const entries = new Map<string, Entry<T>>();
  const entryOf = (key: string): Entry<T> => {
    let entry = entries.get(key);
    if (!entry) {
      entry = { state: idle, listeners: new Set(), holders: 0, reading: 0 };
      entries.set(key, entry);
    }
    return entry;
  };
  const publish = (entry: Entry<T>, state: OnceState<T>) => {
    entry.state = state;
    for (const listener of entry.listeners) listener();
  };
  const read = (key: string, from: () => Promise<readonly T[]>) => {
    const entry = entryOf(key);
    const mine = ++entry.reading;
    publish(entry, { status: 'loading', list: entry.state.list });
    from().then(
      (list) => {
        if (mine === entry.reading) publish(entry, { status: 'ready', list });
      },
      () => {
        if (mine === entry.reading) publish(entry, { status: 'error', list: entry.state.list });
      },
    );
  };
  return {
    get: (key) => entries.get(key)?.state ?? idle,
    subscribe: (key, listener) => {
      const entry = entryOf(key);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    ask: (key, from) => {
      if (entryOf(key).state.status === 'idle') read(key, from);
    },
    retry: (key, from) => {
      if (entryOf(key).state.status !== 'loading') read(key, from);
    },
    hold: (key) => {
      const entry = entryOf(key);
      entry.holders += 1;
      return () => {
        entry.holders -= 1;
        if (entry.holders > 0) return;
        // Forgotten: a read under way is dropped, and whoever still listens sees it empty again.
        entry.reading += 1;
        if (entry.state !== idle) publish(entry, idle);
      };
    },
  };
}
