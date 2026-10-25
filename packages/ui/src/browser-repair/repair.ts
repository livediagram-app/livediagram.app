// The repair itself (docs/specs/007-editor/load-recovery.md "Repairing a browser"): remove every
// key a product's `isClearable` says may go (its kept-keys.ts) from local and session storage. Never IndexedDB (Offline Mode work
// live nowhere else), never cookies (repair never signs anyone out). Storage that cannot be read is
// skipped, so a private window with storage blocked repairs what it can and reports nothing cleared.

export type RepairResult = { cleared: string[] };

function clearableKeys(storage: Storage, isClearable: (key: string) => boolean): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isClearable(key)) keys.push(key);
  }
  return keys;
}

function repairStorage(
  get: () => Storage,
  isClearable: (key: string) => boolean,
  cleared: string[],
): void {
  let storage: Storage;
  try {
    storage = get();
  } catch {
    return;
  }
  let keys: string[];
  try {
    keys = clearableKeys(storage, isClearable);
  } catch {
    return;
  }
  // Collected first, removed after: removing while walking `key(i)` shifts the indices.
  for (const key of keys) {
    try {
      storage.removeItem(key);
      cleared.push(key);
    } catch {
      // A key that will not go stays; the rest still clear.
    }
  }
}

/** Clear every key `isClearable` passes from this origin's local and session storage. */
export function clearRepairableStorage(
  isClearable: (key: string) => boolean,
  win: Pick<Window, 'localStorage' | 'sessionStorage'> = window,
): RepairResult {
  const cleared: string[] = [];
  repairStorage(() => win.localStorage, isClearable, cleared);
  repairStorage(() => win.sessionStorage, isClearable, cleared);
  console.info(`[browser-repair] cleared ${cleared.length} keys`);
  return { cleared };
}
