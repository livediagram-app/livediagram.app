// Outbound: what Drive must do to match liveworkspace (liveworkspace/docs/drive.md "Outbound"). Pure: returns ops
// in the order the service runs them. Drive parents are resolved when an op runs, since a folder created earlier in
// the same pass is the parent of what follows.

import { stripDriveName } from '../formats';
import {
  expectedFolderParent,
  expectedItemParent,
  foldersParentsFirst,
  rowKey,
  type MirrorSnapshot,
} from './snapshot';
import type { DriveRow, MirrorFolder, MirrorItem } from './types';

export type OutboundOp =
  | { op: 'create-folder'; folder: MirrorFolder }
  | { op: 'update-folder'; folder: MirrorFolder; row: DriveRow; rename: boolean; move: boolean; untrash: boolean }
  | { op: 'create-file'; item: MirrorItem }
  | {
      op: 'update-file';
      item: MirrorItem;
      row: DriveRow;
      rename: boolean;
      move: boolean;
      untrash: boolean;
      content: boolean;
    }
  // Binned here, purged, or no longer the person's own (moved into a team): the file goes to Drive's bin and the row
  // stays, so a way back restores it. The service can't tell a purge from a move into a team (the index answers
  // neither), so it never deletes a file: Drive empties its bin after 30 days, and inbound forgets the row then.
  | { op: 'trash-file'; row: DriveRow }
  // Deleted here: the Drive folder goes to the bin (its contents have moved up by now) and the row is dropped.
  | { op: 'bin-folder'; row: DriveRow };

export type OutboundPlan = { ops: OutboundOp[]; nextDueAt: number | null };

type OutboundOptions = {
  now: number;
  // Write every changed item now, ignoring the interval (Check now).
  flush: boolean;
  writeIntervalMs: number;
};

// Drive's name no longer stands for liveworkspace's: renamed here, a rename in Drive that lost a conflict, or a
// name emptied in Drive (which keeps the old one, so Drive gets it back).
const namesDiffer = (localName: string, row: DriveRow) =>
  localName !== row.localName || stripDriveName(row.name) === null;

export function planOutbound(snapshot: MirrorSnapshot, opts: OutboundOptions): OutboundPlan {
  const ops: OutboundOp[] = [];
  let nextDueAt: number | null = null;

  for (const folder of foldersParentsFirst(snapshot)) {
    const row = snapshot.rows.get(rowKey('folder', folder.id));
    if (!row) {
      ops.push({ op: 'create-folder', folder });
      continue;
    }
    const parent = expectedFolderParent(snapshot, folder, row);
    const rename = namesDiffer(folder.name, row);
    const move = parent !== null && parent !== row.parentId;
    if (rename || move || row.trashed) ops.push({ op: 'update-folder', folder, row, rename, move, untrash: row.trashed });
  }

  const live = [...snapshot.items.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const item of live) {
    const row = snapshot.rows.get(rowKey('item', item.id));
    if (!row) {
      ops.push({ op: 'create-file', item });
      continue;
    }
    const parent = expectedItemParent(snapshot, item, row);
    const rename = namesDiffer(item.name, row);
    const move = parent !== null && parent !== row.parentId;
    let content = false;
    if (item.updatedAt > (row.mirroredUpdatedAt ?? 0)) {
      const dueAt =
        opts.flush || row.contentWrittenAt === null ? opts.now : row.contentWrittenAt + opts.writeIntervalMs;
      if (dueAt <= opts.now) content = true;
      else nextDueAt = nextDueAt === null ? dueAt : Math.min(nextDueAt, dueAt);
    }
    if (rename || move || row.trashed || content) {
      ops.push({ op: 'update-file', item, row, rename, move, untrash: row.trashed, content });
    }
  }

  const folderRowsGone: DriveRow[] = [];
  for (const row of snapshot.rows.values()) {
    if (row.kind === 'folder') {
      if (!snapshot.folders.has(row.id)) folderRowsGone.push(row);
      continue;
    }
    if (!snapshot.items.has(row.id) && !row.trashed) ops.push({ op: 'trash-file', row });
  }
  // Folders last: their contents have moved up by now.
  for (const row of folderRowsGone) ops.push({ op: 'bin-folder', row });

  return { ops, nextDueAt };
}
