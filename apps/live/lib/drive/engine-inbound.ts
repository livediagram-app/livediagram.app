// Applying inbound decisions (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Inbound"). Every effect goes through the ordinary livediagram routes via
// the port, and the snapshot follows along so later changes in the same read
// see what the earlier ones did.

import {
  DRIVE_PROP_DIAGRAM_ID,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ORIGIN,
} from '@livediagram/api-schema';
import { parseDiagramEnvelope } from '../export-diagram-text';
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
    case 'rename-diagram': {
      await ctx.port.renameDiagram(effect.id, effect.name);
      const d = snap.diagrams.get(effect.id);
      if (d) snap.diagrams.set(effect.id, { ...d, name: effect.name, savedAt: ctx.now() });
      return;
    }
    case 'move-diagram': {
      await ctx.port.moveDiagram(effect.id, effect.folderId);
      const d = snap.diagrams.get(effect.id);
      if (d) snap.diagrams.set(effect.id, { ...d, folderId: effect.folderId });
      return;
    }
    case 'trash-diagram': {
      await ctx.port.trashDiagram(effect.id);
      const d = snap.diagrams.get(effect.id);
      snap.diagrams.delete(effect.id);
      if (d) snap.trash.set(effect.id, { id: d.id, name: d.name, trashedAt: ctx.now() });
      return;
    }
    case 'restore-diagram': {
      await ctx.port.restoreDiagram(effect.id);
      const t = snap.trash.get(effect.id);
      snap.trash.delete(effect.id);
      if (t)
        snap.diagrams.set(effect.id, {
          id: t.id,
          name: t.name,
          folderId: null,
          savedAt: ctx.now(),
          createdAt: 0,
        });
      return;
    }
    case 'purge-diagram': {
      await ctx.port.purgeDiagram(effect.id);
      snap.trash.delete(effect.id);
      // The purge's own batch dropped the row.
      dropSnapshotItem(snap, 'diagram', effect.id);
      ctx.discard('diagram', effect.id);
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
      // Its diagrams go to the Trash, then the folders go, deepest first.
      const subtree = folderSubtree(snap, effect.id);
      for (const d of [...snap.diagrams.values()]) {
        if (d.folderId === null || !subtree.includes(d.folderId)) continue;
        await applyEffect(ctx, { kind: 'trash-diagram', id: d.id }, change, queue);
        // Drive binned the file with its folder; the row says so, so outbound
        // leaves it implicitly binned and restoring the folder restores it.
        const item = snap.items.get(itemKey('diagram', d.id));
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
    case 'copy-diagram':
      await applyCopy(ctx, effect);
      return;
  }
}

// A copy made in Drive (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive").
// Throws CopyUnreadable when there is nothing to make the diagram from.
async function applyCopy(
  ctx: PassContext,
  effect: Extract<InboundEffect, { kind: 'copy-diagram' }>,
): Promise<void> {
  const target = { id: effect.newId, name: effect.name, folderId: effect.folderId };
  // An earlier pass that stopped before the re-tag already made it.
  if (!(await ctx.port.canOpenDiagram(effect.newId))) {
    if (effect.sourceId) {
      await ctx.port.duplicateDiagram(effect.sourceId, target);
    } else {
      const parsed = parseDiagramEnvelope(await ctx.drive.download(effect.fileId));
      if (!parsed.ok) throw new CopyUnreadable(parsed.failure);
      await ctx.port.importDiagramCopy(parsed.envelope, target);
    }
  }
  ctx.snapshot.diagrams.set(effect.newId, {
    id: effect.newId,
    name: effect.name,
    folderId: effect.folderId,
    savedAt: ctx.now(),
    createdAt: ctx.now(),
  });
  // From now on the copy mirrors the new diagram. A failure here fails the
  // pass, so the page token stays and the change is read again.
  await ctx.drive.updateFile(effect.fileId, {
    appProperties: {
      [DRIVE_PROP_DIAGRAM_ID]: effect.newId,
      [DRIVE_PROP_ORIGIN]: ctx.snapshot.host,
    },
  });
}

class CopyUnreadable extends Error {
  constructor(failure: string) {
    super(`copy unreadable: ${failure}`);
    this.name = 'CopyUnreadable';
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
      if (decision.reason !== 'not-ours')
        driveLog('inbound-ignored', { fileId: change.fileId, reason: decision.reason });
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
        try {
          await applyEffect(ctx, effect, change, queue);
        } catch (err) {
          // Never silent: a copy with nothing to make a diagram from is listed
          // in the Drive panel, and nothing is recorded.
          if (!(err instanceof CopyUnreadable) || effect.kind !== 'copy-diagram') throw err;
          driveWarn('copy-unreadable', { fileId: change.fileId, error: err.message });
          ctx.skip({ name: effect.name, reason: 'unreadable' });
          return false;
        }
      }
      // Recorded once the effects landed (a re-created folder is then the
      // parent its queued children resolve to). A purge or a binned folder
      // took its row with it.
      const gone = decision.effects.some(
        (e) => e.kind === 'purge-diagram' || e.kind === 'bin-folder',
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
