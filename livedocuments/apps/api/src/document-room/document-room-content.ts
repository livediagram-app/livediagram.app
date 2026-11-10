// The document's content state for its room (document-room.ts): the schema on first use, the write notes that arm the
// outbox, the drains to the index and to shared tabs' holders, the daily upkeep, the Community post's checks and
// the purge. Each takes the room it acts for.
import {
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  flushAfterWrite,
  nextOutboxFlushAt,
  outboxDueAt,
} from '@liveworkspace/index-app';
import { DOCUMENT_TRASHED_CLOSE } from '@livedocuments/api-schema';
import { disarmRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import { CHANGESET_RETENTION_MS } from '@livedocuments/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { documentShares } from './tab-shares';
import { documentRoom } from '../document-client';
import { hasDocumentSchema, migrateDocumentSchema } from './document-schema';
import { readDocumentMeta } from './document-content';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  leaveCommunity,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import { drainOutbox } from './document-outbox';
import type { DocumentRoom } from './document-room';
import { closeSockets } from './document-room-sockets';

// The document's own daily upkeep: old changesets go.
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;

export const MAINTENANCE_KEY = 'maintenance-at';

// After a wake: the document id and anything the outbox still owes. Reads only; a document with no schema yet
// (an id nothing has written) stays without one.
export function restoreContentState(room: DocumentRoom, maintenanceAt: number | undefined): void {
  room.maintenanceAt = maintenanceAt ?? null;
  const sql = room.state.storage.sql;
  if (!sql || !hasDocumentSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  const row = sql.exec('SELECT id FROM document LIMIT 1').toArray()[0];
  if (typeof row?.id === 'string' && room.documentId === null) room.documentId = row.id;
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

// The schema on first use (document-schema.ts), and the document's row once its id is known, so the content's
// foreign keys always find it. A row made here has no dates (0): a create or a copy sets them, and the
// summary push never moves saved_at back.
export function ensureSchema(room: DocumentRoom): void {
  if (room.schemaReady && (room.documentRowReady || room.documentId === null)) return;
  const sql = room.state.storage.sql;
  if (!room.schemaReady) {
    migrateDocumentSchema((q) => sql.exec(q));
    room.schemaReady = true;
  }
  if (room.documentId !== null && !room.documentRowReady) {
    sql.exec(
      'INSERT OR IGNORE INTO document (id, saved_at, created_at) VALUES (?, 0, 0)',
      room.documentId,
    );
    room.documentRowReady = true;
  }
}

// A content write happened: push to the index and the media service on idle, at most once a minute (document-outbox.ts). Writes the drains
// themselves make go through drainEnv and never reach here.
export function noteWrite(room: DocumentRoom): void {
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

// Push what the outbox holds now. A failure keeps it and retries later.
// Push what the outbox holds now, and send what the shared tabs' holders are owed. A failure keeps it and retries
// later.
export async function drain(room: DocumentRoom): Promise<void> {
  await drainIndex(room);
  await drainShares(room);
}

// Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
export async function drainShares(room: DocumentRoom): Promise<void> {
  const env = room.drainEnv;
  const documentId = room.documentId;
  if (!env || !documentId || !room.schemaReady) {
    room.shares.clear();
    return;
  }
  const done = await room.shares.send(() =>
    documentShares.drain(env, documentId, (to, messages) =>
      documentRoom(env, to).receiveShares(documentId, messages),
    ),
  );
  if (done && done.sent > 0) console.debug('[tab-shares] sent', { documentId, sent: done.sent });
}

export async function drainIndex(room: DocumentRoom): Promise<void> {
  const env = room.drainEnv;
  const documentId = room.documentId;
  room.flushAt = null;
  if (!env || !documentId || !room.schemaReady) return;
  try {
    const { keys, pushes, more } = await drainOutbox(env, documentId);
    room.lastFlushAt = Date.now();
    if (keys > 0) console.debug('[document-outbox] pushed', { documentId, keys, pushes });
    // A big import's tabs go a batch at a time, back to back, not a minute apart.
    if (more) room.flushAt = Date.now() + FLUSH_IDLE_MS;
  } catch (error) {
    // The drain itself failed (a read, say): a push that fails is counted on its keys instead.
    console.warn('[document-outbox] push failed', { documentId, error: String(error) });
    room.flushAt = Date.now() + FLUSH_RETRY_MS;
  }
  // Anything written while the push was in flight goes next time; a key that failed, when its wait is over.
  if (room.flushAt === null)
    room.flushAt = nextOutboxFlushAt(room.state.storage.sql, Date.now(), room.lastFlushAt);
}

// The document's daily upkeep, once a day per document with content: changesets past their retention go (CS28).
export async function maintain(room: DocumentRoom, now: number): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  room.maintenanceAt = now + MAINTENANCE_EVERY_MS;
  await room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
  await keepLedger(room, now);
  if (!env || !documentId || !room.schemaReady) return;
  try {
    const gone = await deleteOldChangesets(env, now - CHANGESET_RETENTION_MS);
    if (gone > 0) console.info('[changeset] retention', { documentId, deleted: gone });
  } catch (error) {
    console.warn('[document-room] upkeep failed', { documentId, error: String(error) });
  }
}

// The ledger's share of the upkeep: an entry nobody has touched for 30 days goes (room-ledger-store.ts). It never
// stops the rest of the upkeep.
export async function keepLedger(room: DocumentRoom, now: number): Promise<void> {
  try {
    const kept = await room.ledger.upkeep({ now, seq: room.seq, tabs: storedTabIds(room) });
    if (kept.dropped > 0 || kept.stamped > 0) console.info('[ledger] upkeep', kept);
  } catch (error) {
    console.warn('[ledger] upkeep failed', { error: String(error) });
  }
}

// The ids of the tabs this room stores, or null when it can't say (no schema yet, or no tabs).
export function storedTabIds(room: DocumentRoom): ReadonlySet<string> | null {
  const sql = room.state.storage.sql;
  if (!sql || !(room.schemaReady || hasDocumentSchema((q) => sql.exec(q)))) return null;
  const ids = new Set(
    sql
      .exec<{ id: string }>('SELECT id FROM tabs')
      .toArray()
      .map((r) => r.id),
  );
  return ids.size > 0 ? ids : null;
}

// A document going for good tells the other holders of its shared tabs it left, so their copies stop counting it.
// Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
export async function leaveShares(room: DocumentRoom): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  const sql = room.state.storage.sql;
  if (!env || !documentId || !sql || !hasDocumentSchema((q) => sql.exec(q))) return;
  ensureSchema(room);
  await documentShares.leaveAll(env, documentId, (to, messages) =>
    documentRoom(env, to).receiveShares(documentId, messages),
  );
}

// Ask the index where the Community post's document stands, and send the service what changed (community-post.ts).
// A failure keeps the post and tries again at the next check.
export async function checkCommunity(room: DocumentRoom, now: number): Promise<void> {
  const documentId = room.documentId;
  room.communityAt = null;
  if (documentId === null || !room.storedSchema()) return;
  const env = room.requireEnv();
  let post: CommunityPost | null;
  try {
    post = await checkCommunityPost(env, documentId, await readDocumentMeta(env, documentId), now);
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

// The document is gone for good: end every session, then drop everything stored here, which includes the
// collaboration ledger's comment, idea and answer text, the order state and the alarm.
// The ledger's queued writes land first, so none of them can re-create a key after the wipe.
// That includes the document's content: its SQLite goes with everything else.
export async function purge(room: DocumentRoom, documentId?: string): Promise<void> {
  if (documentId !== undefined) room.bindDocument(documentId);
  closeSockets(room, () => [DOCUMENT_TRASHED_CLOSE, 'document-purged']);
  room.opLog = [];
  await leaveShares(room);
  // A document going for good takes its Community post with it: the service hears it is gone.
  if (room.documentId !== null && room.storedSchema())
    await leaveCommunity(room.requireEnv(), room.documentId);
  await room.ledger.settled();
  await disarmRoomAlarm(room.state.storage);
  await room.state.storage.deleteAll();
  room.schemaReady = false;
  room.documentRowReady = false;
  room.flushAt = null;
  room.shares.clear();
  room.maintenanceAt = null;
  room.communityAt = null;
  console.info('[room] purged');
}
