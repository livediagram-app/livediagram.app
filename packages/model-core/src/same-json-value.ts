// Whether two plain JSON values are the same, whatever order their keys are in, an absent key and an undefined one
// alike: a value read from storage and one built in an editor list their fields differently. Shared by every
// product's by-id diffs (an article's blocks, a tab's pages), where a false "changed" would send an item nobody
// touched and overwrite a collaborator's newer copy of it.
export function sameJsonValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bs = b as unknown[];
    return a.length === bs.length && a.every((v, i) => sameJsonValue(v, bs[i]));
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return (
    ka.length === kb.length &&
    ka.every((k) =>
      sameJsonValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}
