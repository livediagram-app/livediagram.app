// The room's own doors (its `fetch`): its internal endpoints (room-internal.ts) and the WebSocket upgrade. Takes
// what a stub's fetch takes, so the worker's relays (room-client.ts) call it the same way here as through a stub.
import { notFound } from '../responses';
import { answerInternal, type InternalRoom } from '../room-internal';
import { verifiedSessionOf } from '../room-session';
import { scopedTabShowsAll } from './plan-room-grants';
import { purgedAt } from './plan-room-purged';
import type { PlanRoom } from './plan-room';

export async function roomFetch(
  room: PlanRoom,
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
  // Server-resolved facts (set by the api worker before forwarding the upgrade): room-session.ts.
  const v = verifiedSessionOf(request);
  if (v.projectId) {
    room.bindPlan(v.projectId);
    // A purged plan takes no session (plan-room-purged.ts): its link answers as missing.
    if ((await purgedAt(room)) !== null) return notFound();
    if (v.head) await room.takeHead(v.head);
  }
  const pair = new WebSocketPair();
  // WebSocketPair is a 2-property record keyed `0`/`1`. The "client" side is returned to the connecting peer; the
  // "server" side is owned by this Durable Object.
  const client = pair[0];
  const server = pair[1];
  const tabShowsAll = await scopedTabShowsAll(room, v.projectId, v.tabScope);
  room.acceptSession(
    server,
    v.verifiedRole,
    v.tabScope,
    v.shareCode,
    v.personTag,
    v.workbenchPairing,
    v.adderKey,
    v.projectId,
    v.grantExp ?? null,
    v.account,
    tabShowsAll,
    v.collabKey ?? null,
    v.reactionPerson ?? null,
    v.apiToken ?? null,
  );
  room.armAlarm();
  return new Response(null, { status: 101, webSocket: client });
}
