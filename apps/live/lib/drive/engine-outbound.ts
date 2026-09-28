// Running outbound ops against Drive (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Outbound"). Each write records the Drive state Google returns, so the
// change it causes is read back as an echo. A rate limit stops the run; any
// other failure of one op is logged and the rest carry on.

import {
  DRIVE_FILE_MIME,
  DRIVE_PROP_DIAGRAM_ID,
  DRIVE_PROP_ORIGIN,
  driveFileName,
  type DriveItem,
} from '@livediagram/api-schema';
import { DriveApiError, type DriveFile } from './drive-client';
import { folderAppProperties } from './engine-inbound';
import { driveLog, driveWarn } from './log';
import type { PassContext } from './pass-context';
import type { OutboundOp } from './plan-outbound';
import {
  dropSnapshotItem,
  expectedDiagramParent,
  expectedFolderParent,
  fileState,
  itemKey,
} from './snapshot';
import type { MirrorDiagram } from './livediagram-port';

export type OutboundHooks = {
  onContentWritten(diagramId: string): void;
  onCreated(): void;
};

// A failure that ends the whole run rather than one op.
export function isRunFatal(err: unknown): boolean {
  if (err instanceof DriveApiError) return err.isRateLimit || err.isAuth;
  return err instanceof TypeError; // fetch's network failure
}

function recordFromFile(
  base: Pick<DriveItem, 'kind' | 'ldId'> & Partial<DriveItem>,
  file: DriveFile,
  ldName: string,
): DriveItem {
  return {
    mirroredSavedAt: null,
    notice: null,
    noticeParentId: null,
    ...base,
    driveFileId: file.id,
    ...fileState(file),
    ldName,
  } as DriveItem;
}

async function contentFor(ctx: PassContext, diagram: MirrorDiagram) {
  const envelope = await ctx.port.loadEnvelope(diagram.id);
  if (!envelope) return null;
  let thumbnailPng: string | null = null;
  try {
    const svg = await ctx.port.loadSnapshotSvg(diagram.id);
    thumbnailPng = svg ? await ctx.rasterise(svg) : null;
  } catch (err) {
    driveWarn('thumbnail-failed', { id: diagram.id, error: String(err) });
  }
  return { text: envelope.text, savedAt: envelope.savedAt, thumbnailPng };
}

async function createDiagramFile(
  ctx: PassContext,
  diagram: MirrorDiagram,
  hooks: OutboundHooks,
  previous?: DriveItem,
): Promise<void> {
  const parentId = expectedDiagramParent(ctx.snapshot, diagram, previous);
  if (parentId === null) {
    driveLog('deferred', { id: diagram.id, reason: 'parent-not-mirrored' });
    return;
  }
  const content = await contentFor(ctx, diagram);
  if (!content) return;
  const file = await ctx.drive.createFile({
    name: driveFileName(diagram.name),
    parentId,
    mimeType: DRIVE_FILE_MIME,
    content: content.text,
    thumbnailPng: content.thumbnailPng,
    appProperties: { [DRIVE_PROP_DIAGRAM_ID]: diagram.id, [DRIVE_PROP_ORIGIN]: ctx.snapshot.host },
  });
  driveLog('outbound', {
    op: previous ? 'recreate-file' : 'create-file',
    id: diagram.id,
    fileId: file.id,
  });
  await ctx.record(
    recordFromFile(
      {
        kind: 'diagram',
        ldId: diagram.id,
        mirroredSavedAt: content.savedAt,
        notice: previous?.notice ?? null,
        noticeParentId: previous?.noticeParentId ?? null,
      },
      file,
      diagram.name,
    ),
  );
  hooks.onContentWritten(diagram.id);
  hooks.onCreated();
}

async function runOp(ctx: PassContext, op: OutboundOp, hooks: OutboundHooks): Promise<void> {
  const snap = ctx.snapshot;
  switch (op.op) {
    case 'create-folder': {
      const parentId = expectedFolderParent(snap, op.folder, undefined);
      if (parentId === null) return;
      const file = await ctx.drive.createFolder({
        name: op.folder.name,
        parentId,
        appProperties: folderAppProperties(snap.host, op.folder.id),
      });
      driveLog('outbound', { op: 'create-folder', id: op.folder.id, fileId: file.id });
      await ctx.record(
        recordFromFile({ kind: 'folder', ldId: op.folder.id }, file, op.folder.name),
      );
      return;
    }
    case 'update-folder': {
      const item = snap.items.get(itemKey('folder', op.folder.id)) ?? op.item;
      const parentId = expectedFolderParent(snap, op.folder, item);
      const move = op.move && parentId !== null && parentId !== item.parentId;
      const file = await ctx.drive.updateFile(item.driveFileId, {
        ...(op.rename ? { name: op.folder.name } : {}),
        ...(move
          ? { addParent: parentId!, ...(item.parentId ? { removeParent: item.parentId } : {}) }
          : {}),
        ...(op.untrash ? { trashed: false } : {}),
      });
      driveLog('outbound', { op: 'update-folder', id: op.folder.id });
      await ctx.record(
        recordFromFile(
          { ...item, ...(move ? { notice: null, noticeParentId: null } : {}) },
          file,
          op.folder.name,
        ),
      );
      return;
    }
    case 'create-file':
      await createDiagramFile(ctx, op.diagram, hooks);
      return;
    case 'update-file': {
      const item = snap.items.get(itemKey('diagram', op.diagram.id)) ?? op.item;
      const parentId = expectedDiagramParent(snap, op.diagram, item);
      const move = op.move && parentId !== null && parentId !== item.parentId;
      const content = op.content ? await contentFor(ctx, op.diagram) : null;
      try {
        const file = await ctx.drive.updateFile(item.driveFileId, {
          ...(op.rename ? { name: driveFileName(op.diagram.name) } : {}),
          ...(move
            ? { addParent: parentId!, ...(item.parentId ? { removeParent: item.parentId } : {}) }
            : {}),
          ...(op.untrash ? { trashed: false } : {}),
          ...(content ? { content: content.text, thumbnailPng: content.thumbnailPng } : {}),
        });
        driveLog('outbound', {
          op: 'update-file',
          id: op.diagram.id,
          rename: op.rename,
          move,
          content: !!content,
        });
        await ctx.record(
          recordFromFile(
            {
              ...item,
              ...(content ? { mirroredSavedAt: content.savedAt } : {}),
              ...(move ? { notice: null, noticeParentId: null } : {}),
            },
            file,
            op.diagram.name,
          ),
        );
        if (content) hooks.onContentWritten(op.diagram.id);
      } catch (err) {
        // Deleted outside livediagram's knowledge: re-create it where it belongs.
        if (err instanceof DriveApiError && err.isNotFound) {
          driveLog('recreated', { id: op.diagram.id, fileId: item.driveFileId });
          await createDiagramFile(ctx, op.diagram, hooks, item);
          return;
        }
        throw err;
      }
      return;
    }
    case 'trash-file': {
      try {
        const file = await ctx.drive.updateFile(op.item.driveFileId, { trashed: true });
        driveLog('outbound', { op: 'trash-file', ldId: op.item.ldId });
        await ctx.record({ ...op.item, ...fileState(file) });
      } catch (err) {
        if (err instanceof DriveApiError && err.isNotFound) {
          await ctx.port.deleteItem('diagram', op.item.ldId);
          dropSnapshotItem(snap, 'diagram', op.item.ldId);
          ctx.discard('diagram', op.item.ldId);
          return;
        }
        throw err;
      }
      return;
    }
    case 'finish-tombstone': {
      let file: DriveFile;
      try {
        file = await ctx.drive.getFile(op.row.driveFileId);
      } catch (err) {
        if (err instanceof DriveApiError && err.isNotFound) return;
        throw err;
      }
      if (op.row.kind === 'diagram' && file.trashed) {
        await ctx.drive.deleteFile(file.id);
        driveLog('tombstone', { op: 'delete', ldId: op.row.ldId });
      } else if (!file.trashed) {
        await ctx.drive.updateFile(file.id, { trashed: true });
        driveLog('tombstone', { op: 'bin', kind: op.row.kind, ldId: op.row.ldId });
      }
      return;
    }
  }
}

// Run the ops in order. Throws the first run-fatal error (after saving the
// rows already recorded); logs and skips any other failed op.
export async function runOutbound(
  ctx: PassContext,
  ops: OutboundOp[],
  hooks: OutboundHooks,
): Promise<void> {
  try {
    for (const op of ops) {
      try {
        await runOp(ctx, op, hooks);
      } catch (err) {
        if (isRunFatal(err)) throw err;
        driveWarn('outbound-failed', {
          op: op.op,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    await ctx.flushItems();
  }
}
