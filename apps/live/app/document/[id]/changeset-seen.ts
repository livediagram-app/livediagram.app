import type { ChangesetRoomOp } from '@livediagram/api-schema';

// The changeset revision each loaded tab holds (docs/specs/024-agents/blueprints/agent-changesets.md
// "The editor"): set by every tab load, raised by every changeset applied, and sent with every save
// as X-Changeset-Seen so the api merges exactly the changesets this editor has not applied.
export type ChangesetSeen = Map<string, number>;

export function noteLoadedRev(seen: ChangesetSeen, tabId: string, rev: number): void {
  if (rev > (seen.get(tabId) ?? -1)) seen.set(tabId, rev);
}

export type ChangesetAdmission = 'skip' | 'apply' | 'apply-and-refetch' | 'refetch';

// What to do with one relayed changeset, in the blueprint's order. A tab this editor never loaded
// is skipped (its first load carries the change), except one the changeset itself created (CS23).
// A `prevRev` ahead of what this editor has seen means a relay never reached it: apply this one and
// re-read the tab, which brings the missed one and moves the seen revision (CS21).
export function admitChangesetOp(
  seen: ReadonlyMap<string, number>,
  op: ChangesetRoomOp,
  loadedTabIds: ReadonlySet<string>,
): ChangesetAdmission {
  const created = op.tab !== undefined && !loadedTabIds.has(op.tabId);
  if (!loadedTabIds.has(op.tabId) && !created) return 'skip';
  const at = seen.get(op.tabId) ?? 0;
  if (op.rev <= at) return 'skip';
  if (op.refetch) return 'refetch';
  if (!created && op.prevRev !== null && op.prevRev > at) return 'apply-and-refetch';
  return 'apply';
}
