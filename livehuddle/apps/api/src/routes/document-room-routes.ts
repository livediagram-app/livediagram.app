// /api/documents/<id>/room-ticket + /ws: joining a canvas's realtime room (docs/specs/015-api/api.md "Realtime
// model"). The index's grant is the whole admission (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): the
// upgrade carries it as `?t=` (@liveworkspace/index-app's room tickets), the worker checks it offline and stamps what
// it says on the headers only it can set, and the room asks for a fresh one before it lapses (document-room.ts).

import {
  isAccountIdShape,
  type AccessLevel,
  type RoomTicketResponse,
} from '@livehuddle/api-schema';
import { openRoomTicket, roomTicketLevel, sealRoomTicket } from '@liveworkspace/index-app';
import { adderKeyFor } from '../adder-key';
import { indexService, linkCodeOf } from '../index-service';
import { COLLAB_KEY_HEADER, collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { personTagFor } from '../person-tag';
import { documentTrashed, forbidden, json, notFound } from '../responses';
import { isCommunityCode } from './community-link';
import { type RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

// A Participant's adder key (docs/specs/013-workspace/share-roles.md "Integrity"): what the room stamps on the
// stickies and text they add. Only a Participant with an identity has one; with none, they may edit, never add.
async function adderKeyOf(
  documentId: string,
  role: AccessLevel,
  person: string | null,
): Promise<string | null> {
  return role === 'participate' && person ? adderKeyFor(documentId, person) : null;
}

// Returns null when the request isn't a room route.
export async function handleDocumentRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // POST /api/documents/<id>/room-ticket: the ticket for the grant the request carries (the editor's) or one
  // fetched for the caller (an API token's script), and the caller's own adder key, so their
  // editor knows which stickies are theirs to delete. It says nothing about anybody else.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    const grant = await resolveDocumentGrant(ctx, id);
    if (grant instanceof Response) return grant;
    if (!grant) return notFound();
    if (grant.trashed) return documentTrashed();
    if (await isCommunityCode(env, id, grant.shareCode)) return forbidden('community_link');
    const ticket = await sealRoomTicket(env, grant.token, null);
    const person = linkCodeOf(grant.sub) ? null : grant.sub;
    const adderKey = await adderKeyOf(id, grant.level, person);
    const answer: RoomTicketResponse = adderKey ? { ticket, adderKey } : { ticket };
    return json(answer);
  }

  if (segments.length === 4 && segments[3] === 'ws' && request.method === 'GET') {
    const id = segments[2]!;
    const opened = await openRoomTicket(indexService, env, url.searchParams.get('t'), id);
    if (!opened) return forbidden();
    const { claims } = opened;
    if (claims.trashed) return documentTrashed();
    const role: AccessLevel = roomTicketLevel(opened);
    const linkCode = linkCodeOf(claims.sub);
    const person = linkCode ? null : claims.sub;
    // The share code a session came in by, so revoking it closes exactly its sockets: a link visitor's grant
    // names it; a person who opened a link says so on `?s=` (it only ever closes, so it needs no proof).
    const shareCode = linkCode ?? (url.searchParams.get('s')?.slice(0, 64) || null);
    if (linkCode && (await isCommunityCode(env, id, linkCode))) return forbidden('community_link');
    const forwarded = new Request(request);
    // Every trust header is stamped UNCONDITIONALLY: `new Request` copies the client's own headers, and the room
    // believes whatever arrives under these names (room-session.ts).
    forwarded.headers.set('X-Verified-Role', role);
    // Whether this session is the canvas's OWNER (docs/specs/012-collaboration/facilitator.md): the facilitator
    // baton needs it so the owner can always take the session back. A bit, never an id.
    forwarded.headers.set(
      'X-Verified-Owner',
      person !== null && !!claims.owner && person === claims.owner ? '1' : '0',
    );
    forwarded.headers.set('X-Verified-Tab-Scope', claims.tab ?? '');
    forwarded.headers.set('X-Verified-Share-Code', shareCode ?? '');
    // The person tag (docs/specs/024-agents/agent-changesets.md, CS39): how the room tells one person's sessions
    // from everyone else's without holding their id. Empty = none.
    forwarded.headers.set('X-Verified-Person', person ? await personTagFor(id, person) : '');
    // The session's collab key (docs/specs/013-workspace/share-roles.md "The collab key"): derived from the person,
    // never read from the request. Empty for a link visitor: the room mints one for that socket.
    forwarded.headers.set(COLLAB_KEY_HEADER, person ? await collabKeyFor(person) : '');
    // Whether a verified account holds this session (not a guest, a link visitor or an API token's script, which
    // reaches the room as its account but draws no avatars): only such a session may publish a Google picture
    // and be sent others' (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"). Set on every path, like the rest.
    forwarded.headers.set('X-Verified-Account', person && isAccountIdShape(person) ? '1' : '0');
    forwarded.headers.set('X-Verified-Adder', (await adderKeyOf(id, role, person)) ?? '');
    forwarded.headers.set('X-Verified-Document', id);
    // When the grant lapses (epoch seconds): the room asks for a fresh one before then, and drops the socket
    // after (document-room.ts).
    forwarded.headers.set('X-Verified-Grant-Exp', String(claims.exp));
    // The canvas's owner and team as the index has them now: the room keeps its copy from these.
    forwarded.headers.set('X-Verified-Item-Owner', claims.owner ?? '');
    forwarded.headers.set('X-Verified-Item-Team', claims.team ?? '');
    const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(id));
    return stub.fetch(forwarded);
  }

  return null;
}
