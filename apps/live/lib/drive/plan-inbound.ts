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
  DRIVE_PROP_DIAGRAM_ID,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ORIGIN,
  stripDriveName,
  type DriveItem,
} from '@livediagram/api-schema';
import type { DriveChange, DriveFile } from './drive-client';
import {
  expectedDiagramParent,
  expectedFolderParent,
  fileState,
  itemKey,
  ldFolderForParent,
  type MirrorSnapshot,
} from './snapshot';

// livediagram's name ceiling (apps/api MAX_NAME_LEN).
export const LD_NAME_MAX = 200;

// Telemetry types (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").
export type InboundType =
  'Copy' | 'Rename' | 'Move' | 'Trash' | 'Restore' | 'Purge' | 'UnknownFolder';

export type InboundEffect =
  | { kind: 'rename-diagram'; id: string; name: string }
  | { kind: 'move-diagram'; id: string; folderId: string | null }
  | { kind: 'trash-diagram'; id: string }
  | { kind: 'restore-diagram'; id: string }
  | { kind: 'purge-diagram'; id: string }
  | { kind: 'rename-folder'; id: string; name: string }
  | { kind: 'move-folder'; id: string; parentId: string | null }
  | { kind: 'bin-folder'; id: string }
  | { kind: 'recreate-folder'; id: string; name: string; parentId: string | null; fileId: string }
  // A copy made in Drive (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive"):
  // a new diagram `newId`, duplicated from `sourceId` when that is live, else
  // imported from the copy's own contents.
  | {
      kind: 'copy-diagram';
      fileId: string;
      newId: string;
      sourceId: string | null;
      name: string;
      folderId: string | null;
    };

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
// restored in Drive, or anything met again after a reconnect.
// The id of the diagram a copy made in Drive becomes: derived from the copy's
// file id, so a pass that stops before re-tagging the copy finds the same
// diagram next time (D19); a hash, so no Drive id appears in a diagram URL.
export function driveCopyDiagramId(fileId: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(fileId)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `dc-${hash.toString(16).padStart(16, '0')}`;
}

function planCopy(file: DriveFile, diagramId: string, snapshot: MirrorSnapshot): InboundDecision {
  if (file.trashed) return { kind: 'ignore', reason: 'binned-copy' };
  const newId = driveCopyDiagramId(file.id);
  const live = snapshot.diagrams.get(diagramId);
  const original = live ?? snapshot.trash.get(diagramId);
  const name = stripDriveName(file.name, LD_NAME_MAX) ?? original?.name ?? 'Diagram';
  const parentId = file.parents[0] ?? null;
  const folderId = ldFolderForParent(snapshot, parentId);
  const record = blankItem('diagram', newId, file, name);
  if (folderId === undefined) {
    record.notice = 'unseen_folder';
    record.noticeParentId = parentId;
  }
  return {
    kind: 'apply',
    effects: [
      {
        kind: 'copy-diagram',
        fileId: file.id,
        newId,
        sourceId: live ? live.id : null,
        name,
        folderId: folderId ?? null,
      },
    ],
    record,
    types: ['Copy'],
  };
}

function planUnrecorded(change: DriveChange, snapshot: MirrorSnapshot): InboundDecision {
  const file = change.file;
  if (!file || change.removed) return { kind: 'ignore', reason: 'unknown-removed' };
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
    const name = stripDriveName(file.name, LD_NAME_MAX) ?? 'Folder';
    const parentId = ldFolderForParent(snapshot, file.parents[0] ?? null) ?? null;
    return {
      kind: 'apply',
      effects: [{ kind: 'recreate-folder', id: folderId, name, parentId, fileId: file.id }],
      record: blankItem('folder', folderId, file, name),
      types: ['Restore'],
    };
  }
  const diagramId = file.appProperties[DRIVE_PROP_DIAGRAM_ID];
  if (diagramId) {
    // Another file already mirrors that diagram: this one is a copy.
    if (snapshot.items.has(itemKey('diagram', diagramId)))
      return planCopy(file, diagramId, snapshot);
    const known = snapshot.diagrams.get(diagramId) ?? snapshot.trash.get(diagramId);
    if (known) {
      const ldName = stripDriveName(file.name, LD_NAME_MAX) ?? known.name;
      return { kind: 'adopt', item: blankItem('diagram', diagramId, file, ldName) };
    }
    // A livediagram file no diagram owns any more (a copy of a diagram since
    // purged): it becomes a diagram of its own, from its contents.
    return planCopy(file, diagramId, snapshot);
  }
  return { kind: 'ignore', reason: 'unrecorded' };
}

function driveIsLater(change: DriveChange, ldChangedAt: number): boolean {
  return Date.parse(change.time) > ldChangedAt;
}

function planDiagram(
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

  const live = snapshot.diagrams.get(item.ldId);
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

  // Restoring from the bin places the diagram where its file sits.
  let restored = false;
  if (trashedChanged) {
    if (state.trashed && live) {
      effects.push({ kind: 'trash-diagram', id: item.ldId });
      types.push('Trash');
      return { kind: 'apply', effects, record, types };
    }
    if (!state.trashed && trashed) {
      effects.push({ kind: 'restore-diagram', id: item.ldId });
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
      effects.push({ kind: 'rename-diagram', id: item.ldId, name: driveName });
      types.push('Rename');
    }
  }
  if (parentChanged || restored) {
    const ldChanged = !restored && expectedDiagramParent(snapshot, current, item) !== item.parentId;
    if (!ldChanged || driveIsLater(change, current.savedAt)) {
      const target = ldFolderForParent(snapshot, state.parentId);
      if (target === undefined) {
        effects.push({ kind: 'move-diagram', id: item.ldId, folderId: null });
        types.push('UnknownFolder');
        record.notice = 'unseen_folder';
        record.noticeParentId = state.parentId;
      } else {
        if (restored || target !== current.folderId) {
          effects.push({ kind: 'move-diagram', id: item.ldId, folderId: target });
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
    if (item.kind === 'diagram' && snapshot.trash.has(item.ldId)) {
      return {
        kind: 'apply',
        effects: [{ kind: 'purge-diagram', id: item.ldId }],
        record: item,
        types: ['Purge'],
      };
    }
    // Deleted for good while the diagram is live, or access lost: never a
    // reason to delete a live diagram. Forget the file; outbound re-creates.
    return { kind: 'forget', item, reason: 'removed' };
  }
  return item.kind === 'diagram'
    ? planDiagram(change, item, change.file, snapshot)
    : planFolder(change, item, change.file, snapshot);
}

// One entry per file, the latest: every entry carries the file's CURRENT
// state, so only the last one's time says when that state came about.
// Then folders first, files after, each by time, so a restored folder exists
// before the diagrams restored with it are placed.
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
