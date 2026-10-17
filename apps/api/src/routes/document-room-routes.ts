// /api/documents/<id>/room-ticket + /ws — realtime-room admission
// (docs/specs/015-api/api.md), split out of documents.ts the same way the share family
// owns document-share-routes.ts: the one-time WS ticket mint and the
// Durable Object WebSocket upgrade with its role / password trust
// boundary.

import { capWorkbenchRole, type RoomTicketResponse } from '@livediagram/api-schema';
import { adderKeyFor } from '../adder-key';
import { clientRateKey } from '../client-ip';
import { consumeWsTicket, createWsTicket, getDocumentMeta } from '../db';
import { forbidden, json, notFound } from '../responses';
import {
  COMMUNITY_CONTENT,
  gateGrant,
  missingDocument,
  ownsDocument,
  type RouteContext,
} from './context';
import { personTagFor } from '../person-tag';
import { networkTagFor } from '../vote-integrity';

// Returns null when the request isn't a room route.
export async function handleDocumentRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // /api/documents/<id>/ws — Durable Object WebSocket. Resolve
  // the visitor's role server-side before handing the request
  // to the DO so peer avatars can show "Editor" / "Viewer"
  // badges that the client can't lie about: clients sending a
  // crafted `hello` frame still get their role re-stamped from
  // the X-Verified-Role header below. Falls through to no role
  // when we can't resolve (e.g. owner request with no share
  // code and no auth) — the DO leaves role undefined and the
  // UI hides the badge for that peer.
  // POST /api/documents/<id>/room-ticket — mint a one-time WS room ticket
  // (docs/specs/015-api/api.md). The WS upgrade can't carry the Bearer token, so identified
  // callers (team members above all: membership MUST be checked against
  // the VERIFIED Clerk id, docs/specs/013-workspace/team-shared-documents.md) prove their access here over normal
  // authenticated REST and hand the resulting short-lived ticket to the
  // upgrade as `?t=`. gateGrant runs the exact same access policy
  // as every REST read/write, including the share-password gate.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    // Gate-only projection — 1 query instead of getDocument's 3; this
    // runs on every room join.
    const liveDoc = await getDocumentMeta(env, id);
    if (!liveDoc) return missingDocument(ctx, id);
    // The grant carries the role, a tab-scoped link's scope and the code that
    // granted it (docs/specs/013-workspace/tab-scoped-share-links.md); the ticket takes all three to the room.
    const grant = await gateGrant(ctx, id, liveDoc.ownerId, liveDoc.teamId, COMMUNITY_CONTENT);
    if (!grant) return notFound();
    // A Community visitor never joins the author's room (docs/specs/025-community/community.md): no presence, no
    // cursors on the author's board, no live stream.
    if (grant.community) return forbidden('community_link');
    // A verified Clerk session (not an API token, not a guest header) marks the ticket as an
    // account session: the room lets it publish a profile picture and see others'
    // (docs/specs/014-identity/profile-picture.md §6).
    // A workbench session (docs/specs/013-workspace/workbench-embeds.md) joins as its owner: an account session
    // carrying the owner's person tag, so their agent's `selected` reads its selection, at most at its level, and
    // tagged with its pairing so unpairing closes exactly its sockets.
    const workbench = ctx.workbench ?? null;
    const personId = ctx.clerkUserId ?? workbench?.ownerId ?? null;
    const role = workbench ? capWorkbenchRole(grant.role, workbench.level) : grant.role;
    // A Participant's adder key (docs/specs/013-workspace/share-roles.md "Integrity"): what the room stamps on the
    // stickies and text it adds. Only a Participant needs one; no identity, no key (it may then edit, never add).
    const caller = ctx.resolveOwner();
    const adderKey = role === 'participate' && caller ? await adderKeyFor(id, caller) : null;
    const ticket = await createWsTicket(env, id, {
      role,
      tabScope: grant.tabScope,
      shareCode: grant.shareCode,
      account: personId !== null,
      // The same verified session carries its person tag, so the room can tell this owner's
      // sessions from everyone else's without holding the owner id
      // (docs/specs/024-agents/agent-changesets.md "Held elements").
      personTag: personId === null ? null : await personTagFor(id, personId),
      workbenchPairing: workbench?.pairingId ?? null,
      adderKey,
      // The owner bit rides the ticket (docs/specs/012-collaboration/facilitator.md): every editor joins through
      // one, so this is the only place the room can learn that a session is the owner's.
      owner: await ownsDocument(ctx, liveDoc),
    });
    // The caller's own adder key comes back with its ticket, so its editor knows which stickies are its own
    // to delete (docs/specs/013-workspace/share-roles.md). It says nothing about anybody else.
    const answer: RoomTicketResponse = adderKey ? { ticket, adderKey } : { ticket };
    return json(answer);
  }

  if (segments.length === 4 && segments[3] === 'ws') {
    const id = segments[2]!;
    const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(id));
    // Browsers can't put custom headers on a WebSocket upgrade, so whatever
    // admits the socket rides its URL, and a URL is logged. The only thing
    // that may ride it is a one-time ticket (`?t=`, docs/specs/015-api/api.md
    // "Realtime model"), minted over REST moments before, where the guest
    // signature, the share code and its password, and team membership all
    // travel as headers through the same gates as every other door. The owner
    // id, its signature, the share code and the share password used to ride
    // here as `o` / `os` / `s` / `p`; those legs are retired, so an upgrade
    // without a live ticket admits nobody. We forward the ticket's role to the
    // Durable Object via X-Verified-Role; the DO ignores any role the client
    // sets in its own hello payload, so this header is the trust boundary.
    //
    // Gate-only projection. A document in the Trash (docs/specs/013-workspace/trash.md)
    // reads as missing, so not even a ticket minted before the delete admits anyone.
    const liveDoc = await getDocumentMeta(env, id);
    if (!liveDoc) return notFound();
    // Single-use and document-scoped, carrying the server-resolved role, scope, share code and owner bit.
    const ticket = url.searchParams.get('t');
    const admission = ticket ? await consumeWsTicket(env, ticket, id) : null;
    if (!admission) {
      // A retired leg's params are named in the log (never their values), so a straggler is recognisable.
      const legacy = ['o', 's', 'p'].filter((k) => url.searchParams.has(k));
      console.info('[room-upgrade] refused', { documentId: id, ticket: !!ticket, legacy });
      return forbidden();
    }
    const { role, tabScope, shareCode, account, personTag, workbenchPairing, adderKey, owner } =
      admission;
    // Presence identity is no longer forwarded: the DO assigns each session a
    // fresh ephemeral id for its broadcast presence / cursor (docs/specs/015-api/public-api-and-tokens.md §6), so
    // the real owner id never reaches the room and a joiner can't spoof
    // another peer's presence (there's no real id to claim). Only the
    // server-resolved role is forwarded; it still gates edit vs view ops.
    const forwarded = new Request(request);
    // Both trust headers are stamped UNCONDITIONALLY, because `new Request`
    // copies the client's own headers and the DO believes whatever arrives
    // under these names. `set` on every path is what makes that belief true:
    // a `delete`-then-conditional-`set` would be equivalent, but the
    // always-set form can't regress the way the owner bit did — it was only
    // ever set on the owner path, so a non-browser client (websocat, curl:
    // browsers can't put headers on an upgrade) could send
    // `X-Verified-Owner: 1` itself and have the room seat it as the owner.
    forwarded.headers.set('X-Verified-Role', role);
    // One more server-resolved bit, and only a bit (docs/specs/012-collaboration/facilitator.md): whether this
    // upgrade is the document's OWNER. The facilitator baton needs it so the
    // owner can always take the session back, and a boolean answers that
    // without handing the room an identity it deliberately does not hold.
    forwarded.headers.set('X-Verified-Owner', owner ? '1' : '0');
    // The session's tab scope and admitting code, set on every path for the
    // same reason as the two above: the room believes these names. Empty =
    // none (docs/specs/013-workspace/tab-scoped-share-links.md).
    forwarded.headers.set('X-Verified-Tab-Scope', tabScope ?? '');
    forwarded.headers.set('X-Verified-Share-Code', shareCode ?? '');
    // Whether a verified account holds this session (docs/specs/014-identity/profile-picture.md §6),
    // set on every path for the same reason as the headers above.
    forwarded.headers.set('X-Verified-Account', account ? '1' : '0');
    // The person tag (docs/specs/024-agents/agent-changesets.md, CS39), set on every path for the
    // same reason as the headers above. Empty = none.
    forwarded.headers.set('X-Verified-Person', personTag ?? '');
    // The workbench pairing that opened the session (docs/specs/013-workspace/workbench-embeds.md), set on every
    // path for the same reason as the headers above. Empty = none.
    forwarded.headers.set('X-Verified-Workbench-Pairing', workbenchPairing ?? '');
    // A Participant's adder key (docs/specs/013-workspace/share-roles.md "Integrity"), set on every path for the
    // same reason as the headers above. Empty = none.
    forwarded.headers.set('X-Verified-Adder', adderKey ?? '');
    // The document this room serves, so a Participant's write knows its row; the room is named after it, and the
    // header is set on every path for the same reason as the headers above.
    forwarded.headers.set('X-Verified-Document', id);
    // The caller's network, hashed with the document id (docs/specs/012-collaboration/vote-integrity.md): what
    // caps a poll's answers from one network. Set on every path for the same reason as the headers above.
    forwarded.headers.set('X-Verified-Network', await networkTagFor(id, clientRateKey(request)));
    return stub.fetch(forwarded);
  }

  return null;
}
