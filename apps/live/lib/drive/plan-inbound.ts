// Inbound: what one Drive change means for livediagram
// (docs/specs/022-drive-mirror/drive-mirror.md, "Inbound"; blueprint "Inbound").
// Pure: the engine applies the decision through the ordinary api routes.
//
// The item row is the last Drive state livediagram knows. A change is an
// echo of livediagram's own write when nothing it carries differs from the
// row; otherwise each differing attribute is a foreign change. Whatever is
// applied, the row is always re-recorded with Drive's state, so a change
// livediagram did not take (a lost conflict) is undone by the next outbound
// pass rather than lingering.

import {
  DRIVE_PROP_DOCUMENT_ID,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ORIGIN,
  stripDriveName,
  type DriveItem,
} from '@livediagram/api-schema';
import type { DriveChange, DriveFile } from './drive-client';
import {
  expectedDocumentParent,
  expectedFolderParent,
  fileState,
  itemKey,
  ldFolderForParent,
  type MirrorSnapshot,
} from './snapshot';

// livediagram's name ceiling (apps/api MAX_NAME_LEN).
export const LD_NAME_MAX = 200;

// Telemetry types (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").
export type InboundType = 'Rename' | 'Move' | 'Trash' | 'Restore' | 'Purge' | 'UnknownFolder';

export type InboundEffect =
  | { kind: 'rename-document'; id: string; name: string }
  | { kind: 'move-document'; id: string; folderId: string | null }
  | { kind: 'trash-document'; id: string }
  | { kind: 'restore-document'; id: string }
  | { kind: 'purge-document'; id: string }
  | { kind: 'rename-folder'; id: string; name: string }
  | { kind: 'move-folder'; id: string; parentId: string | null }
  | { kind: 'bin-folder'; id: string }
  | { kind: 'recreate-folder'; id: string; name: string; parentId: string | null; fileId: string };

export type InboundDecision =
  | { kind: 'ignore'; reason: string; hadAppProperties?: boolean }
  | { kind: 'echo' }
  | { kind: 'forget'; item: DriveItem; reason: string }
  | { kind: 'adopt'; item: DriveItem }
  | { kind: 'apply'; effects: InboundEffect[]; record: DriveItem; types: InboundType[] };

function blankItem(
  kind: DriveItem['kind'],
  ldId: string,
  file: DriveFile,
  ldName: string,
): DriveItem {
  return {
    kind,
    ldId,
    driveFileId: file.id,
    ...fileState(file),
    ldName,
    mirroredSavedAt: null,
    notice: null,
    noticeParentId: null,
  };
}

// A file livediagram made but holds no row for: a folder deleted here and
// restored in Drive, or a document's file seen before its row exists.
function planUnrecorded(change: DriveChange, snapshot: MirrorSnapshot): InboundDecision {
  const file = change.file;
  if (!file || change.removed) return { kind: 'ignore', reason: 'unknown-removed' };
  // The root is tracked by id, never an item; the engine reads its name.
  if (change.fileId === snapshot.rootFolderId) return { kind: 'ignore', reason: 'root' };
  if (file.appProperties[DRIVE_PROP_ORIGIN] !== snapshot.host) {
    return {
      kind: 'ignore',
      reason: 'not-ours',
      hadAppProperties: Object.keys(file.appProperties).length > 0,
    };
  }
  const folderId = file.appProperties[DRIVE_PROP_FOLDER_ID];
  if (folderId) {
    if (snapshot.items.has(itemKey('folder', folderId)))
      return { kind: 'ignore', reason: 'duplicate' };
    const folder = snapshot.folders.get(folderId);
    if (folder) {
      // Adopted as Drive has it; outbound then brings Drive in line with livediagram.
      const ldName = stripDriveName(file.name, LD_NAME_MAX) ?? folder.name;
      return { kind: 'adopt', item: blankItem('folder', folderId, file, ldName) };
    }
    if (file.trashed) return { kind: 'ignore', reason: 'binned-folder' };
    // Deleted here before this browser read back the create: its tombstone bins it this pass.
    if (snapshot.deletedFolders.has(folderId)) return { kind: 'ignore', reason: 'deleted-here' };
    const name = stripDriveName(file.name, LD_NAME_MAX) ?? 'Folder';
    const parentId = ldFolderForParent(snapshot, file.parents[0] ?? null) ?? null;
    return {
      kind: 'apply',
      effects: [{ kind: 'recreate-folder', id: folderId, name, parentId, fileId: file.id }],
      record: blankItem('folder', folderId, file, name),
      types: ['Restore'],
    };
  }
  const documentId = file.appProperties[DRIVE_PROP_DOCUMENT_ID];
  if (documentId) {
    // Another file mirrors that document: this one is a copy the user opened
    // with livediagram (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive").
    // Never applied, re-tagged or adopted; Open with offers Import as new document.
    if (snapshot.items.has(itemKey('document', documentId)))
      return { kind: 'ignore', reason: 'foreign-copy' };
    // Only the reconnect listing adopts a document's file (planAdoption), where
    // every file claiming the document is seen at once.
    return { kind: 'ignore', reason: 'unrecorded-document' };
  }
  return { kind: 'ignore', reason: 'unrecorded' };
}

function driveIsLater(change: DriveChange, ldChangedAt: number): boolean {
  return Date.parse(change.time) > ldChangedAt;
}

function planDocument(
  change: DriveChange,
  item: DriveItem,
  file: DriveFile,
  snapshot: MirrorSnapshot,
): InboundDecision {
  const state = fileState(file);
  const nameChanged = state.name !== item.name;
  const parentChanged = state.parentId !== item.parentId;
  const trashedChanged = state.trashed !== item.trashed;
  const contentChanged = state.md5 !== item.md5 || state.headRevisionId !== item.headRevisionId;
  if (!nameChanged && !parentChanged && !trashedChanged && !contentChanged) return { kind: 'echo' };

  const live = snapshot.documents.get(item.ldId);
  const trashed = snapshot.trash.get(item.ldId);
  const effects: InboundEffect[] = [];
  const types: InboundType[] = [];
  const driveName = stripDriveName(file.name, LD_NAME_MAX);
  const record: DriveItem = {
    ...item,
    ...state,
    // What Drive's name stands for now; outbound renames Drive back whenever
    // livediagram's name differs from it.
    ldName: driveName ?? item.ldName,
  };
  if (contentChanged && item.md5 !== null) record.mirroredSavedAt = 0;

  // Restoring from the bin places the document where its file sits.
  let restored = false;
  if (trashedChanged) {
    if (state.trashed && live) {
      effects.push({ kind: 'trash-document', id: item.ldId });
      types.push('Trash');
      return { kind: 'apply', effects, record, types };
    }
    if (!state.trashed && trashed) {
      effects.push({ kind: 'restore-document', id: item.ldId });
      types.push('Restore');
      restored = true;
    }
  }
  const current =
    live ?? (restored ? { ...trashed!, folderId: null, savedAt: 0, createdAt: 0 } : null);
  if (!current || state.trashed) return { kind: 'apply', effects, record, types };

  if (nameChanged && driveName !== null && driveName !== current.name) {
    const ldChanged = current.name !== item.ldName;
    if (!ldChanged || driveIsLater(change, current.savedAt)) {
      effects.push({ kind: 'rename-document', id: item.ldId, name: driveName });
      types.push('Rename');
    }
  }
  if (parentChanged || restored) {
    const ldChanged =
      !restored && expectedDocumentParent(snapshot, current, item) !== item.parentId;
    if (!ldChanged || driveIsLater(change, current.savedAt)) {
      const target = ldFolderForParent(snapshot, state.parentId);
      if (target === undefined) {
        effects.push({ kind: 'move-document', id: item.ldId, folderId: null });
        types.push('UnknownFolder');
        record.notice = 'unseen_folder';
        record.noticeParentId = state.parentId;
      } else {
        if (restored || target !== current.folderId) {
          effects.push({ kind: 'move-document', id: item.ldId, folderId: target });
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
  item: DriveItem,
  file: DriveFile,
  snapshot: MirrorSnapshot,
): InboundDecision {
  const state = fileState(file);
  const nameChanged = state.name !== item.name;
  const parentChanged = state.parentId !== item.parentId;
  const trashedChanged = state.trashed !== item.trashed;
  if (!nameChanged && !parentChanged && !trashedChanged) return { kind: 'echo' };
  const folder = snapshot.folders.get(item.ldId);
  const driveName = stripDriveName(file.name, LD_NAME_MAX);
  const record: DriveItem = {
    ...item,
    ...state,
    md5: null,
    headRevisionId: null,
    ldName: driveName ?? item.ldName,
  };
  if (!folder) return { kind: 'apply', effects: [], record, types: [] };

  if (trashedChanged && state.trashed) {
    return {
      kind: 'apply',
      effects: [{ kind: 'bin-folder', id: item.ldId }],
      record,
      types: ['Trash'],
    };
  }
  const effects: InboundEffect[] = [];
  const types: InboundType[] = [];
  if (nameChanged && driveName !== null && driveName !== folder.name) {
    const ldChanged = folder.name !== item.ldName;
    if (!ldChanged || driveIsLater(change, folder.updatedAt)) {
      effects.push({ kind: 'rename-folder', id: item.ldId, name: driveName });
      types.push('Rename');
    }
  }
  if (parentChanged) {
    const ldChanged = expectedFolderParent(snapshot, folder, item) !== item.parentId;
    if (!ldChanged || driveIsLater(change, folder.updatedAt)) {
      const target = ldFolderForParent(snapshot, state.parentId);
      if (target === undefined) {
        if (folder.parentId !== null)
          effects.push({ kind: 'move-folder', id: item.ldId, parentId: null });
        types.push('UnknownFolder');
        record.notice = 'unseen_folder';
        record.noticeParentId = state.parentId;
      } else {
        if (target !== folder.parentId && target !== item.ldId) {
          effects.push({ kind: 'move-folder', id: item.ldId, parentId: target });
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
  const item = snapshot.itemsByFile.get(change.fileId);
  if (!item) return planUnrecorded(change, snapshot);
  if (change.removed || !change.file) {
    if (item.kind === 'document' && snapshot.trash.has(item.ldId)) {
      return {
        kind: 'apply',
        effects: [{ kind: 'purge-document', id: item.ldId }],
        record: item,
        types: ['Purge'],
      };
    }
    // Deleted for good while the document is live, or access lost: never a
    // reason to delete a live document. Forget the file; outbound re-creates.
    return { kind: 'forget', item, reason: 'removed' };
  }
  return item.kind === 'document'
    ? planDocument(change, item, change.file, snapshot)
    : planFolder(change, item, change.file, snapshot);
}

// One entry per file, the latest: every entry carries the file's CURRENT
// state, so only the last one's time says when that state came about.
// Then folders first, files after, each by time, so a restored folder exists
// before the documents restored with it are placed.
export function orderChanges(changes: DriveChange[], snapshot: MirrorSnapshot): DriveChange[] {
  const latest = new Map<string, DriveChange>();
  for (const c of changes) {
    const seen = latest.get(c.fileId);
    if (!seen || Date.parse(c.time) >= Date.parse(seen.time)) latest.set(c.fileId, c);
  }
  const isFolder = (c: DriveChange) =>
    snapshot.itemsByFile.get(c.fileId)?.kind === 'folder' ||
    c.file?.mimeType === 'application/vnd.google-apps.folder';
  return [...latest.values()].sort(
    (a, b) => Number(isFolder(b)) - Number(isFolder(a)) || Date.parse(a.time) - Date.parse(b.time),
  );
}

// After a (re)connect, the files livediagram made earlier, all at once: the
// rows to record instead of making second files. A document claimed by more than
// one file (its file and a copy the user opened with livediagram) is left to
// neither, so a copy is never taken for the original; the next write makes a
// fresh file for it.
export function planAdoption(
  files: DriveFile[],
  snapshot: MirrorSnapshot,
): { adopt: DriveItem[]; ambiguous: string[] } {
  const claims = new Map<string, DriveFile[]>();
  const adopt: DriveItem[] = [];
  for (const file of files) {
    if (file.appProperties[DRIVE_PROP_ORIGIN] !== snapshot.host) continue;
    if (file.appProperties[DRIVE_PROP_FOLDER_ID]) {
      const decision = planUnrecorded(
        { fileId: file.id, removed: false, time: '', file },
        snapshot,
      );
      if (decision.kind === 'adopt') adopt.push(decision.item);
      continue;
    }
    const documentId = file.appProperties[DRIVE_PROP_DOCUMENT_ID];
    if (!documentId || snapshot.items.has(itemKey('document', documentId))) continue;
    claims.set(documentId, [...(claims.get(documentId) ?? []), file]);
  }
  const ambiguous: string[] = [];
  for (const [documentId, claimants] of claims) {
    const known = snapshot.documents.get(documentId) ?? snapshot.trash.get(documentId);
    if (!known) continue;
    if (claimants.length > 1) {
      ambiguous.push(documentId);
      continue;
    }
    const file = claimants[0]!;
    adopt.push(
      blankItem('document', documentId, file, stripDriveName(file.name, LD_NAME_MAX) ?? known.name),
    );
  }
  return { adopt, ambiguous };
}
