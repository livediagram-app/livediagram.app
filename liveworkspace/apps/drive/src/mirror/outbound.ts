// Outbound: running the planner's ops against Drive (liveworkspace/docs/drive.md "Outbound"), ported from
// livediagram's engine-outbound. Each write records the Drive state Google returns, so the change it causes reads
// back as an echo. A pass writes at most `budget` files and hands the rest to the next alarm. A rate limit, a lapsed
// grant or a network failure stops the run; any other failure of one op is logged, the item marked failed, and the
// rest carry on.

import {
  APP_FILE_FORMATS,
  DRIVE_PROP_APP,
  DRIVE_PROP_ITEM_ID,
  DRIVE_PROP_ORIGIN,
  driveFileName,
  expectedFolderParent,
  expectedItemParent,
  fileState,
  rowKey,
  type DriveRow,
  type MirrorItem,
  type OutboundOp,
} from '@liveworkspace/drive';
import { DriveApiError, type DriveFile } from '@liveworkspace/drive/server';
import { driveLog, driveWarn, errorKind } from '../log';
import { PassAborted } from './context';
import type { PassState } from './pass-state';
import { NeedsReconnect } from './tokens';

/** A failure that ends the whole run rather than one op. */
export function isRunFatal(err: unknown): boolean {
  if (err instanceof PassAborted || err instanceof NeedsReconnect) return true;
  if (err instanceof DriveApiError) return err.isRateLimit || err.isAuth;
  // fetch's network failure, or a call that timed out.
  return err instanceof TypeError || (err instanceof Error && err.name === 'TimeoutError');
}

function rowFromFile(
  base: Pick<DriveRow, 'kind' | 'id' | 'app'> & Partial<DriveRow>,
  file: DriveFile,
  localName: string,
): DriveRow {
  return {
    mirroredUpdatedAt: null,
    contentWrittenAt: null,
    notice: null,
    noticeParentId: null,
    ...base,
    driveFileId: file.id,
    ...fileState(file),
    localName,
  };
}

// The file's contents and thumbnail, or null when the app no longer has the item. `updatedAt` is the later of the
// content's version and the index's (a rename moves the index's without a save), so the next pass sees it mirrored.
async function contentFor(state: PassState, item: MirrorItem) {
  const { doors, rasterise } = state.rt.deps;
  const exported = await doors.exportFile(item.app, item.id);
  if (!exported) {
    driveLog('export-missing', { id: item.id, app: item.app });
    return null;
  }
  let thumbnailPng: string | null = null;
  try {
    const svg = await doors.exportSvg(item.app, item.id);
    thumbnailPng = svg ? await rasterise(svg) : null;
  } catch (err) {
    driveWarn('thumbnail-failed', { id: item.id, error: errorKind(err) });
  }
  return {
    text: exported.body,
    updatedAt: Math.max(exported.version, item.updatedAt),
    thumbnailPng,
  };
}

async function createItemFile(
  state: PassState,
  item: MirrorItem,
  previous?: DriveRow,
): Promise<boolean> {
  const parentId = expectedItemParent(state.snapshot, item, previous);
  if (parentId === null) {
    driveLog('deferred', { id: item.id, reason: 'parent-not-mirrored' });
    return false;
  }
  const content = await contentFor(state, item);
  if (!content) return false;
  const { deps } = state.rt;
  const file = await state.rt.drive.createFile({
    name: driveFileName(item.app, item.name),
    parentId,
    mimeType: APP_FILE_FORMATS[item.app].mimeType,
    content: content.text,
    thumbnailPng: content.thumbnailPng,
    appProperties: {
      [DRIVE_PROP_ITEM_ID]: item.id,
      [DRIVE_PROP_APP]: item.app,
      [DRIVE_PROP_ORIGIN]: deps.origin,
    },
  });
  driveLog('outbound', {
    op: previous ? 'recreate-file' : 'create-file',
    id: item.id,
    fileId: file.id,
  });
  state.record(
    rowFromFile(
      {
        kind: 'item',
        id: item.id,
        app: item.app,
        mirroredUpdatedAt: content.updatedAt,
        contentWrittenAt: deps.now(),
        notice: previous?.notice ?? null,
        noticeParentId: previous?.noticeParentId ?? null,
      },
      file,
      item.name,
    ),
  );
  return true;
}

// Whether the op wrote to Drive (what the budget counts).
async function runOp(state: PassState, op: OutboundOp): Promise<boolean> {
  const snap = state.snapshot;
  const { drive } = state.rt;
  switch (op.op) {
    case 'create-folder': {
      const parentId = expectedFolderParent(snap, op.folder, undefined);
      if (parentId === null) return false;
      const file = await drive.createFolder({
        name: op.folder.name,
        parentId,
        appProperties: state.folderProperties(op.folder.id),
      });
      driveLog('outbound', { op: 'create-folder', id: op.folder.id, fileId: file.id });
      state.record(
        rowFromFile({ kind: 'folder', id: op.folder.id, app: null }, file, op.folder.name),
      );
      return true;
    }
    case 'update-folder': {
      const row = snap.rows.get(rowKey('folder', op.folder.id)) ?? op.row;
      const parentId = expectedFolderParent(snap, op.folder, row);
      const move = op.move && parentId !== null && parentId !== row.parentId;
      const file = await drive.updateFile(row.driveFileId, {
        ...(op.rename ? { name: op.folder.name } : {}),
        ...(move
          ? { addParent: parentId, ...(row.parentId ? { removeParent: row.parentId } : {}) }
          : {}),
        ...(op.untrash ? { trashed: false } : {}),
      });
      driveLog('outbound', { op: 'update-folder', id: op.folder.id });
      state.record(
        rowFromFile(
          { ...row, ...(move ? { notice: null, noticeParentId: null } : {}) },
          file,
          op.folder.name,
        ),
      );
      return true;
    }
    case 'create-file':
      return createItemFile(state, op.item);
    case 'update-file': {
      const row = snap.rows.get(rowKey('item', op.item.id)) ?? op.row;
      const parentId = expectedItemParent(snap, op.item, row);
      const move = op.move && parentId !== null && parentId !== row.parentId;
      const content = op.content ? await contentFor(state, op.item) : null;
      if (!op.rename && !move && !op.untrash && !content) return false;
      try {
        const file = await drive.updateFile(row.driveFileId, {
          ...(op.rename ? { name: driveFileName(op.item.app, op.item.name) } : {}),
          ...(move
            ? { addParent: parentId, ...(row.parentId ? { removeParent: row.parentId } : {}) }
            : {}),
          ...(op.untrash ? { trashed: false } : {}),
          ...(content
            ? {
                content: content.text,
                thumbnailPng: content.thumbnailPng,
                mimeType: APP_FILE_FORMATS[op.item.app].mimeType,
              }
            : {}),
        });
        driveLog('outbound', {
          op: 'update-file',
          id: op.item.id,
          rename: op.rename,
          move,
          content: !!content,
        });
        state.record(
          rowFromFile(
            {
              ...row,
              ...(content
                ? { mirroredUpdatedAt: content.updatedAt, contentWrittenAt: state.rt.deps.now() }
                : {}),
              ...(move ? { notice: null, noticeParentId: null } : {}),
            },
            file,
            op.item.name,
          ),
        );
      } catch (err) {
        // Deleted outside liveworkspace's knowledge: re-created where it belongs.
        if (err instanceof DriveApiError && err.isNotFound) {
          driveLog('recreated', { id: op.item.id, fileId: row.driveFileId });
          return createItemFile(state, op.item, row);
        }
        throw err;
      }
      return true;
    }
    case 'trash-file': {
      try {
        const file = await drive.updateFile(op.row.driveFileId, { trashed: true });
        driveLog('outbound', { op: 'trash-file', id: op.row.id });
        state.record({ ...op.row, ...fileState(file) });
      } catch (err) {
        if (!(err instanceof DriveApiError && err.isNotFound)) throw err;
        state.drop('item', op.row.id);
      }
      return true;
    }
    case 'bin-folder': {
      try {
        await drive.updateFile(op.row.driveFileId, { trashed: true });
        driveLog('outbound', { op: 'bin-folder', id: op.row.id });
      } catch (err) {
        if (!(err instanceof DriveApiError && err.isNotFound)) throw err;
      }
      state.drop('folder', op.row.id);
      return true;
    }
  }
}

const itemOf = (op: OutboundOp): string | null =>
  op.op === 'create-file' || op.op === 'update-file' ? op.item.id : null;

export type OutboundRun = { written: number; more: boolean };

/** Run the ops in order, at most `budget` of them writing. */
export async function runOutbound(
  state: PassState,
  ops: OutboundOp[],
  budget: number,
): Promise<OutboundRun> {
  const { store, now } = state.rt.deps;
  const failures = store.failures();
  let written = 0;
  for (const op of ops) {
    if (written >= budget) return { written, more: true };
    state.rt.guard();
    const itemId = itemOf(op);
    try {
      if (await runOp(state, op)) written += 1;
      if (itemId && failures.has(itemId)) store.setFailed(itemId, false, now());
    } catch (err) {
      if (isRunFatal(err)) throw err;
      written += 1;
      driveWarn('outbound-failed', {
        op: op.op,
        ...(itemId ? { id: itemId } : {}),
        error: errorKind(err),
      });
      if (itemId) store.setFailed(itemId, true, now());
    }
  }
  return { written, more: false };
}
