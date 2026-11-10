import { DOCUMENT_TRASHED_CLOSE } from '@livehuddle/api-schema';
import { agentPresenceLog } from '@liveworkspace/api-kit/room-agent-presence';
import { armRoomAlarm, disarmRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import { documentRoom } from '../document-client';
import { hasDocumentSchema } from './document-schema';
import { drainIndex, drainShares, maintain } from './room-content-state';
import { checkCommunity, leaveCommunity } from './room-community';
import { checkGrants, nextGrantDue } from './room-grants';
import { closeSockets } from './room-sockets';
import { documentShares } from './tab-shares';
import type { DocumentRoom } from './document-room';

// The room's alarm and its end (document-room.ts): what is due when, and the purge that drops it all. Each function
// takes the room it acts for.

// The document is gone for good: end every session, then drop everything stored here, which includes the
// collaboration ledger's comment text and dots, the order state, the baton and the alarm.
// The ledger's queued writes land first, so none of them can re-create a key after the wipe.
// That includes the document's content: its SQLite goes with everything else.
export async function purge(room: DocumentRoom, documentId?: string): Promise<void> {
  if (documentId !== undefined) room.bindDocument(documentId);
  closeSockets(room, () => [DOCUMENT_TRASHED_CLOSE, 'document-purged']);
  room.opLog = [];
  await leaveShares(room);
  await leaveCommunity(room);
  await room.ledger.settled();
  await disarmRoomAlarm(room.state.storage);
  await room.state.storage.deleteAll();
  room.schemaReady = false;
  room.documentRowReady = false;
  room.flushAt = null;
  room.shares.clear();
  room.maintenanceAt = null;
  room.communityAt = null;
  room.head.forget();
  console.info('[room] purged');
}

// A document going for good tells the other holders of its shared tabs it left, so their copies stop counting
// it. Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
async function leaveShares(room: DocumentRoom): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  const sql = room.state.storage.sql;
  if (!env || !documentId || !sql || !hasDocumentSchema((q) => sql.exec(q))) return;
  room.ensureSchema();
  await documentShares.leaveAll(env, documentId, (to, messages) =>
    documentRoom(env, to).receiveShares(documentId, messages),
  );
}

// The room's one alarm, at the earliest of: the facilitator grace deadline, an agent presence expiry
// (agent-presence I5, PR29), a session's grant to ask for or lapse, the outbox's next push, the next send to a
// shared tab's holders, the Community post's next check, the document's next upkeep. None when nothing is due.
export function armAlarm(room: DocumentRoom): void {
  const due = [
    room.baton.deadline() ?? null,
    room.agents.nextExpiry(),
    nextGrantDue(room),
    room.flushAt,
    room.shares.at,
    room.communityAt,
    room.maintenanceAt,
  ];
  // Never sooner than a second from now, and no write when it already stands there (api-kit room-alarm.ts).
  armRoomAlarm(room.state.storage, due, Date.now());
}

/**
 * Agent entries past their expiry go; then the grace clock ran out (or did not, if they came back); the outbox
 * pushes and the upkeep runs when due. Safe to call early.
 */
export async function alarm(room: DocumentRoom): Promise<void> {
  const expired = await room.agents.sweep();
  for (const r of expired) agentPresenceLog('expired', r);
  if (expired.length > 0) room.broadcastPresence();
  room.baton.alarm();
  const now = Date.now();
  checkGrants(room, now);
  if (room.flushAt !== null && room.flushAt <= now) await drainIndex(room);
  // A shared tab written while the push was in flight (its write armed nothing then).
  room.shares.noteWrite();
  if (room.shares.due(now)) await drainShares(room);
  if (room.communityAt !== null && room.communityAt <= now) await checkCommunity(room, now);
  if (room.maintenanceAt !== null && room.maintenanceAt <= now) await maintain(room, now);
  armAlarm(room);
}
