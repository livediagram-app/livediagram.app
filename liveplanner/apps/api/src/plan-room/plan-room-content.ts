// The plan's content state for its room (plan-room.ts): the schema on first use, the write notes that arm the
// outbox, the drains to the index and to shared tabs' holders, the daily upkeep, the Community post's checks and
// the purge. Each takes the room it acts for.
import {
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  flushAfterWrite,
  nextOutboxFlushAt,
  outboxDueAt,
} from '@liveworkspace/index-app';
import { PROJECT_TRASHED_CLOSE } from '@liveplanner/api-schema';
import { withoutLegacyThread } from '@liveplanner/project';
import { disarmRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import { CHANGESET_RETENTION_MS } from '@liveplanner/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { deleteOldItemHistory } from '../db/item-history';
import { ITEM_IMPORT_HOLD_MS, sweepHeldImports } from '../db/item-imports';
import { ITEM_HISTORY_MAX_AGE_MS } from '@liveplanner/items';
import { runSheetExpiry } from '../sheet-sweep';
import { planShares } from './tab-shares';
import { planRoom } from '../plan-client';
import { hasPlanSchema, migratePlanSchema } from './plan-schema';
import { forgetImageRefs } from './image-refs';
import { readPlanMeta } from './plan-content';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  leaveCommunity,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import { drainOutbox } from './plan-outbox';
import type { PlanRoom } from './plan-room';
import { closeSockets } from './plan-room-sockets';

// The plan's own daily upkeep: unreferenced sheets expire, old changesets go (both used to be crons).
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;

export const MAINTENANCE_KEY = 'maintenance-at';
// How long a repeat wake that failed as a whole waits before it tries again.
const REPEAT_RETRY_MS = 60 * 1000;

// After a wake: the plan id and anything the outbox still owes the index. Reads only; a plan with no schema yet
// (an id nothing has written) stays without one.
export function restoreContentState(room: PlanRoom, maintenanceAt: number | undefined): void {
  room.maintenanceAt = maintenanceAt ?? null;
  const sql = room.state.storage.sql;
  if (!sql || !hasPlanSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  const row = sql.exec('SELECT id FROM plan LIMIT 1').toArray()[0];
  if (typeof row?.id === 'string' && room.planId === null) room.planId = row.id;
  // Anything owed goes now, or when its wait after a failure is over (index-app outbox.ts).
  const due = outboxDueAt(sql);
  if (due !== null) room.flushAt = Math.max(Date.now(), due);
  room.shares.restore();
  room.repeats.restore(Date.now());
  room.automations.restore(Date.now());
  // The Community post's next check (community-post.ts), from when it last asked.
  const post = sql
    .exec<{ checked_at: number }>('SELECT checked_at FROM community_post LIMIT 1')
    .toArray()[0];
  room.communityAt = post ? post.checked_at + COMMUNITY_CHECK_MS : null;
}

// The schema on first use (plan-schema.ts), and the plan's row once its id is known, so the content's
// foreign keys always find it. A row made here has no dates (0): a create or a copy sets them, and the
// summary push never moves saved_at back.
export function ensureSchema(room: PlanRoom): void {
  if (room.schemaReady && (room.planRowReady || room.planId === null)) return;
  const sql = room.state.storage.sql;
  if (!room.schemaReady) {
    migratePlanSchema((q) => sql.exec(q));
    room.schemaReady = true;
  }
  if (room.planId !== null && !room.planRowReady) {
    sql.exec('INSERT OR IGNORE INTO plan (id, saved_at, created_at) VALUES (?, 0, 0)', room.planId);
    room.planRowReady = true;
  }
}

// A content write happened: push to the index on idle, at most once a minute (plan-outbox.ts). Writes the drain
// itself makes (its outbox delete) schedule nothing.
export function noteWrite(room: PlanRoom): void {
  if (room.draining) return;
  room.writes++;
  if (room.maintenanceAt === null) {
    room.maintenanceAt = Date.now() + MAINTENANCE_EVERY_MS;
    void room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
    room.armAlarm();
  }
  // A shared tab's holders get their copy on idle (tab-shares.ts).
  if (room.shares.noteWrite()) room.armAlarm();
  // A rule set, changed or stopped, or its card trashed or restored, is settled on the next wake.
  if (room.repeats.noteWrite(Date.now())) room.armAlarm();
  // A drain set far off, for a key in backoff, gives way to the key just written.
  const at = flushAfterWrite(room.state.storage.sql, room.flushAt, Date.now(), room.lastFlushAt);
  if (at === null) return;
  room.flushAt = at;
  room.armAlarm();
}

// Push what the outbox holds to the index now. A failure keeps it and retries later.
// Push what the outbox holds now, and send what the shared tabs' holders are owed. A failure keeps it and retries
// later.
export async function drain(room: PlanRoom): Promise<void> {
  await drainIndex(room);
  await drainShares(room);
}

// Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
export async function drainShares(room: PlanRoom): Promise<void> {
  const env = room.roomEnv;
  const planId = room.planId;
  if (!env || !planId || !room.schemaReady) {
    room.shares.clear();
    return;
  }
  room.draining = true;
  try {
    const done = await room.shares.send(() =>
      planShares.drain(env, planId, (to, messages) =>
        planRoom(env, to).receiveShares(planId, messages),
      ),
    );
    if (done && done.sent > 0) console.debug('[tab-shares] sent', { planId, sent: done.sent });
  } finally {
    room.draining = false;
  }
}

export async function drainIndex(room: PlanRoom): Promise<void> {
  const env = room.roomEnv;
  const planId = room.planId;
  room.flushAt = null;
  if (!env || !planId || !room.schemaReady) return;
  room.draining = true;
  try {
    const { keys, pushes, more } = await drainOutbox(env, planId);
    room.lastFlushAt = Date.now();
    if (keys > 0) console.debug('[plan-outbox] pushed', { planId, keys, pushes });
    // A big import's tabs go a batch at a time, back to back, not a minute apart.
    if (more) room.flushAt = Date.now() + FLUSH_IDLE_MS;
  } catch (error) {
    // The drain itself failed (a read, say): a push that fails is counted on its keys instead.
    console.warn('[plan-outbox] push failed', { planId, error: String(error) });
    room.flushAt = Date.now() + FLUSH_RETRY_MS;
  } finally {
    room.draining = false;
  }
  // Anything written while the push was in flight goes next time; a key that failed, when its wait is over.
  if (room.flushAt === null)
    room.flushAt = nextOutboxFlushAt(room.state.storage.sql, Date.now(), room.lastFlushAt);
}

// The plan's daily upkeep, once a day per plan with content: sheets unreferenced for 30 days expire
// (sheet-sweep.ts), changesets past their retention go (CS28), and so do card history entries past their age
// (db/item-history.ts).
export async function maintain(room: PlanRoom, now: number): Promise<void> {
  const env = room.roomEnv;
  const planId = room.planId;
  room.maintenanceAt = now + MAINTENANCE_EVERY_MS;
  await room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
  await keepLedger(room, now);
  if (!env || !planId || !room.schemaReady) return;
  try {
    await runSheetExpiry(env, planId, now);
    const gone = await deleteOldChangesets(env, now - CHANGESET_RETENTION_MS);
    if (gone > 0) console.info('[changeset] retention', { planId, deleted: gone });
    const aged = await deleteOldItemHistory(env, now - ITEM_HISTORY_MAX_AGE_MS);
    if (aged > 0) console.info('[items] history.retention', { planId, deleted: aged });
    // An import's parts left waiting for its last (db/item-imports.ts).
    const held = await sweepHeldImports(env, planId, now - ITEM_IMPORT_HOLD_MS);
    if (held > 0) console.info('[items] import.swept', { planId, cards: held });
  } catch (error) {
    console.warn('[plan-room] upkeep failed', { planId, error: String(error) });
  }
}

// The ledger's share of the upkeep: an entry nobody has touched for 30 days goes (room-ledger-store.ts). It never
// stops the rest of the upkeep.
export async function keepLedger(room: PlanRoom, now: number): Promise<void> {
  try {
    const kept = await room.ledger.upkeep({ now, seq: room.seq, tabs: storedTabIds(room) });
    if (kept.dropped > 0 || kept.stamped > 0) console.info('[ledger] upkeep', kept);
  } catch (error) {
    console.warn('[ledger] upkeep failed', { error: String(error) });
  }
}

// The ids of the tabs this room stores, or null when it can't say (no schema yet, or no tabs).
export function storedTabIds(room: PlanRoom): ReadonlySet<string> | null {
  const sql = room.state.storage.sql;
  if (!sql || !(room.schemaReady || hasPlanSchema((q) => sql.exec(q)))) return null;
  const ids = new Set(
    sql
      .exec<{ id: string }>('SELECT id FROM tabs')
      .toArray()
      .map((r) => r.id),
  );
  return ids.size > 0 ? ids : null;
}

// A plan going for good tells the other holders of its shared tabs it left, so their copies stop counting it.
// Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
export async function leaveShares(room: PlanRoom): Promise<void> {
  const env = room.roomEnv;
  const planId = room.planId;
  const sql = room.state.storage.sql;
  if (!env || !planId || !sql || !hasPlanSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  await planShares.leaveAll(env, planId, (to, messages) =>
    planRoom(env, to).receiveShares(planId, messages),
  );
}

// Ask the index where the Community post's plan stands, and send the service what changed (community-post.ts). A
// failure keeps the post and tries again at the next check.
export async function checkCommunity(room: PlanRoom, now: number): Promise<void> {
  const planId = room.planId;
  room.communityAt = null;
  const env = room.roomEnv;
  if (planId === null || !env || !room.storedSchema()) return;
  let post: CommunityPost | null;
  try {
    post = await checkCommunityPost(env, planId, await readPlanMeta(env, planId), now);
  } catch (error) {
    console.warn('[community] check failed', { error: String(error) });
    post = await readCommunityPost(env);
    if (post) {
      room.communityAt = now + COMMUNITY_CHECK_MS;
      return;
    }
  }
  room.communityAt = communityCheckDueAt(post);
}

// The project is gone for good: end every session, then drop everything stored here, which includes the
// collaboration ledger's comment and answer text, the order state and the alarm.
// The ledger's queued writes land first, so none of them can re-create a key after the wipe.
// That includes the plan's content: its SQLite goes with everything else.
export async function purge(room: PlanRoom, planId?: string): Promise<void> {
  if (planId !== undefined) room.bindPlan(planId);
  closeSockets(room, () => [PROJECT_TRASHED_CLOSE, 'project-purged']);
  room.opLog = [];
  await leaveShares(room);
  // A plan going for good takes its Community post with it: the service hears it is gone.
  if (room.planId !== null && room.storedSchema() && room.roomEnv)
    await leaveCommunity(room.roomEnv, room.planId);
  await room.ledger.settled();
  // What the media service last heard the plan's cards hold (image-refs.ts), read before it goes.
  const sentImages = lastSentImages(room);
  await disarmRoomAlarm(room.state.storage);
  await room.state.storage.deleteAll();
  room.schemaReady = false;
  room.planRowReady = false;
  room.flushAt = null;
  room.shares.clear();
  room.repeats.clear();
  room.automations.clear();
  room.maintenanceAt = null;
  room.communityAt = null;
  // The purged plan holds no pictures now, so the media service's sweep may take those only it held. A failure
  // keeps them (storage kept, never a broken picture) and does not stop the purge.
  const env = room.roomEnv;
  if (env && room.planId) {
    await forgetImageRefs(env, room.planId, sentImages).catch((error: unknown) =>
      console.warn('[media] refs not cleared for a purged plan', { error: String(error) }),
    );
  }
  console.info('[room] purged');
}

// The copies of the plan's repeating cards that are due (card-repeats.ts), each relayed as an ordered `items` op. A
// wake that fails as a whole tries again a minute later.
export async function runRepeats(room: PlanRoom, now: number): Promise<void> {
  const env = room.roomEnv;
  const planId = room.planId;
  if (!env || !planId || !room.schemaReady) {
    room.repeats.clear();
    return;
  }
  try {
    const run = await room.repeats.run(env, planId, now, (items, rev) =>
      room.broadcastOrderedSystemOp({
        kind: 'items',
        upserts: items.map(withoutLegacyThread),
        removed: [],
        rev,
      }),
    );
    if (run.made > 0) console.info('[repeats] wake', { planId, made: run.made });
  } catch (error) {
    console.warn('[repeats] failed', { planId, error: String(error) });
    room.repeats.at = now + REPEAT_RETRY_MS;
  }
}

// The pictures last reported for this plan (image-refs.ts `media_refs`), null when none were or it has no schema.
export function lastSentImages(room: PlanRoom): string | null {
  try {
    const sql = room.state.storage.sql;
    if (!room.schemaReady && !hasPlanSchema((q) => sql.exec(q))) return null;
    const row = sql.exec('SELECT images FROM media_refs LIMIT 1').toArray()[0];
    return typeof row?.images === 'string' ? row.images : null;
  } catch {
    // A plan whose schema predates media_refs, or storage without SQLite, reported nothing.
    return null;
  }
}
