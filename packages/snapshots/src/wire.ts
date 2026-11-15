// Snapshots' wire shapes (liveworkspace/docs/specs/013-snapshots/snapshots.md "API"; blueprint SN2): what the routes
// answer and the editor reads. No body ever travels in a list.

export type SnapshotKind = 'manual' | 'before-revert';

export type SnapshotAuthor = { id: string; name: string; color: string };

export type SnapshotSummary = {
  id: string;
  name: string | null;
  kind: SnapshotKind;
  author: SnapshotAuthor | null;
  createdAt: number;
  bytes: number;
};

export type SnapshotListResponse = { snapshots: SnapshotSummary[]; kept: number };
export type SnapshotTakeResponse = { snapshot: SnapshotSummary };
export type SnapshotRevertResponse = {
  reverted: { snapshotId: string; safetySnapshotId: string; generation: number };
};

export type SnapshotErrorCode =
  | 'snapshots_need_a_person'
  | 'not_found'
  | 'snapshot_too_large'
  | 'snapshot_unreadable'
  | 'snapshot_reverted'
  | 'method_not_allowed';

export type SnapshotError = { error: SnapshotErrorCode; message: string };

/** The item's generation (blueprint SN16 to SN19): on every answer about an item once it is above 0, and sent back by
 *  the editor on every request about that item. */
export const SNAPSHOT_GENERATION_HEADER = 'X-Snapshot-Generation';

/** On the fence's 409 alone: the editor holds the item from before a revert and reloads. */
export const SNAPSHOT_FENCED_HEADER = 'X-Snapshot-Fenced';

export { SNAPSHOT_REVERTED_CLOSE } from '@liveworkspace/api-schema/room-wire';
