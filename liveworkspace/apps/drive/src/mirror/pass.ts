// One pass (liveworkspace/docs/drive.md "The service", "Cadence"), run by the object's alarm: a token, the root, the
// push channel, the person's whole picture from the index, the gate (changes.getStartPageToken) and inbound, then
// outbound in batches of DRIVE_PASS_MAX_WRITES, and the next alarm: the next batch straight away, else the soonest of
// the next content write that falls due, the fallback check and the channel's renewal.

import {
  backoffHit,
  driveRootName,
  DRIVE_CHANNEL_RENEW_BEFORE_MS,
  DRIVE_FALLBACK_CHECK_MS,
  DRIVE_FALLBACK_CHECK_WATCHED_MS,
  DRIVE_PASS_CONTINUE_MS,
  DRIVE_PASS_MAX_WRITES,
  DRIVE_PROP_ROOT,
  fallbackCheckMs,
  planOutbound,
  writeIntervalMs,
} from '@liveworkspace/drive';
import { DriveApiError } from '@liveworkspace/drive/server';
import { driveLog, driveWarn, errorKind } from '../log';
import { channelLive, maintainChannel, pageTokenOf } from './channel';
import { PassAborted, type Runtime } from './context';
import { adoptExisting, applyInbound, readChanges } from './inbound';
import { runOutbound } from './outbound';
import { PassState } from './pass-state';
import type { Connection, StoredRow } from './store';
import { NeedsReconnect } from './tokens';

export type PassOutcome =
  // Finished, or stopped at the batch limit (`more`).
  | { kind: 'done'; more: boolean; nextDueAt: number | null }
  // Failed; the next pass tries again after `retryAt`.
  | { kind: 'failed'; retryAt: number }
  // Nothing to schedule: disconnected meanwhile, or the grant needs a new consent.
  | { kind: 'stopped' };

// The root folder, by id: found again by its lwRoot after a reconnect, made in My Drive otherwise. The first page
// token is taken before anything is written, so every later write reads back as an echo.
async function ensureRoot(
  rt: Runtime,
  connection: Connection,
): Promise<{ rootId: string; fresh: boolean }> {
  if (connection.rootId) return { rootId: connection.rootId, fresh: false };
  const { deps, drive } = rt;
  await pageTokenOf(rt);
  const existing = await drive.listFiles(
    `appProperties has { key='${DRIVE_PROP_ROOT}' and value='${deps.origin}' } and trashed = false`,
  );
  let root = existing[0];
  if (root) {
    driveLog('root-found', { person: rt.personId, root: root.id });
  } else {
    root = await drive.createFolder({
      name: driveRootName(deps.environment),
      parentId: 'root',
      appProperties: { [DRIVE_PROP_ROOT]: deps.origin },
    });
    driveLog('root-created', { person: rt.personId, root: root.id });
  }
  rt.guard();
  deps.store.updateConnection({ rootId: root.id, rootName: root.name });
  return { rootId: root.id, fresh: true };
}

// Inbound, behind the gate: the start token names the position after the latest change, so one equal to the stored
// token means nothing new. Returns how many changes reached liveworkspace (adoptions count, so the picture is read
// again), or `root-gone` when the root was deleted for good.
async function inbound(state: PassState): Promise<number | 'root-gone'> {
  const { rt } = state;
  const { store } = rt.deps;
  const stored = store.connection()?.pageToken ?? null;
  const start = await rt.drive.getStartPageToken();
  if (stored === null || stored === start) {
    if (stored === null) store.updateConnection({ pageToken: start });
    return 0;
  }
  const read = await readChanges(state, stored);
  if ('rejected' in read) {
    // A token Drive no longer takes: start again from now, and adopt what the lost stretch may have made.
    store.updateConnection({ pageToken: read.startToken });
    return adoptExisting(state);
  }
  const rootId = state.snapshot.rootFolderId;
  const root = read.changes.findLast((c) => c.fileId === rootId);
  if (root && (root.removed || !root.file)) {
    driveWarn('root-missing', { person: rt.personId, root: rootId });
    store.clearRows();
    store.updateConnection({ rootId: null, rootName: null, pageToken: read.nextToken });
    return 'root-gone';
  }
  if (root?.file) store.updateConnection({ rootName: root.file.name });
  const applied = await applyInbound(state, read.changes);
  rt.guard();
  store.updateConnection({ pageToken: read.nextToken });
  return applied;
}

export async function runPass(rt: Runtime): Promise<PassOutcome> {
  const { store, now: clock } = rt.deps;
  const connection = store.connection();
  if (!connection || connection.status === 'needs_reconnect') return { kind: 'stopped' };
  store.updateConnection({ syncing: true });
  const flush = connection.flushNext;
  try {
    await rt.tokens.get();
    const root = await ensureRoot(rt, connection);
    await maintainChannel(rt);
    const index = rt.deps.index.forPerson(rt.personId);
    let picture = await index.picture();
    const state = PassState.build(rt, index, root.rootId, picture);
    let adopted = root.fresh ? await adoptExisting(state) : 0;
    const applied = await inbound(state);
    if (applied === 'root-gone') {
      store.updateConnection({ syncing: false, progress: null });
      return { kind: 'done', more: true, nextDueAt: null };
    }
    adopted += applied;
    if (adopted > 0) picture = await state.reread();
    const rows = new Map<string, StoredRow>(
      store.rows().flatMap((r) => (r.kind === 'item' ? [[r.id, r]] : [])),
    );
    store.noteSeen(picture.items, rows);

    const now = clock();
    const backoff = store.connection()?.backoff ?? connection.backoff;
    const plan = planOutbound(state.snapshot, {
      now,
      flush,
      writeIntervalMs: writeIntervalMs(backoff, now),
    });
    const run = await runOutbound(state, plan.ops, DRIVE_PASS_MAX_WRITES);
    rt.guard();
    const before = store.connection()?.progress ?? null;
    const done = (before?.done ?? 0) + run.written;
    const total = Math.max(before?.total ?? 0, (before?.done ?? 0) + plan.ops.length);
    store.updateConnection({
      syncing: run.more,
      progress: run.more ? { done, total } : null,
      status: 'ok',
      lastPassAt: clock(),
      ...(run.more ? {} : { lastSyncedAt: clock(), flushNext: false }),
    });
    driveLog('pass', { person: rt.personId, in: applied, out: run.written, more: run.more });
    return { kind: 'done', more: run.more, nextDueAt: plan.nextDueAt };
  } catch (err) {
    return failed(rt, err);
  }
}

function failed(rt: Runtime, err: unknown): PassOutcome {
  const { store, now: clock } = rt.deps;
  if (err instanceof PassAborted) return { kind: 'stopped' };
  if (err instanceof NeedsReconnect) {
    store.updateConnection({ syncing: false, progress: null });
    return { kind: 'stopped' };
  }
  const now = clock();
  let backoff = store.connection()?.backoff;
  if (err instanceof DriveApiError && err.isRateLimit && backoff) {
    backoff = backoffHit(backoff, now);
    driveWarn('backoff', { person: rt.personId, status: err.status, level: backoff.level });
  } else {
    driveWarn('pass-failed', { person: rt.personId, error: errorKind(err) });
  }
  store.updateConnection({
    syncing: false,
    progress: null,
    status: 'error',
    lastPassAt: now,
    ...(backoff ? { backoff } : {}),
  });
  return {
    kind: 'failed',
    retryAt: now + writeIntervalMs(backoff ?? { level: 0, lastErrorAt: null }, now),
  };
}

/** When the next pass runs, or null for none. An earlier alarm already set (a signal during the pass) stands. */
export function nextPassAt(
  connection: Connection | null,
  outcome: PassOutcome,
  now: number,
): number | null {
  if (!connection || outcome.kind === 'stopped' || connection.status === 'needs_reconnect')
    return null;
  const live = channelLive(connection, now);
  const base = live ? DRIVE_FALLBACK_CHECK_WATCHED_MS : DRIVE_FALLBACK_CHECK_MS;
  const candidates = [
    (connection.lastPassAt ?? now) + fallbackCheckMs(connection.backoff, now, base),
  ];
  if (outcome.kind === 'failed') candidates.push(outcome.retryAt);
  if (outcome.kind === 'done' && outcome.more) candidates.push(now + DRIVE_PASS_CONTINUE_MS);
  if (outcome.kind === 'done' && outcome.nextDueAt !== null) candidates.push(outcome.nextDueAt);
  // A renewal already due was tried this pass (and is retried with the fallback check), never in a loop.
  const renewAt = (connection.channelExpiresAt ?? 0) - DRIVE_CHANNEL_RENEW_BEFORE_MS;
  if (connection.channelExpiresAt !== null && renewAt > now) candidates.push(renewAt);
  return Math.max(now, Math.min(...candidates));
}
