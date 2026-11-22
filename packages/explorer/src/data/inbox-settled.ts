// The Inbox rows done from the pane (resolved, marked done), per person, kept across a reload
// (one-explorer-contracts.md "What the reading pane can do"). The app writes at once, but the index hears it only on
// the app's next push (an item's outbox drains at most once a minute, longer while a push is retried), so a reload in
// that gap would list a resolved thread again. Each row is held at its time as it was done: while a read still lists
// it at that time it stays out, and a row that changes after (a new reply, reopened) comes back. Kept in localStorage
// so every tab of the address shares it, heard across tabs through the `storage` event; bounded, and each mark let go
// after SETTLED_HOLD_MS, by when the index has long caught up (a push still failing then shows the row again).

import type { InboxSettled } from '../explorer/inbox/inbox-keys';

/** The most rows held per person; past it, the oldest are let go. */
export const SETTLED_MAX = 200;
/** How long a done row is held out while the index still lists it unchanged. */
export const SETTLED_HOLD_MS = 60 * 60 * 1000;

export const settledStorageKey = (viewerId: string) => `liveworkspace:inbox-settled:${viewerId}`;

// key → [the row's time as it was done, when it was done].
type Marks = Record<string, [number, number]>;

export type SettledStore = {
  /** The rows held out now: key → the row's time as it was done. The same map until a mark changes. */
  current: () => ReadonlyMap<string, number>;
  add: (row: InboxSettled) => void;
  /** Hears this page's marks and another tab's. */
  subscribe: (listener: () => void) => () => void;
};

export type SettledDeps = {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
};

const isMark = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';

// The marks still held at `now`, newest SETTLED_MAX.
function live(value: unknown, now: number): Marks {
  const marks: Marks = {};
  if (!value || typeof value !== 'object') return marks;
  const kept = Object.entries(value).filter(
    (e): e is [string, [number, number]] => isMark(e[1]) && now - e[1][1] < SETTLED_HOLD_MS,
  );
  kept.sort((a, b) => b[1][1] - a[1][1]);
  for (const [k, m] of kept.slice(0, SETTLED_MAX)) marks[k] = m;
  return marks;
}

function parse(text: string | null, now: number): Marks {
  if (!text) return {};
  try {
    return live(JSON.parse(text), now);
  } catch {
    return {};
  }
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const mapOf = (marks: Marks): ReadonlyMap<string, number> =>
  new Map(Object.entries(marks).map(([k, m]) => [k, m[0]]));

export function createSettledStore(viewerId: string, deps: SettledDeps = {}): SettledStore {
  const key = settledStorageKey(viewerId);
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const now = deps.now ?? Date.now;
  const win = deps.win === undefined ? (typeof window === 'undefined' ? null : window) : deps.win;
  const listeners = new Set<() => void>();
  const load = (): Marks => {
    try {
      return parse(storage?.getItem(key) ?? null, now());
    } catch {
      return {};
    }
  };
  let marks = load();
  let map = mapOf(marks);
  const take = (next: Marks) => {
    marks = next;
    map = mapOf(next);
    for (const l of listeners) l();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) take(parse(e.newValue, now()));
  };
  return {
    current: () => map,
    add({ key: k, at }) {
      if (map.get(k) === at) return;
      // Another tab may have written since this page last heard: start from what is stored.
      const next = live({ ...load(), [k]: [at, now()] }, now());
      try {
        storage?.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode or full: the page holds its marks in memory.
      }
      take(next);
    },
    subscribe(listener) {
      if (listeners.size === 0) {
        // Nobody heard the storage meanwhile (another tab's marks, a cleared store): start from what it holds.
        const stored = load();
        if (JSON.stringify(stored) !== JSON.stringify(marks)) take(stored);
        win?.addEventListener('storage', onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) win?.removeEventListener('storage', onStorage);
      };
    },
  };
}

const stores = new Map<string, SettledStore>();

/** The page's done rows for this person: one store each, shared by the Inbox list and the editor's count. */
export function settledStoreFor(viewerId: string): SettledStore {
  let store = stores.get(viewerId);
  if (!store) {
    store = createSettledStore(viewerId);
    stores.set(viewerId, store);
  }
  return store;
}
