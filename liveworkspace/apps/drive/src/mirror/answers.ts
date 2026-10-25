// What Cloud Sync's row and the Explorer's marks read (liveworkspace/docs/drive.md "Connecting", "The Explorer shows
// each item's sync"): answered from the person's rows alone, with no call to Google or the index.

import {
  driveRootName,
  type DriveConnectionAnswer,
  type DriveEnvironment,
  type DriveMarksAnswer,
  type DriveMarkState,
} from '@liveworkspace/drive';
import type { MirrorStore, StoredRow } from './store';

export function connectionAnswer(
  store: MirrorStore,
  environment: DriveEnvironment,
  now: number,
): DriveConnectionAnswer {
  const connection = store.connection();
  if (!connection) return { connected: false };
  let items = 0;
  const notices: Extract<DriveConnectionAnswer, { connected: true }>['notices'] = [];
  for (const row of store.rows()) {
    if (row.kind === 'item' && !row.trashed) items += 1;
    if (row.notice) notices.push({ id: row.id, app: row.app, kind: row.kind, name: row.localName });
  }
  const pending = connection.pendingSealed !== null && (connection.pendingUntil ?? 0) > now;
  return {
    connected: true,
    status: connection.status,
    rootFolderName: connection.rootName ?? driveRootName(environment),
    connectedAt: connection.connectedAt,
    lastSyncedAt: connection.lastSyncedAt,
    syncing: connection.syncing,
    progress: connection.progress,
    items,
    notices,
    pendingSwitchUntil: pending ? connection.pendingUntil : null,
  };
}

function itemState(row: StoredRow, failed: boolean, syncing: boolean): DriveMarkState {
  if (failed) return 'failed';
  // Synced when the item's updatedAt last uploaded is at least the one last seen.
  const behind = row.mirroredUpdatedAt === null || (row.seenUpdatedAt ?? 0) > row.mirroredUpdatedAt;
  if (!behind) return 'synced';
  return syncing ? 'syncing' : 'waiting';
}

export function marksAnswer(store: MirrorStore): DriveMarksAnswer {
  const connection = store.connection();
  if (!connection) return { marks: [] };
  const failures = store.failures();
  const marks: DriveMarksAnswer['marks'] = [];
  const seen = new Set<string>();
  for (const row of store.rows()) {
    // Binned here (or gone from the person's own work): no longer theirs to mark.
    if (row.trashed) continue;
    const state =
      row.kind === 'item' ? itemState(row, failures.has(row.id), connection.syncing) : 'synced';
    marks.push({ id: row.id, kind: row.kind, state, notice: row.notice });
    seen.add(row.id);
  }
  // An item whose first write failed has no row yet.
  for (const id of failures)
    if (!seen.has(id)) marks.push({ id, kind: 'item', state: 'failed', notice: null });
  return { marks };
}
