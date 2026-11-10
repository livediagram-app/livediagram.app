import {
  createItemHeadSync,
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  flushAfterWrite,
  type ItemHeadSync,
  nextOutboxFlushAt,
  outboxDueAt,
} from '@liveworkspace/index-app';
import { CHANGESET_RETENTION_MS } from '@livediagram/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { documentRoom } from '../document-client';
import { COMMUNITY_CHECK_MS as COMMUNITY_CHECK_EVERY_MS } from './community-post';
import { drainOutbox } from './document-outbox';
import { hasDocumentSchema, migrateDocumentSchema } from './document-schema';
import { documentShares } from './tab-shares';
import type { DocumentRoom } from './document-room';

// The document room's content state (document-room.ts): its schema and row, the outbox's and the shared tabs'
// schedules, and the daily upkeep. Each function takes the room it acts for.

// The document's own daily upkeep: old changesets go. An empty canvas is moved to the Trash by the index's daily
// empty clean-up, from the summary's `hasContent` (docs/specs/013-workspace/empty-document-cleanup.md).
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;
export const MAINTENANCE_KEY = 'maintenance-at';

// The room's `head`: the canvas's owner and team as its own row holds them, read and written as a grant names them.
export function roomHeadSync(room: DocumentRoom): ItemHeadSync {
  const state = room.state;
  return createItemHeadSync({
    read: async () => {
      if (room.documentId === null || !room.hasSchema()) return null;
      room.ensureSchema();
      const row = state.storage.sql
        .exec<{ owner_id: string; team_id: string | null }>(
          'SELECT owner_id, team_id FROM document WHERE id = ? AND created_at > 0',
          room.documentId,
        )
        .toArray()[0];
      return row ? { ownerId: row.owner_id, teamId: row.team_id ?? null } : null;
    },
    write: async (h) => {
      state.storage.sql.exec(
        'UPDATE document SET owner_id = ?, team_id = ? WHERE id = ?',
        h.ownerId,
        h.teamId,
        room.documentId,
      );
      console.info('[room] owner or team taken from the grant', { team: h.teamId !== null });
      // The summary push names the owner; a team change can open or close a Community post.
      state.storage.sql.exec(
        "INSERT OR IGNORE INTO outbox (document_id, kind, key) VALUES (?, 'summary', '')",
        room.documentId,
      );
      room.noteWrite();
      if (room.communityAt !== null) room.communityAt = Date.now();
    },
  });
}

// After a wake: the document id, anything the outbox still owes, and its Community post's next check. Reads only;
// a document with no schema yet (an id nothing has written) stays without one.
export function restoreContentState(room: DocumentRoom, maintenanceAt: number | undefined): void {
  room.maintenanceAt = maintenanceAt ?? null;
  const sql = room.state.storage.sql;
  if (!sql || !hasDocumentSchema((q) => sql.exec(q))) return;
  room.ensureSchema();
  const row = sql.exec('SELECT id FROM document LIMIT 1').toArray()[0];
  if (typeof row?.id === 'string' && room.documentId === null) room.documentId = row.id;
  // Anything owed goes now, or when its wait after a failure is over (index-app outbox.ts).
  const due = outboxDueAt(sql);
  if (due !== null) room.flushAt = Math.max(Date.now(), due);
  room.shares.restore();
  const post = sql
    .exec<{ checked_at: number }>('SELECT checked_at FROM community_post LIMIT 1')
    .toArray()[0];
  room.communityAt = post ? post.checked_at + COMMUNITY_CHECK_EVERY_MS : null;
}

// A tab's stored name, or null when the store holds no such tab (or no document yet). One primary-key read.
export function storedTabName(room: DocumentRoom, tabId: string): string | null {
  const sql = room.state.storage.sql;
  if (!sql || !room.hasSchema()) return null;
  const row = sql.exec<{ name: string }>('SELECT name FROM tabs WHERE id = ?', tabId).toArray()[0];
  return typeof row?.name === 'string' ? row.name : null;
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

// A content write happened: push to the index and the media service on idle, at most once a minute
// (document-outbox.ts), and send a shared tab's holders their copy on idle. Writes the drain itself makes (its
// outbox delete) schedule nothing.
export function noteWrite(room: DocumentRoom): void {
  if (room.draining) return;
  room.writes++;
  if (room.maintenanceAt === null) {
    room.maintenanceAt = Date.now() + MAINTENANCE_EVERY_MS;
    void room.state.storage.put(MAINTENANCE_KEY, room.maintenanceAt);
    room.armAlarm();
  }
  const now = Date.now();
  if (room.shares.noteWrite()) room.armAlarm();
  // A drain set far off, for a key in backoff, gives way to the key just written.
  const at = flushAfterWrite(room.state.storage.sql, room.flushAt, now, room.lastFlushAt);
  if (at === null) return;
  room.flushAt = at;
  room.armAlarm();
}

export async function drainIndex(room: DocumentRoom): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  room.flushAt = null;
  if (!env || !documentId || !room.schemaReady) return;
  room.draining = true;
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
  } finally {
    room.draining = false;
  }
  // Anything written while the push was in flight goes next time; a key that failed, when its wait is over.
  if (room.flushAt === null) room.flushAt = indexFlushAt(room);
}

// Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
export async function drainShares(room: DocumentRoom): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  if (!env || !documentId || !room.schemaReady) {
    room.shares.clear();
    return;
  }
  room.draining = true;
  try {
    const done = await room.shares.send(() =>
      documentShares.drain(env, documentId, (to, messages) =>
        documentRoom(env, to).receiveShares(documentId, messages),
      ),
    );
    if (done && done.sent > 0) console.debug('[tab-shares] sent', { documentId, sent: done.sent });
  } finally {
    room.draining = false;
  }
  if (room.flushAt === null) room.flushAt = indexFlushAt(room);
}

// When the outbox next drains, or null when it owes nothing (index-app outbox.ts nextOutboxFlushAt).
function indexFlushAt(room: DocumentRoom): number | null {
  return nextOutboxFlushAt(room.state.storage.sql, Date.now(), room.lastFlushAt);
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
async function keepLedger(room: DocumentRoom, now: number): Promise<void> {
  try {
    const kept = await room.ledger.upkeep({ now, seq: room.seq, tabs: storedTabIds(room) });
    if (kept.dropped > 0 || kept.stamped > 0) console.info('[ledger] upkeep', kept);
  } catch (error) {
    console.warn('[ledger] upkeep failed', { error: String(error) });
  }
}

// The ids of the tabs this room stores, or null when it can't say (no schema yet, or no tabs).
function storedTabIds(room: DocumentRoom): ReadonlySet<string> | null {
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

// This env's DOCUMENT_ROOM, answering this document's own id with this object: the code shared with the worker (a
// document read's outline, the room relays) then calls straight in rather than through a stub.
export function localNamespace(
  room: DocumentRoom,
  real: DurableObjectNamespace<DocumentRoom> | undefined,
): DurableObjectNamespace<DocumentRoom> {
  const ns = (real ?? {}) as DurableObjectNamespace<DocumentRoom>;
  return new Proxy(ns, {
    get: (target, prop, receiver) => {
      if (prop === 'get') {
        return (id: DurableObjectId, opts?: DurableObjectNamespaceGetDurableObjectOptions) =>
          id.equals(room.state.id) ? room : target.get(id, opts);
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
