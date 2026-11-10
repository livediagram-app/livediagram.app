// A session's grant on the room (document-room.ts): admitting a socket, asking for a fresh grant before the old one
// lapses, closing the lapsed, and taking a renewal. Each takes the room.
import {
  earliestRoomGrantDue,
  openRoomSockets,
  renewRoomGrant,
  roomGrantStep,
} from '@liveworkspace/index-app';
import { indexService } from '../index-service';
import {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_FULL_CLOSE,
  ROOM_FULL_REASON,
  ROOM_GRANT_ASK_BEFORE_MS,
  roomIsFull,
  type AccessLevel,
} from '@livedocuments/api-schema';
import { newSessionAttachment, type SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';
import { closeSockets, sendTo } from './document-room-sockets';

// ---------- Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants") ---------------------------------
//
// Every session joined with the index's grant, which lapses after ten minutes. ROOM_GRANT_ASK_BEFORE_MS before
// it does, the room asks the session for a fresh one (`grant-renew`); the session answers with a `grant` frame
// (its editor renews a minute early anyway, and sends each new grant unasked). A session still holding a
// lapsed grant is closed with GRANT_LAPSED_CLOSE, and its editor rejoins with a fresh one, or not at all. The
// decisions are @liveworkspace/index-app's (room-ticket.ts).

export function nextGrantDue(room: DocumentRoom): number | null {
  return earliestRoomGrantDue(
    openRoomSockets(room.state.getWebSockets()).map((ws) => room.readSession(ws)),
    ROOM_GRANT_ASK_BEFORE_MS,
  );
}

// Ask the sessions whose grant is about to lapse, and close those whose grant has.
export function checkGrants(room: DocumentRoom, now: number): void {
  let lapsed = 0;
  for (const ws of openRoomSockets(room.state.getWebSockets())) {
    const s = room.readSession(ws);
    const step = roomGrantStep(s, now, ROOM_GRANT_ASK_BEFORE_MS);
    if (step === 'lapsed') {
      try {
        ws.close(GRANT_LAPSED_CLOSE, 'grant-lapsed');
      } catch {
        // Already gone.
      }
      room.opRates.delete(ws);
      lapsed++;
    } else if (step === 'ask' && s?.grantExp) {
      sendTo(room, ws, { kind: 'grant-renew', expiresAt: s.grantExp });
      try {
        ws.serializeAttachment({ ...s, renewAsked: true } satisfies SessionAttachment);
      } catch {
        // The socket is going; its lapse closes it.
      }
    }
  }
  if (lapsed > 0) console.info('[grant] sessions lapsed', { closed: lapsed });
}

// A session's fresh grant (the `grant` frame): the same document, level and tab move its lapse on. One that says
// something else (a level changed, a tab rescoped) ends the session, and the editor rejoins with what it holds
// now. A grant that does not check is ignored; the old one still lapses.
export async function renewGrant(
  room: DocumentRoom,
  ws: WebSocket,
  ticket: unknown,
): Promise<void> {
  const env = room.roomEnv;
  const session = room.readSession(ws);
  if (!env || !session?.documentId) return;
  const renewal = await renewRoomGrant(indexService, env, ticket, session.documentId, {
    level: session.verifiedRole,
    tab: session.tabScope,
    pairing: session.workbenchPairing ?? null,
  });
  if (renewal.kind === 'invalid') {
    console.warn('[grant] renewal refused', { reason: 'invalid' });
    return;
  }
  if (renewal.kind === 'changed') {
    console.info('[grant] renewal changed access', {
      from: session.verifiedRole,
      to: renewal.level,
    });
    closeSockets(room, (each) => (each === ws ? [ACCESS_CHANGED_CLOSE, 'access-changed'] : null));
    return;
  }
  await room.takeHead(renewal.claims);
  const current = room.readSession(ws);
  if (!current) return;
  try {
    ws.serializeAttachment({
      ...current,
      grantExp: renewal.grantExp,
      renewAsked: false,
    } satisfies SessionAttachment);
  } catch {
    return;
  }
  room.armAlarm();
}

// Admit one server-side socket into the room: pin its hibernation-proof
// session state (attachment) and hand it to the runtime. Split out of
// fetch so tests can drive sessions without constructing WebSocketPair.
export function acceptSession(
  room: DocumentRoom,
  ws: WebSocket,
  verifiedRole?: AccessLevel,
  tabScope: string | null = null,
  shareCode: string | null = null,
  personTag: string | null = null,
  workbenchPairing: string | null = null,
  documentId: string | null = null,
  grantExp: number | null = null,
  // A signed-in account's session (room-session.ts `account`): it may show a Google picture and see others'.
  account = false,
): void {
  // The room's size (docs/specs/015-api/api.md "Room size"): past ROOM_MAX_CONNECTIONS the socket is accepted
  // only to be closed with ROOM_FULL_CLOSE, which a browser can read where a refused upgrade says nothing. A
  // plain accept, not the hibernation one: the socket never joins, so the room never hears from it again.
  const connections = room.state.getWebSockets().length;
  if (roomIsFull(connections)) {
    console.info('[room] full', { connections });
    ws.accept();
    ws.close(ROOM_FULL_CLOSE, ROOM_FULL_REASON);
    return;
  }
  ws.serializeAttachment(
    newSessionAttachment(
      {
        verifiedRole,
        tabScope,
        shareCode,
        personTag,
        workbenchPairing,
        documentId,
        grantExp,
        account,
      },
      crypto.randomUUID(),
    ),
  );
  // Hibernation-aware accept: the runtime owns the socket's event
  // delivery (webSocketMessage / webSocketClose / webSocketError) and
  // may evict this DO between events. NOT ws.accept(), which would pin
  // the DO in memory for the socket's whole life.
  room.state.acceptWebSocket(ws);
}
