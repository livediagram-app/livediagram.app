// Collapse concurrent identical calls into a single in-flight
// promise. The wrapped function keeps its original signature; the
// `keyOf` function derives a string identity from its arguments
// so different argument shapes don't share entries (e.g. one
// ownerId never blocks a different ownerId's request).
//
// Why this exists: React Strict Mode dev double-invokes effects,
// and the editor / new / explorer routes each mount surfaces that
// kick off the same list / load endpoints on first paint. Without
// dedup a signed-in user opening a route produces 2 to 6
// concurrent fetches for the same data. With it, the second + nth
// callers receive the in-flight promise the first one started,
// and the entry self-cleans in a finally so the next round-trip
// is fresh.
//
// Only safe for endpoints whose response is purely a function of
// the arguments (idempotent GETs). Writes / mutations stay
// un-deduped to keep their semantics obvious.
//
// Backed by api-client's apiLoadTab / apiListDiagrams /
// apiListSharedWith / apiListFolders. See lib/dedupe.test.ts for
// the contract.
export function dedupeInFlight<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyOf: (...args: TArgs) => string,
): (...args: TArgs) => Promise<TResult> {
  const inFlight = new Map<string, Promise<TResult>>();
  return (...args: TArgs): Promise<TResult> => {
    const key = keyOf(...args);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = (async (): Promise<TResult> => {
      try {
        return await fn(...args);
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, request);
    return request;
  };
}
