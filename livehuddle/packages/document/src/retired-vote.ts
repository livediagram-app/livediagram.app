// The Vote is gone from livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The Vote"). A tab saved while
// it existed may carry a dot vote (`vote`: its settings, its dots and, from before layers left, a layer scope): it is
// dropped. Run on every stored or incoming tab by the stored-tab migration (./stored-tab), beside ./retired-layers,
// and by the editor on a peer's `tab` op and `tab-meta` patch, so no data migration is needed: a tab is read the new
// way wherever it is read, and saved the new way the next time it is saved. Pure; the same object back when there is
// nothing to drop, so the common read allocates nothing.

/** The tab without its retired dot vote. */
export function dropRetiredVote<T extends object>(tab: T): T {
  if (!('vote' in tab)) return tab;
  const { vote: _vote, ...rest } = tab as T & { vote?: unknown };
  return rest as T;
}
