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

function read(storageKey: string): ReadonlySet<string> {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return START;
    const keys: unknown = JSON.parse(saved);
    return Array.isArray(keys)
      ? new Set(keys.filter((k): k is string => typeof k === 'string'))
      : START;
  } catch {
    // Private mode, no storage, or a garbled value: the starting folds.
    return START;
  }
}

export function createExpansion(storageKey = EXPANDED_KEY): Expansion {
  let current: ReadonlySet<string> | null = null;
  const listeners = new Set<() => void>();
  const get = () => {
    if (current === null) current = typeof window === 'undefined' ? START : read(storageKey);
    return current;
  };
  const set = (next: ReadonlySet<string>) => {
    current = next;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Ignored: expansion is a convenience.
    }
    for (const listener of listeners) listener();
  };
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    get,
    toggle(key) {
      const next = new Set(get());
      if (next.has(key)) next.delete(key);
      else next.add(key);
      set(next);
    },
    expand(...keys) {
      const now = get();
      if (keys.every((key) => now.has(key))) return;
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
