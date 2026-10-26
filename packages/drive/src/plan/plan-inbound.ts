// Inbound: what one Drive change means for liveworkspace (liveworkspace/docs/drive.md "Inbound"). Pure: the service
// applies the decision through the index, acting as the person.
//
// A row is the last Drive state the service knows. A change is an echo of the service's own write when nothing it
// carries differs from the row; otherwise each differing attribute is a foreign change. Whatever is applied, the row
// is re-recorded with Drive's state, so a change liveworkspace didn't take (a lost conflict) is undone by the next
// outbound pass rather than lingering.

import {
  DRIVE_FOLDER_MIME,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ITEM_ID,
  DRIVE_PROP_ORIGIN,
} from '../constants';
import { stripDriveName } from '../formats';
import type { DriveChange, DriveFile } from '../server/drive-client';
import {
  expectedFolderParent,
  expectedItemParent,
  fileState,
  folderDeletedHere,
  localFolderForParent,
  rowKey,
  type MirrorSnapshot,
} from './snapshot';
import type { DriveRow, MirrorItem } from './types';

// The index's name ceiling.
export const LOCAL_NAME_MAX = 200;

export type InboundType = 'Rename' | 'Move' | 'Trash' | 'Restore' | 'Purge' | 'UnknownFolder';

export type InboundEffect =
  | { kind: 'rename-item'; id: string; name: string }
  | { kind: 'move-item'; id: string; folderId: string | null }
  | { kind: 'trash-item'; id: string }
  | { kind: 'restore-item'; id: string }
  | { kind: 'purge-item'; id: string }
  | { kind: 'rename-folder'; id: string; name: string }
  | { kind: 'move-folder'; id: string; parentId: string | null }
  | { kind: 'bin-folder'; id: string }
  | { kind: 'recreate-folder'; id: string; name: string; parentId: string | null; fileId: string };

export type InboundDecision =
  | { kind: 'ignore'; reason: string }
  | { kind: 'echo' }
  | { kind: 'forget'; row: DriveRow; reason: string }
  | { kind: 'adopt'; row: DriveRow }
  | { kind: 'apply'; effects: InboundEffect[]; record: DriveRow; types: InboundType[] };

function blankRow(
  kind: DriveRow['kind'],
  id: string,
  app: DriveRow['app'],
  file: DriveFile,
  localName: string,
): DriveRow {
  return {
    kind,
    id,
    app,
    driveFileId: file.id,
    ...fileState(file),
    localName,
    mirroredUpdatedAt: null,
    contentWrittenAt: null,
    notice: null,
    noticeParentId: null,
  };
}

// A file the service made for this person: tagged with this origin, and in their own Drive. Tags are only app
// properties, which anyone with a token for this client can set on a file of their own and share; the person
// opening such a file with liveworkspace must never have it taken for one of theirs (a folder recreated, an item's
// file adopted, so its writes go to someone else's file).
const ours = (file: DriveFile, snapshot: MirrorSnapshot) =>
  file.ownedByMe && file.appProperties[DRIVE_PROP_ORIGIN] === snapshot.origin;

// A file the service made but holds no row for: a folder deleted here and restored in Drive, or a file seen
// before its row was recorded.
function planUnrecorded(change: DriveChange, snapshot: MirrorSnapshot): InboundDecision {
  const file = change.file;
  if (!file || change.removed) return { kind: 'ignore', reason: 'unknown-removed' };
  // The root is tracked by id, never a row.
  if (change.fileId === snapshot.rootFolderId) return { kind: 'ignore', reason: 'root' };
  if (!ours(file, snapshot)) return { kind: 'ignore', reason: 'not-ours' };
  const folderId = file.appProperties[DRIVE_PROP_FOLDER_ID];
  if (folderId) {
    if (snapshot.rows.has(rowKey('folder', folderId)))
      return { kind: 'ignore', reason: 'duplicate' };
    const folder = snapshot.folders.get(folderId);
    if (folder) {
      // Adopted as Drive has it; outbound then brings Drive in line with liveworkspace.
      const localName = stripDriveName(file.name, LOCAL_NAME_MAX) ?? folder.name;
      return { kind: 'adopt', row: blankRow('folder', folderId, null, file, localName) };
    }
    if (file.trashed) return { kind: 'ignore', reason: 'binned-folder' };
    const name = stripDriveName(file.name, LOCAL_NAME_MAX) ?? 'Folder';
    const parentId = localFolderForParent(snapshot, file.parents[0] ?? null) ?? null;
    return {
      kind: 'apply',
      effects: [{ kind: 'recreate-folder', id: folderId, name, parentId, fileId: file.id }],
      record: blankRow('folder', folderId, null, file, name),
      types: ['Restore'],
    };
  }
  const itemId = file.appProperties[DRIVE_PROP_ITEM_ID];
  if (itemId) {
    // Another file mirrors that item: this one is a copy the person opened with liveworkspace. Never applied,
    // re-tagged or adopted; Open with offers Import as a copy.
    if (snapshot.rows.has(rowKey('item', itemId)))
      return { kind: 'ignore', reason: 'foreign-copy' };
    // Only the reconnect listing adopts an item's file (planAdoption), where every claimant is seen at once.
    return { kind: 'ignore', reason: 'unrecorded-item' };
  }
  return { kind: 'ignore', reason: 'unrecorded' };
}

const driveIsLater = (change: DriveChange, localChangedAt: number) =>
  Date.parse(change.time) > localChangedAt;

function planItem(
  change: DriveChange,
  row: DriveRow,
  file: DriveFile,
  snapshot: MirrorSnapshot,
): InboundDecision {
  const state = fileState(file);
  const nameChanged = state.name !== row.name;
  const parentChanged = state.parentId !== row.parentId;
  const trashedChanged = state.trashed !== row.trashed;
  const contentChanged = state.md5 !== row.md5 || state.headRevisionId !== row.headRevisionId;
  if (!nameChanged && !parentChanged && !trashedChanged && !contentChanged) return { kind: 'echo' };

  const live = snapshot.items.get(row.id);
  const trashed = snapshot.trash.get(row.id);
  const effects: InboundEffect[] = [];
  const types: InboundType[] = [];
  const driveName = stripDriveName(file.name, LOCAL_NAME_MAX);
  // What Drive's name stands for now; outbound renames Drive back whenever liveworkspace's name differs from it.
  const record: DriveRow = { ...row, ...state, localName: driveName ?? row.localName };
  // Contents edited in Drive are never read back: the file is rewritten from liveworkspace.
  if (contentChanged && row.md5 !== null) record.mirroredUpdatedAt = 0;

  // Restoring from the bin places the item where its file sits.
  let restored = false;
  if (trashedChanged) {
    if (state.trashed && live) {
      return {
        kind: 'apply',
        effects: [{ kind: 'trash-item', id: row.id }],
        record,
        types: ['Trash'],
      };
    }
    if (!state.trashed && trashed) {
      effects.push({ kind: 'restore-item', id: row.id });
      types.push('Restore');
      restored = true;
    }
  }
  const current: MirrorItem | null =
    live ?? (restored ? { ...trashed!, folderId: null, updatedAt: 0, createdAt: 0 } : null);
  if (!current || state.trashed) return { kind: 'apply', effects, record, types };

  if (nameChanged && driveName !== null && driveName !== current.name) {
    const localChanged = current.name !== row.localName;
    if (!localChanged || driveIsLater(change, current.updatedAt)) {
      effects.push({ kind: 'rename-item', id: row.id, name: driveName });
      types.push('Rename');
    }
  }
  if (parentChanged || restored) {
    const localChanged = !restored && expectedItemParent(snapshot, current, row) !== row.parentId;
    if (!localChanged || driveIsLater(change, current.updatedAt)) {
      const target = localFolderForParent(snapshot, state.parentId);
      if (target === undefined) {
        effects.push({ kind: 'move-item', id: row.id, folderId: null });
        types.push('UnknownFolder');
        record.notice = 'unseen_folder';
        record.noticeParentId = state.parentId;
      } else {
        if (restored || target !== current.folderId) {
          effects.push({ kind: 'move-item', id: row.id, folderId: target });
          if (!restored) types.push('Move');
        }
        record.notice = null;
        record.noticeParentId = null;
      }
    }
  }
  return { kind: 'apply', effects, record, types };
}

function planFolder(
  change: DriveChange,
  row: DriveRow,
  file: DriveFile,
  snapshot: MirrorSnapshot,
): InboundDecision {
  const state = fileState(file);
  const nameChanged = state.name !== row.name;
  const parentChanged = state.parentId !== row.parentId;
  const trashedChanged = state.trashed !== row.trashed;
  if (!nameChanged && !parentChanged && !trashedChanged) return { kind: 'echo' };
  const folder = snapshot.folders.get(row.id);
  const driveName = stripDriveName(file.name, LOCAL_NAME_MAX);
  const record: DriveRow = {
    ...row,
    ...state,
    md5: null,
    headRevisionId: null,
    localName: driveName ?? row.localName,
  };
  if (!folder) return { kind: 'apply', effects: [], record, types: [] };

  if (trashedChanged && state.trashed) {
    return {
      kind: 'apply',
      effects: [{ kind: 'bin-folder', id: row.id }],
      record,
      types: ['Trash'],
    };
  }
  const effects: InboundEffect[] = [];
  const types: InboundType[] = [];
  if (nameChanged && driveName !== null && driveName !== folder.name) {
    const localChanged = folder.name !== row.localName;
    if (!localChanged || driveIsLater(change, folder.updatedAt)) {
      effects.push({ kind: 'rename-folder', id: row.id, name: driveName });
      types.push('Rename');
    }
  }
  if (parentChanged) {
    const localChanged = expectedFolderParent(snapshot, folder, row) !== row.parentId;
    if (!localChanged || driveIsLater(change, folder.updatedAt)) {
      const target = localFolderForParent(snapshot, state.parentId);
      if (target === undefined) {
        if (folder.parentId !== null)
          effects.push({ kind: 'move-folder', id: row.id, parentId: null });
        types.push('UnknownFolder');
        record.notice = 'unseen_folder';
        record.noticeParentId = state.parentId;
      } else {
        if (target !== folder.parentId && target !== row.id) {
          effects.push({ kind: 'move-folder', id: row.id, parentId: target });
          types.push('Move');
        }
        record.notice = null;
        record.noticeParentId = null;
      }
    }
  }
  return { kind: 'apply', effects, record, types };
}

export function planInbound(change: DriveChange, snapshot: MirrorSnapshot): InboundDecision {
  const row = snapshot.rowsByFile.get(change.fileId);
  if (!row) return planUnrecorded(change, snapshot);
  // A folder liveworkspace deleted: its Drive folder is binned this pass, whatever Drive last said.
  if (row.kind === 'folder' && folderDeletedHere(snapshot, row.id))
    return { kind: 'ignore', reason: 'deleted-here' };
  if (change.removed || !change.file) {
    if (row.kind === 'item' && snapshot.trash.has(row.id)) {
      return {
        kind: 'apply',
        effects: [{ kind: 'purge-item', id: row.id }],
        record: row,
        types: ['Purge'],
      };
    }
    // Deleted for good while the item is live, or access lost: never a reason to delete a live item. Forget the
    // file; outbound re-creates it. Also Drive emptying its bin of an item purged here.
    return { kind: 'forget', row, reason: 'removed' };
  }
  return row.kind === 'item'
    ? planItem(change, row, change.file, snapshot)
    : planFolder(change, row, change.file, snapshot);
}

/** One entry per file, the latest (every entry carries the file's current state, so only the last one's time says
 *  when that state came about); then folders first, files after, each by time, so a restored folder exists before
 *  the items restored with it are placed. */
export function orderChanges(changes: DriveChange[], snapshot: MirrorSnapshot): DriveChange[] {
  const latest = new Map<string, DriveChange>();
  for (const c of changes) {
    const seen = latest.get(c.fileId);
    if (!seen || Date.parse(c.time) >= Date.parse(seen.time)) latest.set(c.fileId, c);
  }
  const isFolder = (c: DriveChange) =>
    snapshot.rowsByFile.get(c.fileId)?.kind === 'folder' || c.file?.mimeType === DRIVE_FOLDER_MIME;
  return [...latest.values()].sort(
    (a, b) => Number(isFolder(b)) - Number(isFolder(a)) || Date.parse(a.time) - Date.parse(b.time),
  );
}

/** After a (re)connect, the files the service made earlier, all at once: the rows to record instead of making
 *  second files. An item claimed by more than one file (its file and a copy opened with liveworkspace) is left to
 *  neither, so a copy is never taken for the original; the next write makes a fresh file for it. */
export function planAdoption(
  files: DriveFile[],
  snapshot: MirrorSnapshot,
): { adopt: DriveRow[]; ambiguous: string[] } {
  const claims = new Map<string, DriveFile[]>();
  const adopt: DriveRow[] = [];
  for (const file of files) {
    if (!ours(file, snapshot)) continue;
    if (file.appProperties[DRIVE_PROP_FOLDER_ID]) {
      const decision = planUnrecorded(
        { fileId: file.id, removed: false, time: '', file },
        snapshot,
      );
      if (decision.kind === 'adopt') adopt.push(decision.row);
      continue;
    }
    const itemId = file.appProperties[DRIVE_PROP_ITEM_ID];
    if (!itemId || snapshot.rows.has(rowKey('item', itemId))) continue;
    claims.set(itemId, [...(claims.get(itemId) ?? []), file]);
  }
  const ambiguous: string[] = [];
  for (const [itemId, claimants] of claims) {
    const known = snapshot.items.get(itemId) ?? snapshot.trash.get(itemId);
    if (!known) continue;
    if (claimants.length > 1) {
      ambiguous.push(itemId);
      continue;
    }
    const file = claimants[0]!;
    adopt.push(
      blankRow(
        'item',
        itemId,
        known.app,
        file,
        stripDriveName(file.name, LOCAL_NAME_MAX) ?? known.name,
      ),
    );
  }
  return { adopt, ambiguous };
}
