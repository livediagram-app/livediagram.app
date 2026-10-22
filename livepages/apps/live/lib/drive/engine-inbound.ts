// Applying inbound decisions (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Inbound"). Every effect goes through the ordinary livediagram routes via
// the port, and the snapshot follows along so later changes in the same read
// see what the earlier ones did.

import { DRIVE_PROP_FOLDER_ID, DRIVE_PROP_ORIGIN } from '@livediagram/api-schema';
import { ApiError } from '../api/core';
import type { DriveChange } from './drive-client';
import { driveLog, driveWarn } from './log';
import type { PassContext } from './pass-context';
import {
  orderChanges,
  planInbound,
  type InboundDecision,
  type InboundEffect,
} from './plan-inbound';
import { dropSnapshotItem, folderSubtree, itemKey } from './snapshot';

async function applyEffect(
  ctx: PassContext,
  effect: InboundEffect,
  change: DriveChange,
  queue: DriveChange[],
): Promise<void> {
  const snap = ctx.snapshot;
  switch (effect.kind) {
    case 'rename-document': {
      await ctx.port.renameDocument(effect.id, effect.name);
      const d = snap.documents.get(effect.id);
      if (d) snap.documents.set(effect.id, { ...d, name: effect.name, savedAt: ctx.now() });
      return;
    }
    case 'move-document': {
      await ctx.port.moveDocument(effect.id, effect.folderId);
      const d = snap.documents.get(effect.id);
      if (d) snap.documents.set(effect.id, { ...d, folderId: effect.folderId });
      return;
    }
    case 'trash-document': {
      await ctx.port.trashDocument(effect.id);
      const d = snap.documents.get(effect.id);
      snap.documents.delete(effect.id);
      if (d) snap.trash.set(effect.id, { id: d.id, name: d.name, trashedAt: ctx.now() });
      return;
    }
    case 'restore-document': {
      await ctx.port.restoreDocument(effect.id);
      const t = snap.trash.get(effect.id);
      snap.trash.delete(effect.id);
      if (t)
        snap.documents.set(effect.id, {
          id: t.id,
          name: t.name,
          folderId: null,
          savedAt: ctx.now(),
          createdAt: 0,
        });
      return;
    }
    case 'purge-document': {
      await ctx.port.purgeDocument(effect.id);
      snap.trash.delete(effect.id);
      // The purge's own batch dropped the row.
      dropSnapshotItem(snap, 'document', effect.id);
      ctx.discard('document', effect.id);
      return;
    }
    case 'rename-folder': {
      await ctx.port.renameFolder(effect.id, effect.name);
      const f = snap.folders.get(effect.id);
      if (f) snap.folders.set(effect.id, { ...f, name: effect.name, updatedAt: ctx.now() });
      return;
    }
    case 'move-folder': {
      try {
        await ctx.port.moveFolder(effect.id, effect.parentId);
      } catch (err) {
        // A move that would make a cycle is refused; outbound puts Drive back.
        if (err instanceof ApiError && err.status === 409) {
          driveWarn('inbound-cycle', { folder: effect.id });
          return;
        }
        throw err;
      }
      const f = snap.folders.get(effect.id);
      if (f) snap.folders.set(effect.id, { ...f, parentId: effect.parentId });
      return;
    }
    case 'bin-folder': {
      // Its documents go to the Trash, then the folders go, deepest first.
      const subtree = folderSubtree(snap, effect.id);
      for (const d of [...snap.documents.values()]) {
        if (d.folderId === null || !subtree.includes(d.folderId)) continue;
        await applyEffect(ctx, { kind: 'trash-document', id: d.id }, change, queue);
        // Drive binned the file with its folder; the row says so, so outbound
        // leaves it implicitly binned and restoring the folder restores it.
        const item = snap.items.get(itemKey('document', d.id));
        if (item) await ctx.record({ ...item, trashed: true });
      }
      for (const folderId of [...subtree].reverse()) {
        await ctx.port.deleteFolder(folderId);
        snap.folders.delete(folderId);
        dropSnapshotItem(snap, 'folder', folderId);
        ctx.discard('folder', folderId);
      }
      return;
    }
    case 'recreate-folder': {
      await ctx.port.createFolder(effect.id, effect.name, effect.parentId);
      snap.folders.set(effect.id, {
        id: effect.id,
        name: effect.name,
        parentId: effect.parentId,
        updatedAt: ctx.now(),
      });
      // Whatever came back with it, whether or not Drive sent a change for
      // each child (research E-A1): read its children and plan them too.
      const children = await ctx.drive.listFiles(`'${effect.fileId}' in parents`);
      for (const file of children)
        queue.push({ fileId: file.id, removed: false, time: change.time, file });
      return;
    }
  }
}

async function applyDecision(
  ctx: PassContext,
  decision: InboundDecision,
  change: DriveChange,
  queue: DriveChange[],
): Promise<boolean> {
  switch (decision.kind) {
    case 'echo':
      return false;
    case 'ignore':
      // Every ignore is logged. `not-ours` separately, saying whether the file
      // carried any appProperties: a Drive copy that lost them reads
      // `hadAppProperties: false`, one Drive never showed leaves no line at all.
      if (decision.reason === 'not-ours') {
        driveLog('inbound-not-ours', {
          fileId: change.fileId,
          hadAppProperties: decision.hadAppProperties ?? false,
        });
      } else if (decision.reason === 'foreign-copy') {
        driveLog('inbound-foreign-copy', { fileId: change.fileId });
      } else {
        driveLog('inbound-ignored', { fileId: change.fileId, reason: decision.reason });
      }
      return false;
    case 'forget':
      driveLog('inbound-forget', {
        fileId: change.fileId,
        ldId: decision.item.ldId,
        reason: decision.reason,
      });
      await ctx.port.deleteItem(decision.item.kind, decision.item.ldId);
      dropSnapshotItem(ctx.snapshot, decision.item.kind, decision.item.ldId);
      ctx.discard(decision.item.kind, decision.item.ldId);
      return true;
    case 'adopt':
      driveLog('adopted', {
        fileId: change.fileId,
        kind: decision.item.kind,
        ldId: decision.item.ldId,
      });
      await ctx.record(decision.item);
      return true;
    case 'apply': {
      for (const effect of decision.effects) {
        driveLog('inbound', { effect: effect.kind, fileId: change.fileId });
        await applyEffect(ctx, effect, change, queue);
      }
      // Recorded once the effects landed (a re-created folder is then the
      // parent its queued children resolve to). A purge or a binned folder
      // took its row with it.
      const gone = decision.effects.some(
        (e) => e.kind === 'purge-document' || e.kind === 'bin-folder',
      );
      if (!gone) await ctx.record(decision.record);
      for (const type of decision.types) ctx.track('Applied', type);
      return decision.effects.length > 0;
    }
  }
}

// Apply one read of changes, folders first. Returns whether livediagram
// changed, so the pass re-reads before planning outbound.
export async function applyInbound(ctx: PassContext, changes: DriveChange[]): Promise<boolean> {
  const queue = orderChanges(changes, ctx.snapshot);
  let changed = false;
  while (queue.length > 0) {
    const change = queue.shift()!;
    const decision = planInbound(change, ctx.snapshot);
    if (decision.kind === 'echo') continue;
    if (await applyDecision(ctx, decision, change, queue)) changed = true;
  }
  await ctx.flushItems();
  return changed;
}

// Folder files carry these so a restored or re-met folder is recognised.
export function folderAppProperties(host: string, folderId: string): Record<string, string> {
  return { [DRIVE_PROP_FOLDER_ID]: folderId, [DRIVE_PROP_ORIGIN]: host };
}
