// Which sidebar rows are open (liveplanner/docs/specs/013-workspace/explorer-structure.md "Expansion"): one set of
// folder ids, team keys and the two fixed keys, made once per Explorer and remembered in this browser. It is read
// synchronously the first time the sidebar asks, so the tree paints open where it was left, never closed and then
// open. A space opens and folds only when the person does it (one-explorer.md "A space opens and folds only when the
// person does it"); with nothing kept every space starts folded. Making a folder opens the rows above it, so the new
// row is in sight.

import type { Folder } from '@liveworkspace/index-client';

export const EXPANDED_KEY = 'liveworkspace:explorer-expanded';
export const MY_WORK = 'my-work';
export const LIBRARY = 'library';
export const teamKey = (teamId: string) => `team:${teamId}`;
// Offline's space row (one-explorer.md "Offline, a Space").
export const LOCAL_ROW_KEY = 'this-browser';

// A space's own row: My Work, a team, Offline. Folders and the Library are not spaces.
export const isSpaceKey = (key: string) =>
  key === MY_WORK || key === LOCAL_ROW_KEY || key.startsWith('team:');

export type Expansion = {
  subscribe: (onChange: () => void) => () => void;
  get: () => ReadonlySet<string>;
  toggle: (key: string) => void;
  /** Opens these rows; nothing changes (and nobody re-renders) when they all are. */
  expand: (...keys: string[]) => void;
};

// With nothing kept: every space folded, My Work too, and the Library folded (Work Tracker 1420).
const START: ReadonlySet<string> = new Set();

// What this browser keeps: the starting folds when nothing is kept or the value is garbled, and null when storage
// can't be read at all (private mode, blocked), where the store goes on from what this page holds.
function readKept(storageKey: string): ReadonlySet<string> | null {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!saved) return START;
  try {
    const keys: unknown = JSON.parse(saved);
    return Array.isArray(keys)
      ? new Set(keys.filter((k): k is string => typeof k === 'string'))
      : START;
  } catch {
    return START;
  }
}

const sameKeys = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));

/**
 * The sidebar's open rows. Every change is made to what this browser keeps now, never to this page's older copy of it
 * (Work Tracker 1495): another Explorer on the same origin (another tab, an editor's workbench frame) opens and folds
 * rows too, and a change made over a stale copy wrote back every space that copy still held open, so a space the
 * person had folded came back open on its own. Another tab's change is heard (the `storage` event) and drawn at once.
 */
export function createExpansion(storageKey = EXPANDED_KEY): Expansion {
  let current: ReadonlySet<string> | null = null;
  // The last write failed (storage full or blocked): this page's copy is then the only true one.
  let unsaved = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const get = () => {
    if (current === null)
      current = typeof window === 'undefined' ? START : (readKept(storageKey) ?? START);
    return current;
  };
  // What a change starts from: what this browser keeps now, unless it can't be read or the last write didn't take.
  const latest = () => {
    const kept = unsaved ? null : readKept(storageKey);
    if (kept && !sameKeys(kept, get())) current = kept;
    return get();
  };
  const set = (next: ReadonlySet<string>) => {
    current = next;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      unsaved = false;
    } catch {
      // Kept for this page alone: expansion is a convenience.
      unsaved = true;
    }
    notify();
  };
  // Another tab changed the same key (or cleared storage).
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== storageKey) return;
    const kept = readKept(storageKey);
    if (!kept || sameKeys(kept, get())) return;
    current = kept;
    unsaved = false;
    notify();
  };
  return {
    subscribe(onChange) {
      if (listeners.size === 0 && typeof window !== 'undefined')
        window.addEventListener('storage', onStorage);
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && typeof window !== 'undefined')
          window.removeEventListener('storage', onStorage);
      };
    },
    get,
    toggle(key) {
      const next = new Set(latest());
      if (next.has(key)) next.delete(key);
      else next.add(key);
      set(next);
    },
    expand(...keys) {
      const before = get();
      const now = latest();
      if (keys.every((key) => now.has(key))) {
        // Open already in what is kept; a change another page made is drawn all the same.
        if (now !== before) notify();
        return;
      }
      set(new Set([...now, ...keys]));
    },
  };
}

/** The rows to open so a folder's own row shows its children: its space's row and every folder from the root down
 *  to it. Stops at a cycle or a missing parent. */
export function rowsAbove(
  folderId: string,
  byId: ReadonlyMap<string, Pick<Folder, 'id' | 'parentId' | 'teamId'>>,
): string[] {
  const chain: string[] = [];
  let at = byId.get(folderId);
  const root = at ? (at.teamId ? teamKey(at.teamId) : MY_WORK) : null;
  while (at && !chain.includes(at.id)) {
    chain.push(at.id);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return root ? [root, ...chain.reverse()] : [folderId];
}
