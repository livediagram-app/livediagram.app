// Snapshots' numbers (liveworkspace/docs/specs/014-snapshots/blueprints/snapshots.md SN1).

/** How many snapshots an item keeps, manual and automatic alike; taking one more removes the oldest. Safe range 1 to
 *  20: each is the whole item. One a rule names is kept beside them, uncounted. */
export const SNAPSHOTS_KEPT = 5;

/** How many snapshots an item's rules may keep beside the latest SNAPSHOTS_KEPT (a rule's Revert to Snapshot names
 *  one). With both at their most an item holds ten: 320 MiB at the size cap, inside a Durable Object's storage. The
 *  rules' store refuses one more when a rule is saved (409 `automation_snapshots_full`). */
export const SNAPSHOTS_KEPT_BY_RULES = 5;

/** The largest snapshot, in UTF-8 bytes of the export file. Five at the cap are 160 MiB, well inside a Durable
 *  Object's storage; the export itself is built in memory as the Drive mirror builds it. Safe range 1 to 64 MiB. */
export const SNAPSHOT_MAX_BYTES = 32 * 1024 * 1024;

/** UTF-16 units per stored chunk. One unit is at most 3 UTF-8 bytes (a surrogate pair is 4 bytes for 2 units), so a
 *  chunk is at most 1.8 MB, under the Durable Object's 2 MB row limit. Safe range 100,000 to 650,000. */
export const SNAPSHOT_CHUNK_CHARS = 600_000;

/** The longest snapshot name, in characters (code points). Safe range 40 to 200. */
export const SNAPSHOT_NAME_MAX = 80;
