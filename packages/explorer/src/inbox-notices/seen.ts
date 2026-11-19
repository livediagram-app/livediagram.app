// The Inbox rows this browser has shown, dismissed or read, per person (inbox-notices.md "How a notice goes away"):
// a row seen at its time never notifies again here, in any tab of the address, until it changes. A row dismissed or
// read is also `gone`: a notice still showing it in another tab closes it. Kept in localStorage so every tab shares
// it, and heard across tabs through the `storage` event. `since` is when this browser first watched for the person:
// what was in the Inbox before never notifies.

/** The most rows kept per person, in each map; past it, the oldest are let go. */
export const SEEN_MAX = 500;

export const seenStorageKey = (viewerId: string) => `liveworkspace:inbox-notices:${viewerId}`;

export type SeenRow = { key: string; at: number };

export type SeenStore = {
  since: () => number;
  /** Whether this row was seen at this time or later. */
  has: (row: SeenRow) => boolean;
  /** Whether this row was dismissed or read at this time or later. */
  gone: (row: SeenRow) => boolean;
  /** Seen (shown here); with `gone`, dismissed or read too. */
  mark: (rows: readonly SeenRow[], gone?: boolean) => void;
  /** Lets go of rows the Inbox no longer lists. */
  prune: (listed: ReadonlySet<string>) => void;
  /** Hears another tab's marks (and this page's own). */
  subscribe: (listener: () => void) => () => void;
};

type Marks = Record<string, number>;
type Held = { since: number; seen: Marks; gone: Marks };

export type SeenDeps = {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
};

function marksOf(value: unknown): Marks {
  const marks: Marks = {};
  if (!value || typeof value !== 'object') return marks;
  for (const [k, at] of Object.entries(value)) if (typeof at === 'number') marks[k] = at;
  return marks;
}

function parse(text: string | null): Held | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Partial<Held> | null;
    if (!v || typeof v.since !== 'number') return null;
    return { since: v.since, seen: marksOf(v.seen), gone: marksOf(v.gone) };
  } catch {
    return null;
  }
}

const hasMark = (marks: Marks, row: SeenRow) => (marks[row.key] ?? -Infinity) >= row.at;

// Adds the rows to a copy of the marks, keeping the newest SEEN_MAX; null when nothing changed.
function withMarks(marks: Marks, rows: readonly SeenRow[]): Marks | null {
  const next = { ...marks };
  let changed = false;
  for (const r of rows) {
    if (hasMark(next, r)) continue;
    next[r.key] = r.at;
    changed = true;
  }
  if (!changed) return null;
  const keys = Object.keys(next);
  if (keys.length > SEEN_MAX) {
    keys.sort((a, b) => next[b]! - next[a]!);
    for (const k of keys.slice(SEEN_MAX)) delete next[k];
  }
  return next;
}

const listedOnly = (marks: Marks, listed: ReadonlySet<string>): Marks =>
  Object.fromEntries(Object.entries(marks).filter(([k]) => listed.has(k)));

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createSeenStore(viewerId: string, deps: SeenDeps = {}): SeenStore {
  const key = seenStorageKey(viewerId);
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const now = deps.now ?? Date.now;
  const win = deps.win === undefined ? (typeof window === 'undefined' ? null : window) : deps.win;
  const listeners = new Set<() => void>();
  const load = (): Held | null => {
    try {
      return parse(storage?.getItem(key) ?? null);
    } catch {
      return null;
    }
  };
  const save = () => {
    try {
      storage?.setItem(key, JSON.stringify(held));
    } catch {
      // Private mode or full: the page keeps its marks in memory.
    }
  };
  let held: Held = load() ?? { since: now(), seen: {}, gone: {} };
  if (!load()) save();
  const give = () => {
    for (const l of listeners) l();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== key) return;
    const next = parse(e.newValue);
    if (!next) return;
    held = next;
    give();
  };
  return {
    since: () => held.since,
    has: (row) => hasMark(held.seen, row),
    gone: (row) => hasMark(held.gone, row),
    mark(rows, gone = false) {
      // Another tab may have written since this page last heard: start from what is stored.
      const base = load() ?? held;
      const seen = withMarks(base.seen, rows);
      const goneMarks = gone ? withMarks(base.gone, rows) : null;
      if (!seen && !goneMarks) return;
      held = { since: held.since, seen: seen ?? base.seen, gone: goneMarks ?? base.gone };
      save();
      give();
    },
    prune(listed) {
      const seen = listedOnly(held.seen, listed);
      const gone = listedOnly(held.gone, listed);
      const same =
        Object.keys(seen).length === Object.keys(held.seen).length &&
        Object.keys(gone).length === Object.keys(held.gone).length;
      if (same) return;
      held = { since: held.since, seen, gone };
      save();
    },
    subscribe(listener) {
      if (listeners.size === 0) win?.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) win?.removeEventListener('storage', onStorage);
      };
    },
  };
}

const stores = new Map<string, SeenStore>();

/** The page's seen rows for this person: one store each, shared by the notices and the Inbox list. */
export function seenStoreFor(viewerId: string): SeenStore {
  let store = stores.get(viewerId);
  if (!store) {
    store = createSeenStore(viewerId);
    stores.set(viewerId, store);
  }
  return store;
}
