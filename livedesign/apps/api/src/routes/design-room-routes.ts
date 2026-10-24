// /api/designs/<id>/room-ticket + /ws: joining a design's realtime room (docs/specs/015-api/api.md "Realtime
// model"). The index's grant is the whole admission (liveworkspace/docs/one-explorer-contracts.md "Grants"): the
// upgrade carries it as `?t=` (room-ticket.ts), the worker checks it offline and stamps what it says on the
// headers only it can set, and the room asks for a fresh one before it lapses (design-room.ts).

import {
  capWorkbenchRole,
  type AccessLevel,
  type RoomTicketResponse,
} from '@livedesign/api-schema';
import { adderKeyFor } from '../adder-key';
import { workbenchStore } from '../workbench-store';
import { linkCodeOf, indexService } from '../index-service';
import { forbidden, json, notFound } from '../responses';
import { openRoomTicket, sealRoomTicket } from '@liveworkspace/index-app';
import { type RouteContext } from './context';
import { resolveDesignGrant } from './design-grant';
import { personTagFor } from '../person-tag';

// Returns null when the request isn't a room route.
export async function handleDesignRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // POST /api/designs/<id>/room-ticket: the ticket for a caller that holds no grant of its own (an API token's
  // CLI, a workbench session) or wants its adder key: the grant the request carries or one fetched for it.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    const grant = await resolveDesignGrant(ctx, id);
    if (grant instanceof Response) return grant;
    if (!grant) return notFound();
    const workbench = ctx.workbench ?? null;
    const role = workbench ? capWorkbenchRole(grant.level, workbench.level) : grant.level;
    const ticket = await sealRoomTicket(
      env,
      grant.token,
      workbench ? { pairing: workbench.pairingId, cap: workbench.level } : null,
    );
    // A workspace session joins many rooms; each is recorded so ending its access closes them all (WB55).
    if (workbench?.scope === 'workspace')
      await workbenchStore(env, workbench.ownerId).noteSessionRoom(workbench.sessionId, id);
    // A Participant's adder key (docs/specs/013-workspace/share-roles.md "Integrity"): what the room stamps on the
    // stickies and text it adds, so its editor knows which are its own.
    const person = linkCodeOf(grant.sub) ? null : grant.sub;
    const adderKey = role === 'participate' && person ? await adderKeyFor(id, person) : null;
    const answer: RoomTicketResponse = adderKey ? { ticket, adderKey } : { ticket };
    return json(answer);
  }

  if (segments.length === 4 && segments[3] === 'ws' && request.method === 'GET') {
    const id = segments[2]!;
    const opened = await openRoomTicket(indexService, env, url.searchParams.get('t'), id);
    if (!opened) return forbidden();
    const { claims, workbench } = opened;
    const role: AccessLevel = workbench
      ? capWorkbenchRole(claims.level, workbench.cap)
      : claims.level;
    const person = linkCodeOf(claims.sub) ? null : claims.sub;
    // The share code a session came in by, so revoking it closes exactly its sockets: a link visitor's grant
    // names it; a person who opened a link says so on `?s=` (it only ever closes, so it needs no proof).
    const shareCode = linkCodeOf(claims.sub) ?? (url.searchParams.get('s')?.slice(0, 64) || null);
    const forwarded = new Request(request);
    // Every trust header is stamped UNCONDITIONALLY: `new Request` copies the client's own headers, and the room
    // believes whatever arrives under these names (room-session.ts).
    forwarded.headers.set('X-Verified-Role', role);
    forwarded.headers.set('X-Verified-Tab-Scope', claims.tab ?? '');
    forwarded.headers.set('X-Verified-Share-Code', shareCode ?? '');
    forwarded.headers.set('X-Verified-Person', person ? await personTagFor(id, person) : '');
    forwarded.headers.set('X-Verified-Workbench-Pairing', workbench?.pairing ?? '');
    forwarded.headers.set(
      'X-Verified-Adder',
      role === 'participate' && person ? await adderKeyFor(id, person) : '',
    );
    forwarded.headers.set('X-Verified-Design', id);
    // When the grant lapses (epoch seconds): the room asks for a fresh one before then, and drops the socket
    // after (design-room.ts).
    forwarded.headers.set('X-Verified-Grant-Exp', String(claims.exp));
    // The design's owner and team as the index has them now: the room keeps its copy in line
    // (@liveworkspace/index-app item-head.ts).
    forwarded.headers.set('X-Verified-Owner', claims.owner ?? '');
    forwarded.headers.set('X-Verified-Team', claims.team ?? '');
    const stub = env.DESIGN_ROOM.get(env.DESIGN_ROOM.idFromName(id));
    return stub.fetch(forwarded);
  }

  return null;
}
