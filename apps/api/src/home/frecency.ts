// Frecency: how Jump back in ranks (docs/specs/013-workspace/explorer-home.md "Jump back in";
// blueprint "Frecency").
//
// A document's score at time t is the sum, over the days the person opened it, of
// 2^(-(t - t_d) / H): each open day adds one, and its weight halves every half-life H. Storing
// that sum would need re-decaying every row on every read. Instead each row stores one number,
// the frecency KEY: the instant at which the score decays to exactly one, so that
// score(t) = 2^((key - t) / H). The score rises with the key at every instant, so ordering by the
// key IS ordering by the score, whenever the read happens, straight off an index.

/** A fortnight: the spec's half-life. */
export const FRECENCY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** The decayed open days a key stands for at `at`. */
export function frecencyScore(key: number, at: number, halfLifeMs = FRECENCY_HALF_LIFE_MS): number {
  return 2 ** ((key - at) / halfLifeMs);
}

/** The key that stands for `score` at `at`. */
function keyFor(score: number, at: number, halfLifeMs: number): number {
  return Math.round(at + halfLifeMs * Math.log2(score));
}

/** The key after an open day at `at`: the decayed score so far, plus one. A first open keys at
 *  the open itself. */
export function nextFrecencyKey(
  previousKey: number | null,
  at: number,
  halfLifeMs = FRECENCY_HALF_LIFE_MS,
): number {
  if (previousKey === null) return at;
  return keyFor(frecencyScore(previousKey, at, halfLifeMs) + 1, at, halfLifeMs);
}

/** One key for a document opened under two identities: the two scores added at `at`. */
export function mergeFrecencyKeys(
  a: number,
  b: number,
  at: number,
  halfLifeMs = FRECENCY_HALF_LIFE_MS,
): number {
  return keyFor(
    frecencyScore(a, at, halfLifeMs) + frecencyScore(b, at, halfLifeMs),
    at,
    halfLifeMs,
  );
}
