// Fitting the editors' preferences under the api's cap (liveworkspace/docs/specs/011-workbench/editor-preferences.md
// "Fitting"). Each editor names its dead keys and, where it has one, its growable map; the trim is shared.

// The most the whole blob may be, in characters of `{"prefs":...}`. Each app's api takes a body of twice this (a
// patch of the whole blob with a null for each key dropped), and the accounts Worker keeps up to 16 KB a scope.
// Mirrored, not imported: the workers are not a dependency of the editors.
export const PREFERENCES_BODY_MAX = 4096;

export interface PreferencesFit {
  /** Keys nothing reads any more, dropped whole and first, in this order. */
  deadKeys: readonly string[];
  /** A map of `[count, lastUsed]` pairs whose least recently used entries go next. */
  growableMap?: string;
}

export function preferencesBodyLength(prefs: object): number {
  return JSON.stringify({ prefs }).length;
}

type Entry = [string, readonly [number, number]];

// How many entries, taken in order, free at least `excess` characters: each costs its serialised size plus a comma.
// Off by at most one character (the last entry has no comma), which the next measurement catches.
function entriesFreeing(sizes: readonly number[], excess: number): number {
  let saved = 0;
  let n = 0;
  while (n < sizes.length && saved < excess) saved += sizes[n++]! + 1;
  return n;
}

// When an entry was last used; a malformed one counts as the oldest.
function lastUsed(entry: unknown): number {
  return Array.isArray(entry) ? Number(entry[1]) || 0 : 0;
}

function oldestFirst(map: unknown): Entry[] {
  if (typeof map !== 'object' || map === null) return [];
  return (Object.entries(map) as Entry[]).sort((x, y) => lastUsed(x[1]) - lastUsed(y[1]));
}

// The blob, trimmed to fit: the dead keys first, then the growable map's least recently used entries. The same object
// when it already fits; when trimming cannot make it fit, what is left is answered and the api refuses the save (the
// device copy is kept). Each pass drops as many entries as the excess needs and measures once, so trimming is linear in
// the blob rather than one serialisation per dropped entry.
export function fitPreferences<P extends object>(prefs: P, fit: PreferencesFit): P {
  let length = preferencesBodyLength(prefs);
  if (length <= PREFERENCES_BODY_MAX) return prefs;
  let next = prefs as Record<string, unknown>;
  let dropped = 0;
  while (length > PREFERENCES_BODY_MAX) {
    const dead = fit.deadKeys.find((key) => key in next);
    const entries = fit.growableMap ? oldestFirst(next[fit.growableMap]) : [];
    if (dead !== undefined) {
      const { [dead]: gone, ...rest } = next;
      next = rest;
      dropped += Array.isArray(gone) ? gone.length : 1;
    } else if (fit.growableMap && entries.length > 0) {
      const excess = length - PREFERENCES_BODY_MAX;
      const sizes = entries.map(
        ([k, v]) => JSON.stringify(k).length + 1 + JSON.stringify(v).length,
      );
      const n = entriesFreeing(sizes, excess);
      next = { ...next, [fit.growableMap]: Object.fromEntries(entries.slice(n)) };
      dropped += n;
    } else {
      break;
    }
    length = preferencesBodyLength(next);
  }
  console.warn(`[preferences] trimmed to fit dropped=${dropped} length=${length}`);
  return next as P;
}
