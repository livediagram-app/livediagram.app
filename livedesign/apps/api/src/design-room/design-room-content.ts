// The design's content state for its room (design-room.ts): the schema on first use, the write notes that arm the
// outbox, the drains to the index and to shared tabs' holders, the daily upkeep, the Community post's checks and
// the purge. Each takes the room it acts for.
import {
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  flushAfterWrite,
  nextOutboxFlushAt,
  outboxDueAt,
} from '@liveworkspace/index-app';
import { DESIGN_TRASHED_CLOSE } from '@livedesign/api-schema';
import { disarmRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import { CHANGESET_RETENTION_MS } from '@livedesign/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { designBlobIds, releaseBlobs, sweepDesignPhotoBlobs } from '../db/photo-blobs';
import { forgetDesignMediaRefs } from '../media';
import { designShares } from './tab-shares';
import { designRoom } from '../design-client';
import { hasDesignSchema, migrateDesignSchema } from './design-schema';
import { readDesignMeta } from './design-content';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  leaveCommunity,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import { drainOutbox } from './design-outbox';
import type { DesignRoom } from './design-room';
import { closeSockets } from './design-room-sockets';

// The design's own daily upkeep: unnamed photo blobs go, old changesets go.
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;

export const MAINTENANCE_KEY = 'maintenance-at';

// After a wake: the design id and anything the outbox still owes the index and the media service. Reads only; a design with no schema yet
// (an id nothing has written) stays without one.
export function restoreContentState(room: DesignRoom, maintenanceAt: number | undefined): void {
  room.maintenanceAt = maintenanceAt ?? null;
  const sql = room.state.storage.sql;
  if (!sql || !hasDesignSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  const row = sql.exec('SELECT id FROM design LIMIT 1').toArray()[0];
  if (typeof row?.id === 'string' && room.designId === null) room.designId = row.id;
  // Anything owed goes now, or when its wait after a failure is over (index-app outbox.ts).
  const due = outboxDueAt(sql);
  if (due !== null) room.flushAt = Math.max(Date.now(), due);
  room.shares.restore();
  // The Community post's next check (community-post.ts), from when it last asked.
  const post = sql
    .exec<{ checked_at: number }>('SELECT checked_at FROM community_post LIMIT 1')
    .toArray()[0];
  room.communityAt = post ? post.checked_at + COMMUNITY_CHECK_MS : null;
}

// The schema on first use (design-schema.ts), and the design's row once its id is known, so the content's
// foreign keys always find it. A row made here has no dates (0): a create or a copy sets them, and the
// summary push never moves saved_at back.
export function ensureSchema(room: DesignRoom): void {
  if (room.schemaReady && (room.designRowReady || room.designId === null)) return;
  const sql = room.state.storage.sql;
  if (!room.schemaReady) {
    migrateDesignSchema((q) => sql.exec(q));
    room.schemaReady = true;
  }
  if (room.designId !== null && !room.designRowReady) {
    sql.exec(
      'INSERT OR IGNORE INTO design (id, saved_at, created_at) VALUES (?, 0, 0)',
      room.designId,
    );
    room.designRowReady = true;
  }
}

// A content write happened: push to the index and the media service on idle, at most once a minute (design-outbox.ts). Writes the drain
// itself makes (its outbox delete) schedule nothing.
export function noteWrite(room: DesignRoom): void {
  if (room.draining) return;
  room.writes++;
  if (room.maintenanceAt === null) {
    room.maintenanceAt = Date.now() + MAINTENANCE_EVERY_MS;
    void room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
    room.armAlarm();
  }
  // A shared tab's holders get their copy on idle (tab-shares.ts).
  if (room.shares.noteWrite()) room.armAlarm();
  // A drain set far off, for a key in backoff, gives way to the key just written.
  const at = flushAfterWrite(room.state.storage.sql, room.flushAt, Date.now(), room.lastFlushAt);
  if (at === null) return;
  room.flushAt = at;
  room.armAlarm();
}

// Push what the outbox holds to the index and the media service now. A failure keeps it and retries later.
// Push what the outbox holds now, and send what the shared tabs' holders are owed. A failure keeps it and retries
// later.
export async function drain(room: DesignRoom): Promise<void> {
  await drainIndex(room);
  await drainShares(room);
}

// Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
export async function drainShares(room: DesignRoom): Promise<void> {
  const env = room.roomEnv;
  const designId = room.designId;
  if (!env || !designId || !room.schemaReady) {
    room.shares.clear();
    return;
  }
  room.draining = true;
  try {
    const done = await room.shares.send(() =>
      designShares.drain(env, designId, (to, messages) =>
        designRoom(env, to).receiveShares(designId, messages),
      ),
    );
    if (done && done.sent > 0) console.debug('[tab-shares] sent', { designId, sent: done.sent });
  } finally {
    room.draining = false;
  }
}

export async function drainIndex(room: DesignRoom): Promise<void> {
  const env = room.roomEnv;
  const designId = room.designId;
  room.flushAt = null;
  if (!env || !designId || !room.schemaReady) return;
  room.draining = true;
  try {
    const { keys, pushes, more } = await drainOutbox(env, designId);
    room.lastFlushAt = Date.now();
    if (keys > 0) console.debug('[design-outbox] pushed', { designId, keys, pushes });
    // A big import's tabs go a batch at a time, back to back, not a minute apart.
    if (more) room.flushAt = Date.now() + FLUSH_IDLE_MS;
  } catch (error) {
    // The drain itself failed (a read, say): a push that fails is counted on its keys instead.
    console.warn('[design-outbox] push failed', { designId, error: String(error) });
    room.flushAt = Date.now() + FLUSH_RETRY_MS;
  } finally {
    room.draining = false;
  }
  // Anything written while the push was in flight goes next time; a key that failed, when its wait is over.
  if (room.flushAt === null)
    room.flushAt = nextOutboxFlushAt(room.state.storage.sql, Date.now(), room.lastFlushAt);
}

// The design's daily upkeep, once a day per design with content: photo blob refs its tabs no longer name go,
// and the blobs it no longer holds are released (db/photo-blobs.ts); changesets past their retention go (CS28).
export async function maintain(room: DesignRoom, now: number): Promise<void> {
  const env = room.roomEnv;
  const designId = room.designId;
  room.maintenanceAt = now + MAINTENANCE_EVERY_MS;
  await room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
  await keepLedger(room, now);
  if (!env || !designId || !room.schemaReady) return;
  try {
    const photos = await sweepDesignPhotoBlobs(env, designId, now);
    if (photos.refs > 0) console.info('[photo-blobs] sweep', { designId, ...photos });
    const gone = await deleteOldChangesets(env, now - CHANGESET_RETENTION_MS);
    if (gone > 0) console.info('[changeset] retention', { designId, deleted: gone });
  } catch (error) {
    console.warn('[design-room] upkeep failed', { designId, error: String(error) });
  }
}

// The ledger's share of the upkeep: an entry nobody has touched for 30 days goes (room-ledger-store.ts). It never
// stops the rest of the upkeep.
export async function keepLedger(room: DesignRoom, now: number): Promise<void> {
  try {
    const kept = await room.ledger.upkeep({ now, seq: room.seq, tabs: storedTabIds(room) });
    if (kept.dropped > 0 || kept.stamped > 0) console.info('[ledger] upkeep', kept);
  } catch (error) {
    console.warn('[ledger] upkeep failed', { error: String(error) });
  }
}

// The ids of the tabs this room stores, or null when it can't say (no schema yet, or no tabs).
export function storedTabIds(room: DesignRoom): ReadonlySet<string> | null {
  const sql = room.state.storage.sql;
  if (!sql || !(room.schemaReady || hasDesignSchema((q) => sql.exec(q)))) return null;
  const ids = new Set(
    sql
      .exec<{ id: string }>('SELECT id FROM tabs')
      .toArray()
      .map((r) => r.id),
  );
  return ids.size > 0 ? ids : null;
}

// A design going for good tells the other holders of its shared tabs it left, so their copies stop counting it.
// Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
export async function leaveShares(room: DesignRoom): Promise<void> {
  const env = room.roomEnv;
  const designId = room.designId;
  const sql = room.state.storage.sql;
  if (!env || !designId || !sql || !hasDesignSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  await designShares.leaveAll(env, designId, (to, messages) =>
    designRoom(env, to).receiveShares(designId, messages),
  );
}

// Ask the index where the Community post's design stands, and send the service what changed (community-post.ts).
// A failure keeps the post and tries again at the next check.
export async function checkCommunity(room: DesignRoom, now: number): Promise<void> {
  const designId = room.designId;
  room.communityAt = null;
  if (designId === null || !room.storedSchema()) return;
  const env = room.requireEnv();
  let post: CommunityPost | null;
  try {
    post = await checkCommunityPost(env, designId, await readDesignMeta(env, designId), now);
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

// The design is gone for good: end every session, then drop everything stored here, which includes the
// collaboration ledger's comment, idea and answer text, the order state and the alarm.
// The ledger's queued writes land first, so none of them can re-create a key after the wipe.
// That includes the design's content: its SQLite goes with everything else.
export async function purge(room: DesignRoom, designId?: string): Promise<void> {
  if (designId !== undefined) room.bindDesign(designId);
  closeSockets(room, () => [DESIGN_TRASHED_CLOSE, 'design-purged']);
  room.opLog = [];
  await leaveShares(room);
  // A design going for good takes its Community post with it: the service hears it is gone.
  if (room.designId !== null && room.storedSchema())
    await leaveCommunity(room.requireEnv(), room.designId);
  await room.ledger.settled();
  // What the design holds outside its own storage: its photo blobs' markers (and the blobs no other design
  // holds), and its images' references at the media service.
  const env = room.roomEnv;
  const id = room.designId;
  const blobs = env && room.schemaReady ? await designBlobIds(env) : [];
  await disarmRoomAlarm(room.state.storage);
  await room.state.storage.deleteAll();
  if (env && id) {
    await releaseBlobs(env, id, blobs);
    await forgetDesignMediaRefs(env, id);
  }
  room.schemaReady = false;
  room.designRowReady = false;
  room.flushAt = null;
  room.shares.clear();
  room.maintenanceAt = null;
  room.communityAt = null;
  console.info('[room] purged');
}
