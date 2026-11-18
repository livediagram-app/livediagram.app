// /api/projects/<id>/room-ticket + /ws: joining a plan's realtime room (docs/specs/015-api/api.md "Realtime
// model"). The index's grant is the whole admission (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): the
// upgrade carries it as `?t=` (room-ticket.ts), the worker checks it offline and stamps what it says on the
// headers only it can set, and the room asks for a fresh one before it lapses (plan-room.ts).

import {
  capWorkbenchRole,
  type AccessLevel,
  type RoomTicketResponse,
} from '@liveplanner/api-schema';
import { adderKeyFor } from '../adder-key';
import { noteTokenRoom, noteWorkbenchRoom } from '../auth/workbench-session';
import { linkCodeOf, indexService } from '../index-service';
import { badRequest, forbidden, json, notFound } from '../responses';
import {
  openRoomTicket,
  requestedRoomCap,
  roomTicketLevel,
  sealRoomTicket,
} from '@liveworkspace/index-app';
import { type RouteContext } from './context';
import { resolvePlanGrant } from './plan-grant';
import {
  COLLAB_KEY_HEADER,
  collabKeyFor,
  REACTION_PERSON_HEADER,
  reactionPersonFor,
} from '@liveworkspace/api-kit/collab-key';
import { personTagFor } from '../person-tag';
import { isAccountId } from '@liveworkspace/auth-client';
import { planRoom } from '../plan-client';
import type { Env } from '../types';

// A Community visitor never joins the author's room (docs/specs/025-community/community.md "Viewing a post's
// plan"): no presence, no cursors, no live stream. The code the access came through is checked against the plan's
// post.
async function isCommunityCode(env: Env, planId: string, code: string | null): Promise<boolean> {
  if (!code) return false;
  const post = await planRoom(env, planId).community();
  return post !== null && post.code === code;
}

// Returns null when the request isn't a room route.
export async function handleProjectRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // POST /api/projects/<id>/room-ticket: the ticket for a caller that holds no grant of its own (an API token's
  // CLI, a workbench session, the MCP server's interactive view) or wants its adder key: the grant the request carries or one fetched for it.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    // `?cap=view` (api.md): a view-only ticket, the MCP view's (mcp-server.md "Live updates").
    const cap = requestedRoomCap(url);
    if (cap === 'invalid') return badRequest('invalid_cap');
    const grant = await resolvePlanGrant(ctx, id);
    if (grant instanceof Response) return grant;
    if (!grant) return notFound();
    if (await isCommunityCode(env, id, grant.shareCode)) return forbidden('community_link');
    const workbench = ctx.workbench ?? null;
    // The caller's own level, and the level the ticket admits at: view for a view-only ticket.
    const own = workbench ? capWorkbenchRole(grant.level, workbench.level) : grant.level;
    const role = cap ?? own;
    // The API token minting it (an MCP server's live view, a CLI), outside a workbench session (whose pairing closes
    // with its token already): sealed into the ticket, so revoking the token closes the sockets it opens.
    const token = workbench ? null : (ctx.token?.id ?? null);
    // A workbench session is sealed to its pairing at its own cap (held to view when it asks for a view-only
    // ticket); a view-only ticket otherwise is the grant sealed with the cap alone, so its holder never has the
    // grant bare; a token's ticket carries the token, with the cap it asked for or none.
    const ticket = await sealRoomTicket(
      env,
      grant.token,
      workbench
        ? { pairing: workbench.pairingId, cap: cap ?? workbench.level }
        : cap || token
          ? { pairing: null, cap, token }
          : null,
    );
    // ...and liveworkspace notes the room against the token until the ticket's grant lapses, which is how a revoke
    // finds the rooms to close without asking every plan (public-api-and-tokens.md "Revoking a token").
    const owner = token ? ctx.resolveOwner() : null;
    if (token && owner) {
      const noted = noteTokenRoom(env, {
        ownerId: owner,
        tokenId: token,
        itemId: id,
        until: grant.exp * 1000,
      });
      if (ctx.waitUntil) ctx.waitUntil(noted);
      else await noted;
    }
    // A workspace session joins many rooms; each is recorded at liveworkspace, off the response's path, so ending
    // its access closes them all (WB55).
    if (workbench?.scope === 'workspace') {
      const noted = noteWorkbenchRoom(env, workbench, id);
      if (ctx.waitUntil) ctx.waitUntil(noted);
      else await noted;
    }
    // A Participant's adder key (docs/specs/013-workspace/share-roles.md "Integrity"): what the room stamps on the
    // stickies and text it adds, so its editor knows which are its own.
    const person = linkCodeOf(grant.sub) ? null : grant.sub;
    const adderKey = role === 'participate' && person ? await adderKeyFor(id, person) : null;
    const answer: RoomTicketResponse = adderKey ? { ticket, adderKey } : { ticket };
    // A view-only ticket's holder cannot read the grant inside, so the answer says when it lapses, and the caller's
    // own level (a read-only token's is view whatever the grant says). The ticket admits at view either way.
    if (cap) {
      answer.expiresAt = grant.exp * 1000;
      answer.level = ctx.token?.readOnly ? 'view' : own;
    }
    return json(answer);
  }

  if (segments.length === 4 && segments[3] === 'ws' && request.method === 'GET') {
    const id = segments[2]!;
    const opened = await openRoomTicket(indexService, env, url.searchParams.get('t'), id);
    if (!opened) return forbidden();
    const { claims, workbench, token } = opened;
    const role: AccessLevel = roomTicketLevel(opened);
    const person = linkCodeOf(claims.sub) ? null : claims.sub;
    // The share code a session came in by, from the grant the index signed (its `link` claim, set for a person who
    // opened a link as for a link visitor), never from the upgrade URL, which is the client's to change. Revoking
    // the link closes exactly its sockets.
    const linkCode = linkCodeOf(claims.sub);
    const shareCode = claims.link?.slice(0, 64) || linkCode;
    // The grant's own `link` claim names the code for a signed-in person who opened the link too.
    if (await isCommunityCode(env, id, claims.link ?? linkCode)) return forbidden('community_link');
    const forwarded = new Request(request);
    // Every trust header is stamped UNCONDITIONALLY: `new Request` copies the client's own headers, and the room
    // believes whatever arrives under these names (room-session.ts).
    forwarded.headers.set('X-Verified-Role', role);
    forwarded.headers.set('X-Verified-Tab-Scope', claims.tab ?? '');
    forwarded.headers.set('X-Verified-Share-Code', shareCode ?? '');
    forwarded.headers.set('X-Verified-Person', person ? await personTagFor(id, person) : '');
    // The session's collab key (docs/specs/013-workspace/share-roles.md "The collab key"): derived from the person,
    // never read from the request. Empty for a link visitor: the room mints one for that socket.
    forwarded.headers.set(COLLAB_KEY_HEADER, person ? await collabKeyFor(person) : '');
    // And the person the room stamps on this session's reactions (docs/specs/012-collaboration/comment-reactions.md).
    forwarded.headers.set(REACTION_PERSON_HEADER, person ? await reactionPersonFor(person) : '');
    // A signed-in account's session (not a guest's, not a link visitor's): only it may show its Google picture to
    // the room and see others' (docs/specs/014-identity/profile-and-email-notifications.md "Profile pictures").
    forwarded.headers.set('X-Verified-Account', person && isAccountId(person) ? '1' : '0');
    forwarded.headers.set('X-Verified-Workbench-Pairing', workbench?.pairing ?? '');
    // The API token whose ticket this is (public-api-and-tokens.md "Revoking a token"), so revoking it closes the
    // socket. Empty for every other session, over whatever the client sent.
    forwarded.headers.set('X-Verified-Api-Token', token ?? '');
    forwarded.headers.set(
      'X-Verified-Adder',
      role === 'participate' && person ? await adderKeyFor(id, person) : '',
    );
    forwarded.headers.set('X-Verified-Project', id);
    // When the grant lapses (epoch seconds): the room asks for a fresh one before then, and drops the socket
    // after (plan-room.ts).
    forwarded.headers.set('X-Verified-Grant-Exp', String(claims.exp));
    // The plan's owner and team as the index has them now: the room keeps its copy from these.
    forwarded.headers.set('X-Verified-Owner', claims.owner ?? '');
    forwarded.headers.set('X-Verified-Team', claims.team ?? '');
    const stub = env.PLAN_ROOM.get(env.PLAN_ROOM.idFromName(id));
    return stub.fetch(forwarded);
  }

  return null;
}
