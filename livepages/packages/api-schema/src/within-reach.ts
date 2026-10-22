// Within reach (docs/specs/004-interface-design/within-reach.md; blueprint
// docs/specs/004-interface-design/blueprints/within-reach.md): N most used items plus N recent ones,
// no item twice. One rule for every surface that offers a short "what you want next" list: the
// Draw-mode Shapes flyout and Explorer Home's Jump back in, in the browser and in the api worker.

/** What a surface measures of an item: how much it was used, and when last. */
export type WithinReachUse = { uses: number; lastUsedAt: number };

export type WithinReach<T> = { mostUsed: T[]; recent: T[] };

/**
 * The within-reach set of `items`: the `n` most used (only items used at all; ties to the most
 * recently used), then the `n` most recent not among them. Sorts are stable, so items equal on
 * every measure keep the order given. Nothing is padded: an empty place is the surface's business.
 */
export function withinReach<T>(
  items: readonly T[],
  n: number,
  useOf: (item: T) => WithinReachUse,
): WithinReach<T> {
  if (n <= 0) return { mostUsed: [], recent: [] };
  const measured = items.map((item) => ({ item, ...useOf(item) }));
  const mostUsed = measured
    .filter((m) => m.uses > 0)
    .sort((a, b) => b.uses - a.uses || b.lastUsedAt - a.lastUsedAt)
    .slice(0, n)
    .map((m) => m.item);
  const taken = new Set<T>(mostUsed);
  const recent = measured
    .filter((m) => !taken.has(m.item))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, n)
    .map((m) => m.item);
  return { mostUsed, recent };
}

/** `YYYY-MM-DD` of `at` in UTC: the day a use is counted on, the boundary every coalesced event uses. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}
