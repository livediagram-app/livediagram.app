// Inbound: Drive's changes applied to liveworkspace (liveworkspace/docs/specs/005-drive/drive.md "Inbound"), ported from
// livediagram's engine-inbound. The planner (`planInbound`) decides; every effect goes through the index acting as
// the person, and the snapshot follows along so later changes in the same read see what earlier ones did.

import {
  DRIVE_PASS_MAX_INBOUND,
  DRIVE_PROP_ORIGIN,
  orderChanges,
  planAdoption,
  planInbound,
  rowKey,
  type InboundDecision,
  type InboundEffect,
} from '@liveworkspace/drive';
import { DriveApiError, type DriveChange } from '@liveworkspace/drive/server';
import { IndexError } from '@liveworkspace/index-client';
import { driveLog, driveWarn } from '../log';
import { folderSubtree, type PassState } from './pass-state';

async function applyEffect(
  state: PassState,
  effect: InboundEffect,
  change: DriveChange,
  queue: DriveChange[],
): Promise<void> {
  const snap = state.snapshot;
  const { index } = state;
  const now = state.rt.deps.now();
  switch (effect.kind) {
    case 'rename-item': {
      await index.renameItem(effect.id, effect.name);
      const i = snap.items.get(effect.id);
      if (i) snap.items.set(effect.id, { ...i, name: effect.name, updatedAt: now });
      return;
    }
    case 'move-item': {
      await index.moveItem(effect.id, effect.folderId);
      const i = snap.items.get(effect.id);
      if (i) snap.items.set(effect.id, { ...i, folderId: effect.folderId });
      return;
    }
    case 'trash-item': {
      await index.trashItem(effect.id);
      const i = snap.items.get(effect.id);
      snap.items.delete(effect.id);
      if (i) snap.trash.set(effect.id, { id: i.id, app: i.app, name: i.name, trashedAt: now });
      return;
    }
    case 'restore-item': {
      await index.restoreItem(effect.id);
      const t = snap.trash.get(effect.id);
      snap.trash.delete(effect.id);
      if (t) {
        snap.items.set(effect.id, {
          id: t.id,
          app: t.app,
          name: t.name,
          folderId: null,
          updatedAt: now,
          createdAt: 0,
        });
      }
      return;
    }
    case 'purge-item': {
      await index.purgeItem(effect.id);
      snap.trash.delete(effect.id);
      state.drop('item', effect.id);
      return;
    }
    case 'rename-folder': {
      await index.renameFolder(effect.id, effect.name);
      const f = snap.folders.get(effect.id);
      if (f) snap.folders.set(effect.id, { ...f, name: effect.name, updatedAt: now });
      return;
    }
    case 'move-folder': {
      try {
        await index.moveFolder(effect.id, effect.parentId);
      } catch (err) {
        // A move that would make a cycle is refused; outbound puts Drive back.
        if (err instanceof IndexError && err.status === 409) {
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
      // Its items go to the Trash, then the folders go, deepest first.
      const subtree = new Set(folderSubtree(snap, effect.id));
      // A copy: trashing an item changes the map underneath.
      for (const item of Array.from(snap.items.values())) {
        if (item.folderId === null || !subtree.has(item.folderId)) continue;
        await applyEffect(state, { kind: 'trash-item', id: item.id }, change, queue);
        // Drive binned the file with its folder: the row says so, so outbound leaves it binned and restoring the
        // folder restores it.
        const row = snap.rows.get(rowKey('item', item.id));
        if (row) state.record({ ...row, trashed: true });
      }
      for (const folderId of [...subtree].reverse()) {
        await index.deleteFolder(folderId);
        snap.folders.delete(folderId);
        state.drop('folder', folderId);
      }
      return;
    }
    case 'recreate-folder': {
      await index.createFolder(effect.id, effect.name, effect.parentId);
      snap.folders.set(effect.id, {
        id: effect.id,
        name: effect.name,
        parentId: effect.parentId,
        updatedAt: now,
      });
      // Whatever came back with it, whether or not Drive sent a change for each child: read its children and plan
      // them too.
      const children = await state.rt.drive.listFiles(`'${effect.fileId}' in parents`);
      for (const file of children)
        queue.push({ fileId: file.id, removed: false, time: change.time, file });
      return;
    }
  }
}

// One effect, with the index's "not yours any more" (an item moved into a team, purged meanwhile) skipped rather
// than failing the pass: the next pass reads the person's work again.
async function applyGuarded(
  state: PassState,
  effect: InboundEffect,
  change: DriveChange,
  queue: DriveChange[],
) {
  try {
    await applyEffect(state, effect, change, queue);
    return true;
  } catch (err) {
    if (err instanceof IndexError && err.status === 404) {
      driveWarn('inbound-missing', { effect: effect.kind, id: effect.id });
      return false;
    }
    throw err;
  }
}

async function applyDecision(
  state: PassState,
  decision: InboundDecision,
  change: DriveChange,
  queue: DriveChange[],
): Promise<number> {
  switch (decision.kind) {
    case 'echo':
      return 0;
    case 'ignore':
      if (decision.reason === 'foreign-copy')
        driveLog('inbound-foreign-copy', { fileId: change.fileId });
      else driveLog('inbound-ignored', { fileId: change.fileId, reason: decision.reason });
      return 0;
    case 'forget':
      driveLog('inbound-forget', {
        fileId: change.fileId,
        id: decision.row.id,
        reason: decision.reason,
      });
      state.drop(decision.row.kind, decision.row.id);
      return 0;
    case 'adopt':
      driveLog('adopted', { fileId: change.fileId, kind: decision.row.kind, id: decision.row.id });
      state.record(decision.row);
      return 0;
    case 'apply': {
      let applied = 0;
      for (const effect of decision.effects) {
        driveLog('inbound', { effect: effect.kind, fileId: change.fileId });
        if (await applyGuarded(state, effect, change, queue)) applied += 1;
      }
      // Recorded once the effects landed (a re-created folder is then the parent its queued children resolve to).
      // A purge or a binned folder took its row with it.
      const gone = decision.effects.some((e) => e.kind === 'purge-item' || e.kind === 'bin-folder');
      if (!gone) state.record(decision.record);
      return applied;
    }
  }
}

// The subrequests one change's effects may take in the usual case (a rename, a move and a restore; a folder made
// again and its children listed). A folder binned with many items in it takes more, and the meter stops it mid-way
// (BudgetSpent): the next pass reads the change again and finishes it.
const INBOUND_CHANGE_COST = 4;

export type InboundRun = {
  // Effects that reached liveworkspace.
  applied: number;
  // Every change was planned; false when the batch stopped at DRIVE_PASS_MAX_INBOUND or the budget.
  complete: boolean;
};

/** Apply one read of changes, folders first, at most DRIVE_PASS_MAX_INBOUND of them with an effect. A run that stops
 *  short leaves the page token where it was: the next pass reads the same changes again, and the ones applied here
 *  read as echoes, since each recorded its row. */
export async function applyInbound(state: PassState, changes: DriveChange[]): Promise<InboundRun> {
  const queue = orderChanges(changes, state.snapshot);
  const { meter } = state.rt;
  let applied = 0;
  let changed = 0;
  while (queue.length > 0) {
    const change = queue[0]!;
    const decision = planInbound(change, state.snapshot);
    if (decision.kind === 'apply') {
      if (changed >= DRIVE_PASS_MAX_INBOUND || !meter.afford(INBOUND_CHANGE_COST)) {
        driveLog('inbound-batch', { applied: changed, left: queue.length });
        return { applied, complete: false };
      }
      changed += 1;
    }
    queue.shift();
    applied += await applyDecision(state, decision, change, queue);
  }
  return { applied, complete: true };
}

/** After a (re)connect, the files the service made earlier: recorded instead of made a second time. */
export async function adoptExisting(state: PassState): Promise<number> {
  const { origin } = state.rt.deps;
  const files = await state.rt.drive.listFiles(
    `appProperties has { key='${DRIVE_PROP_ORIGIN}' and value='${origin}' }`,
  );
  const { adopt, ambiguous } = planAdoption(files, state.snapshot);
  for (const row of adopt) state.record(row);
  if (ambiguous.length > 0) driveWarn('adopt-ambiguous', { items: ambiguous.length });
  driveLog('adopt-existing', { files: files.length, adopted: adopt.length });
  return adopt.length;
}

export type InboundRead =
  { changes: DriveChange[]; nextToken: string } | { rejected: true; startToken: string };

/** Every change since `pageToken`, or `rejected` when Drive no longer takes the token. */
export async function readChanges(state: PassState, pageToken: string): Promise<InboundRead> {
  const { drive } = state.rt;
  const changes: DriveChange[] = [];
  let token = pageToken;
  for (;;) {
    let page;
    try {
      page = await drive.listChanges(token);
    } catch (err) {
      if (err instanceof DriveApiError && (err.status === 400 || err.status === 404)) {
        driveWarn('page-token-rejected', { status: err.status });
        return { rejected: true, startToken: await drive.getStartPageToken() };
      }
      throw err;
    }
    changes.push(...page.changes);
    if (page.nextPageToken) token = page.nextPageToken;
    else return { changes, nextToken: page.newStartPageToken ?? token };
  }
}
