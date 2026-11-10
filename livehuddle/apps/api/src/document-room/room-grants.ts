import {
  earliestRoomGrantDue,
  openRoomSockets,
  renewRoomGrant,
  roomGrantStep,
} from '@liveworkspace/index-app';
import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_GRANT_ASK_BEFORE_MS,
} from '@livehuddle/api-schema';
import { indexService } from '../index-service';
import { answerInternal } from '../room-internal';
import { verifiedSessionOf, type SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';

// The room's doors and its sessions' grants (document-room.ts): the WebSocket upgrade, and each session's grant
// asked for, renewed or lapsed. Each function takes the room it acts for.

// The room's own doors: its internal endpoints (room-internal.ts) and the WebSocket upgrade. Takes what a
// stub's fetch takes, so the worker's relays (room-client.ts) call it the same way here as through a stub.
export async function roomFetch(
  room: DocumentRoom,
  input: Request | string,
  init?: RequestInit,
): Promise<Response> {
  const request = typeof input === 'string' || init ? new Request(input, init) : input;
  const url = new URL(request.url);
  const internal = await answerInternal(room.internal, request, url);
  if (internal) return internal;
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  const pair = new WebSocketPair();
  // WebSocketPair is a 2-property record keyed `0`/`1`. The "client"
  // side is returned to the connecting peer; the "server" side is
  // owned by this Durable Object.
  const client = pair[0];
  const server = pair[1];
  // A full room answers the upgrade and closes it at once (docs/specs/015-api/api.md "A room holds at most
  // 100 connections"): the close code is the only thing a browser can read, an HTTP refusal reads as 1006.
  if (room.turnAwayIfFull(server)) return new Response(null, { status: 101, webSocket: client });
  // Server-resolved facts (set by the api worker before forwarding the upgrade): room-session.ts.
  const v = verifiedSessionOf(request);
  room.acceptSession(
    server,
    v.verifiedRole,
    v.isOwner,
    v.tabScope,
    v.shareCode,
    v.personTag,
    v.adderKey,
    v.documentId,
    v.grantExp ?? null,
    v.collabKey ?? null,
    v.reactionPerson ?? null,
  );
  if (v.documentId) {
    room.bindDocument(v.documentId);
    if (v.head) await room.takeHead(v.head);
  }
  room.armAlarm();
  return new Response(null, { status: 101, webSocket: client });
}

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
      room.closeSockets((each) => (each === ws ? [GRANT_LAPSED_CLOSE, 'grant-lapsed'] : null));
      lapsed++;
    } else if (step === 'ask' && s?.grantExp) {
      room.sendTo(ws, { kind: 'grant-renew', expiresAt: s.grantExp });
      try {
        ws.serializeAttachment({ ...s, renewAsked: true } satisfies SessionAttachment);
      } catch {
        // The socket is going; its lapse closes it.
      }
    }
  }
  if (lapsed > 0) console.info('[grant] sessions lapsed', { closed: lapsed });
}

// A session's fresh grant (the `grant` frame): the same canvas, level and tab move its lapse on. One that says
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
    room.closeSockets((each) => (each === ws ? [ACCESS_CHANGED_CLOSE, 'access-changed'] : null));
    return;
  }
  // A fresh grant on a canvas since moved to the Trash ends the session, as the trashing itself does.
  if (renewal.claims.trashed) {
    room.closeSockets((each) =>
      each === ws ? [DOCUMENT_TRASHED_CLOSE, 'document-trashed'] : null,
    );
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
