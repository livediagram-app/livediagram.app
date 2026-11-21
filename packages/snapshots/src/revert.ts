// Reverting an item to a snapshot (liveworkspace/docs/specs/014-snapshots/snapshots.md "Revert"; blueprint SN12, SN13,
// SN36), the one way it is done: the route calls this for a person, and a rule's Revert to Snapshot step calls it
// with no HTTP request at all. Its steps and guarantees are the same for both.

import {
  advanceGeneration,
  getSnapshot,
  readSnapshotText,
  takeSnapshot,
  type SnapshotDb,
} from './store';
import { SNAPSHOT_NAME_MAX } from './limits';
import type { SnapshotAuthor, SnapshotRevertResponse } from './wire';

/** What an app does for snapshots: its own export file, and its content replaced from one. */
export type SnapshotDoor = {
  /** The item as its export file now; null for an item never started. */
  exportFile: () => Promise<string | null>;
  /** The item's content replaced in place from a file this door exported. */
  replaceContent: (text: string) => Promise<'ok' | 'invalid' | 'too_large'>;
  /** After a revert: the room ends every session (the close code) and forgets its ledger. */
  afterRevert?: (generation: number) => void;
  /** The ids of the snapshots the item's rules name (Revert to Snapshot): kept beside the latest five, never removed
   *  to make room, and not deletable. Absent for an app with no rules. */
  kept?: () => readonly string[] | Promise<readonly string[]>;
};

/** The door's kept ids, none for a door that names none. */
export async function keptIdsOf(door: SnapshotDoor): Promise<readonly string[]> {
  return (await door.kept?.()) ?? [];
}

/** The automatic snapshot's name (SN12). */
export function beforeRevertName(target: string | null): string {
  const name = target ? `Before reverting to "${target}"` : 'Before reverting';
  return [...name].slice(0, SNAPSHOT_NAME_MAX).join('');
}

export type RevertInput = {
  db: SnapshotDb;
  itemId: string;
  /** The snapshot to put the item back to. */
  snapshotId: string;
  door: SnapshotDoor;
  /** Who the safety snapshot is by: the person reverting, or a rule (`automationAuthor(rule.name)`). */
  author: SnapshotAuthor | null;
};

/** Why nothing changed: the snapshot is gone, the item was never started, the snapshot (or the file it holds) can't
 *  be read, or the item as it is now is too large to keep first. */
export type RevertRefusal = 'snapshot_missing' | 'item_missing' | 'unreadable' | 'too_large';

export type RevertResult =
  { ok: true; reverted: SnapshotRevertResponse['reverted'] } | { ok: false; reason: RevertRefusal };

/**
 * SN12, SN13: read the target, keep the item as it is (never skipped), replace, advance the generation, tell the
 * room. Refused before anything changes when the target is gone or unreadable, or the safety snapshot can't be
 * taken. The safety snapshot is an ordinary one: it may remove the oldest of the latest five, never one a rule keeps.
 */
export async function revertToSnapshot(input: RevertInput): Promise<RevertResult> {
  const { db, itemId, snapshotId, door } = input;
  const refuse = (reason: RevertRefusal, detail: string = reason): RevertResult => {
    console.warn('[snapshots] refused', { itemId, snapshotId, reason: detail });
    return { ok: false, reason };
  };
  const target = await getSnapshot(db, itemId, snapshotId);
  if (!target) return { ok: false, reason: 'snapshot_missing' };
  const text = await readSnapshotText(db, itemId, snapshotId);
  if (typeof text !== 'string') return refuse('unreadable');
  const now = await door.exportFile();
  if (now === null) return { ok: false, reason: 'item_missing' };
  const safety = await takeSnapshot(db, {
    itemId,
    text: now,
    name: beforeRevertName(target.name),
    kind: 'before-revert',
    author: input.author,
    keptIds: await keptIdsOf(door),
  });
  if (!safety.ok) return refuse('too_large', 'safety-too-large');
  const replaced = await door.replaceContent(text);
  if (replaced !== 'ok')
    return refuse(replaced === 'too_large' ? 'too_large' : 'unreadable', replaced);
  const generation = await advanceGeneration(db, itemId);
  door.afterRevert?.(generation);
  const reverted = { snapshotId, safetySnapshotId: safety.snapshot.id, generation };
  console.info('[snapshots] reverted', { itemId, ...reverted });
  return { ok: true, reverted };
}
