// The room's own doors (its `fetch`): its internal endpoints (room-internal.ts) and the WebSocket upgrade. Takes
// what a stub's fetch takes, so the worker's relays (room-client.ts) call it the same way here as through a stub.
import { tokenRoomRole } from '../knowledge/agent-grants';
import { answerInternal, type InternalRoom } from '../room-internal';
import { verifiedSessionOf } from '../room-session';
import type { DocumentRoom } from './document-room';

export async function roomFetch(
  room: DocumentRoom,
  doors: InternalRoom,
  input: Request | string,
  init?: RequestInit,
): Promise<Response> {
  const request = typeof input === 'string' || init ? new Request(input, init) : input;
  const url = new URL(request.url);
  const internal = await answerInternal(doors, request, url);
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
  // Server-resolved facts (set by the api worker before forwarding the upgrade): room-session.ts.
  const v = verifiedSessionOf(request);
  // A token's socket writes only with `write` granted here (knowledge/agent-grants.ts tokenRoomRole).
  const role = room.roomEnv
    ? await tokenRoomRole(room.roomEnv, v.verifiedRole, v.apiToken)
    : v.apiToken
      ? 'view'
      : v.verifiedRole;
  room.acceptSession(
    server,
    role,
    v.tabScope,
    v.shareCode,
    v.personTag,
    v.workbenchPairing,
    v.documentId,
    v.grantExp ?? null,
    v.account === true,
    v.collabKey ?? null,
    v.reactionPerson ?? null,
    v.apiToken ?? null,
  );
  if (v.documentId) {
    room.bindDocument(v.documentId);
    if (v.head) await room.takeHead(v.head);
  }
  room.armAlarm();
  return new Response(null, { status: 101, webSocket: client });
}
