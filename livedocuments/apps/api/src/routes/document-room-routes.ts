// /api/documents/<id>/room-ticket + /ws: joining a document's realtime room (docs/specs/015-api/api.md "Realtime
// model"). The index's grant is the whole admission (liveworkspace/docs/one-explorer-contracts.md "Grants"): the
// upgrade carries it as `?t=` (@liveworkspace/index-app's room tickets), the worker checks it offline and stamps what it says on the
// headers only it can set, and the room asks for a fresh one before it lapses (document-room.ts).

import { type AccessLevel, type RoomTicketResponse } from '@livedocuments/api-schema';
import { noteWorkbenchRoom } from '../auth/workbench-session';
import { indexService, linkCodeOf } from '../index-service';
import { forbidden, json, notFound } from '../responses';
import { openRoomTicket, roomTicketLevel, sealRoomTicket } from '@liveworkspace/index-app';
import { type RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';
import { personTagFor } from '../person-tag';
import { isAccountOwner } from '../person/owner';

// Returns null when the request isn't a room route.
export async function handleDocumentRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // POST /api/documents/<id>/room-ticket: the ticket for a caller that holds no grant of its own (an API token's
  // CLI, a workbench session): the grant the request carries or one fetched for it.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    const grant = await resolveDocumentGrant(ctx, id);
    if (grant instanceof Response) return grant;
    if (!grant) return notFound();
    const workbench = ctx.workbench ?? null;
    const ticket = await sealRoomTicket(
      env,
      grant.token,
      workbench ? { pairing: workbench.pairingId, cap: workbench.level } : null,
    );
    // A workspace session joins many rooms; each is recorded at liveworkspace, off the response's path, so ending
    // its access closes them all (WB55).
    if (workbench?.scope === 'workspace') {
      const noted = noteWorkbenchRoom(env, workbench, id);
      if (ctx.waitUntil) ctx.waitUntil(noted);
      else await noted;
    }
    const answer: RoomTicketResponse = { ticket };
    return json(answer);
  }

  if (segments.length === 4 && segments[3] === 'ws' && request.method === 'GET') {
    const id = segments[2]!;
    const opened = await openRoomTicket(indexService, env, url.searchParams.get('t'), id);
    if (!opened) return forbidden();
    const { claims, workbench } = opened;
    const role: AccessLevel = roomTicketLevel(opened);
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
    // Whether a signed-in account holds the session (not a guest, not a link visitor): only such a session may show
    // a Google picture in the room and see others' (docs/specs/014-identity/profile-picture.md §2).
    forwarded.headers.set('X-Verified-Account', person && isAccountOwner(person) ? '1' : '0');
    forwarded.headers.set('X-Verified-Workbench-Pairing', workbench?.pairing ?? '');
    forwarded.headers.set('X-Verified-Document', id);
    // When the grant lapses (epoch seconds): the room asks for a fresh one before then, and drops the socket
    // after (document-room.ts).
    forwarded.headers.set('X-Verified-Grant-Exp', String(claims.exp));
    // The document's owner and team as the index has them now: the room keeps its copy in line
    // (@liveworkspace/index-app item-head.ts).
    forwarded.headers.set('X-Verified-Owner', claims.owner ?? '');
    forwarded.headers.set('X-Verified-Team', claims.team ?? '');
    const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(id));
    return stub.fetch(forwarded);
  }

  return null;
}
