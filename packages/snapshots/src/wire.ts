// Snapshots' wire shapes (liveworkspace/docs/specs/014-snapshots/snapshots.md "API"; blueprint SN2): what the routes
// answer and the editor reads. No body ever travels in a list.

export type SnapshotKind = 'manual' | 'before-revert';

export type SnapshotAuthor = { id: string; name: string; color: string };

/** The author of what a rule does: a snapshot its Take Snapshot step takes, the safety snapshot its revert takes
 *  first. Never a person's id, so the row never reads "You", and a closed account's sweep never matches it. */
export const AUTOMATION_AUTHOR_ID = 'automation';
export const AUTOMATION_AUTHOR_COLOR = '#7c3aed';

/** A rule as a snapshot's author: named by the rule. */
export const automationAuthor = (ruleName: string): SnapshotAuthor => ({
  id: AUTOMATION_AUTHOR_ID,
  name: ruleName,
  color: AUTOMATION_AUTHOR_COLOR,
});

export type SnapshotSummary = {
  id: string;
  name: string | null;
  kind: SnapshotKind;
  author: SnapshotAuthor | null;
  createdAt: number;
  bytes: number;
  /** With Pro on, on a tier that keeps snapshots for a time: when this one is dropped. Absent where they are kept. */
  expiresAt?: number;
  /** In a list: whether a rule names it (Revert to Snapshot), so it is kept beside the latest five and can't be
   *  deleted. Absent from a take's or a revert's answer. */
  kept?: boolean;
};

/** With Pro on (snapshots.md "With Pro on"): how long the item's owner's tier keeps a snapshot (null is no age
 *  limit), and the owner's scope, for the offer. Absent with Pro off. */
export type SnapshotRetentionInfo = { days: number | null; owner: string | null };

export type SnapshotListResponse = {
  snapshots: SnapshotSummary[];
  kept: number;
  retention?: SnapshotRetentionInfo;
};
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
  | 'snapshot_kept'
  | 'method_not_allowed';

export type SnapshotError = { error: SnapshotErrorCode; message: string };

/** The item's generation (blueprint SN16 to SN19): on every answer about an item once it is above 0, and sent back by
 *  the editor on every request about that item. */
export const SNAPSHOT_GENERATION_HEADER = 'X-Snapshot-Generation';

/** On the fence's 409 alone: the editor holds the item from before a revert and reloads. */
export const SNAPSHOT_FENCED_HEADER = 'X-Snapshot-Fenced';

export { SNAPSHOT_REVERTED_CLOSE } from '@liveworkspace/api-schema/room-wire';
