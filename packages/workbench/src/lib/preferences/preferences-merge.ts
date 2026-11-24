// The pure parts of the editors' preferences store (liveworkspace/docs/specs/011-workbench/editor-preferences.md):
// the load's merge, a save's patch and a change's rebase. No storage, no network: the store calls these.

export type PreferencesBlob = Record<string, unknown>;

// Two values are one setting's same value. Whole-value comparison: an object (the presenter settings, the shape
// picks) is one setting, replaced rather than merged. Linear in the blob, which is held to 4 KB.
export function samePreference(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export interface MergeInput {
  /** The browser's copy. */
  local: PreferencesBlob;
  /** The account's copy, as the load's answer gives it. */
  server: PreferencesBlob;
  /** The last copy agreed for this owner; null when there is none for this owner. */
  base: PreferencesBlob | null;
  /** Whether this browser holds a change for this owner the server has not confirmed. */
  unsynced: boolean;
}

// The load's merge ("Loading"). With a last copy agreed it is a three-way merge per key: a key this device did not
// change follows the server (dropped when the server dropped it), a key only this device changed keeps this device's
// value, and a key both changed goes to whichever side holds the newer change. Without one, nothing tells a key this
// device added from one the server dropped, so none is dropped: an unsaved change wins, and otherwise the server's
// value wins for every key both hold.
export function mergePreferences({ local, server, base, unsynced }: MergeInput): PreferencesBlob {
  if (!base) return unsynced ? { ...server, ...local } : { ...local, ...server };
  const merged: PreferencesBlob = {};
  for (const key of new Set([
    ...Object.keys(local),
    ...Object.keys(server),
    ...Object.keys(base),
  ])) {
    const mine = local[key];
    const theirs = server[key];
    const agreed = base[key];
    let value: unknown;
    if (samePreference(mine, agreed)) value = theirs;
    else if (samePreference(theirs, agreed)) value = mine;
    else value = unsynced ? mine : theirs;
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

// A save's patch ("Saving"): the keys of `next` whose value differs from `base`, each whole, and null for each key
// `base` holds that `next` dropped. With no base (the server's copy is not known yet), every key of `next` and no
// deletions. A key held as `undefined` counts as absent.
export function preferencesPatch(
  base: PreferencesBlob | null,
  next: PreferencesBlob,
): PreferencesBlob {
  const patch: PreferencesBlob = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (!base || !samePreference(base[key], value)) patch[key] = value;
  }
  if (base) for (const key of Object.keys(base)) if (next[key] === undefined) patch[key] = null;
  return patch;
}

// A change a caller built on its render's snapshot, moved onto the freshest copy ("Writing"): only the keys `next`
// changed from `snapshot` are applied over `latest`, so a key another tab wrote since that render survives.
export function rebasePreferences<P extends object>(latest: P, snapshot: P, next: P): P {
  const rebased: PreferencesBlob = { ...(latest as unknown as PreferencesBlob) };
  const before = snapshot as unknown as PreferencesBlob;
  const after = next as unknown as PreferencesBlob;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] === after[key]) continue;
    if (key in after) rebased[key] = after[key];
    else delete rebased[key];
  }
  return rebased as unknown as P;
}
