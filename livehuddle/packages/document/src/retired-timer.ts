// The Session strip's Timer is gone from livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The Session
// strip's Timer"): a meeting's clock is a Timer or Stopwatch piece now (docs/specs/009-elements/timer-and-stopwatch.md).
// A tab saved while the strip existed may carry `timer` (`{ mode, running, durationMs?, anchorAt?, frozenMs?,
// startedAt? }`): it is dropped. Run beside ./retired-vote by the stored-tab migration (./stored-tab) and by the editor
// on a peer's `tab` op and `tab-meta` patch, so no data migration is needed: the old timer simply stops showing, and
// the tab is saved without it the next time it is saved. Pure; the same object back when there is nothing to drop.

/** The tab without the retired Session strip timer. */
export function dropRetiredTimer<T extends object>(tab: T): T {
  if (!('timer' in tab)) return tab;
  const { timer: _timer, ...rest } = tab as T & { timer?: unknown };
  return rest as T;
}
