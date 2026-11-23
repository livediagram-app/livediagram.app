// The server side of snapshots, for each app's api inside its rooms (liveworkspace/docs/specs/014-snapshots).
export {
  answerSnapshotRoute,
  beforeRevertName,
  serveSnapshots,
  snapshotName,
  type ServeSnapshots,
  type SnapshotCaller,
  type SnapshotDoor,
} from './routes';
export {
  revertToSnapshot,
  type RevertInput,
  type RevertRefusal,
  type RevertResult,
} from './revert';
export { fenceStaleWrite, requestGeneration, stampGeneration } from './fence';
export {
  RETENTION_UNKNOWN,
  retentionOf,
  snapshotRetention,
  type SnapshotRetention,
} from './retention';
export {
  advanceGeneration,
  chunkText,
  clearSnapshotAuthors,
  deleteSnapshot,
  dropSnapshotsBefore,
  listSnapshots,
  readGeneration,
  readSnapshotText,
  renameSnapshot,
  rewriteSnapshotText,
  SNAPSHOT_SCHEMA,
  snapshotId,
  takeSnapshot,
  utf8Bytes,
  type SnapshotDb,
  type SnapshotStatement,
} from './store';
export * from './limits';
export * from './wire';
