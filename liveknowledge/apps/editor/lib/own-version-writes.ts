// The changesets this editor's Version History is writing (docs/specs/006-document/version-history.md "Restore";
// blueprint VH18): a restore or a copy comes back through the room as a relayed changeset, and the person who made it
// already has the panel's own toast (with its Undo), so the changeset toast stands down for it. A write is marked
// before its request, as the relay can arrive before the answer, and unmarked a little after the answer.
import type { ChangesetRoomOp } from '@liveknowledge/api-schema';

type Match = (op: Pick<ChangesetRoomOp, 'id' | 'tabId' | 'summary'>) => boolean;

// How long after the answer a relay still counts as this write's: a slow room delivers within a second or two.
export const OWN_WRITE_GRACE_MS = 10_000;

const pending = new Set<Match>();

/** Marks a write in flight; returns the function that unmarks it once its grace has run. */
export function beginOwnVersionWrite(match: Match): () => void {
  pending.add(match);
  return () => {
    setTimeout(() => pending.delete(match), OWN_WRITE_GRACE_MS);
  };
}

/** Whether a relayed changeset is one of this editor's restores or copies. */
export function isOwnVersionWrite(op: Pick<ChangesetRoomOp, 'id' | 'tabId' | 'summary'>): boolean {
  for (const match of pending) if (match(op)) return true;
  return false;
}

export function resetOwnVersionWrites(): void {
  pending.clear();
}
