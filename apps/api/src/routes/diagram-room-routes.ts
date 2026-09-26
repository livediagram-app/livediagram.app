// /api/diagrams/<id>/room-ticket + /ws — realtime-room admission
// (docs/specs/015-api/api.md), split out of diagrams.ts the same way the share family
// owns diagram-share-routes.ts: the one-time WS ticket mint and the
// Durable Object WebSocket upgrade with its role / password trust
// boundary.

import { isPersonalOwner, shareLinkForDiagram, sharePasswordOk } from '../auth/share-access';
import { consumeWsTicket, createWsTicket, getDiagramMeta } from '../db';
import { forbidden, json, notFound } from '../responses';
import { gateEdit, gateRead, type RouteContext } from './context';

// Returns null when the request isn't a room route.
export async function handleDiagramRoomRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, segments } = ctx;
  // /api/diagrams/<id>/ws — Durable Object WebSocket. Resolve
  // the visitor's role server-side before handing the request
  // to the DO so peer avatars can show "Editor" / "Viewer"
  // badges that the client can't lie about: clients sending a
  // crafted `hello` frame still get their role re-stamped from
  // the X-Verified-Role header below. Falls through to no role
  // when we can't resolve (e.g. owner request with no share
  // code and no auth) — the DO leaves role undefined and the
  // UI hides the badge for that peer.
  // POST /api/diagrams/<id>/room-ticket — mint a one-time WS room ticket
  // (docs/specs/015-api/api.md). The WS upgrade can't carry the Bearer token, so identified
  // callers (team members above all: membership MUST be checked against
  // the VERIFIED Clerk id, docs/specs/013-workspace/team-shared-diagrams.md) prove their access here over normal
  // authenticated REST and hand the resulting short-lived ticket to the
  // upgrade as `?t=`. gateEdit/gateRead run the exact same access policy
  // as every REST read/write, including the share-password gate.
  if (segments.length === 4 && segments[3] === 'room-ticket' && request.method === 'POST') {
    const id = segments[2]!;
    // Gate-only projection — 1 query instead of getDiagram's 3; this
    // runs on every room join.
    const diagram = await getDiagramMeta(env, id);
    if (!diagram) return notFound();
    let role: 'edit' | 'view' | null = null;
    if (await gateEdit(ctx, id, diagram.ownerId, diagram.teamId)) role = 'edit';
    else if (await gateRead(ctx, id, diagram.ownerId, diagram.teamId)) role = 'view';
    if (!role) return notFound();
    const ticket = await createWsTicket(env, id, role);
    return json({ ticket });
  }

  if (segments.length === 4 && segments[3] === 'ws') {
    const id = segments[2]!;
    const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
    // Browsers can't put custom headers on a WebSocket upgrade,
    // so the client passes a one-time ticket / share code / owner id
    // as query params (`?t=...&s=...&o=...`). We resolve role here and
    // forward it to the Durable Object via X-Verified-Role; the DO
    // ignores any role the client might set in its own hello
    // payload, so this header is the trust boundary.
    let role: 'edit' | 'view' | null = null;
    const claimedOwnerId = url.searchParams.get('o');
    // Gate-only projection — the upgrade uses only ownerId/teamId.
    const diagram = await getDiagramMeta(env, id);
    // One-time ticket (docs/specs/015-api/api.md): minted seconds ago over authenticated
    // REST, single-use and diagram-scoped, carrying the server-resolved
    // role. This is the ONLY leg that can admit a team member — the old
    // fallback that granted edit to any `?o=` matching a JOINED member id
    // trusted an unverified, teammate-visible value, so a removed member
    // (or anyone who learned a member id) could keep joining the room.
    const ticket = url.searchParams.get('t');
    const ticketRole = ticket ? await consumeWsTicket(env, ticket, id) : null;
    // The bare-`o` owner match is PERSONAL diagrams only, mirroring the
    // REST access rule (auth/diagram-access.ts): a TEAM diagram's owner
    // id is a Clerk id deliberately visible to every teammate, so a
    // removed member could present it here — the exact hole the ticket
    // closed for the membership leg. Team owners come in via the ticket
    // (its mint admits them through the verified callerId === ownerId
    // leg); a personal guest owner's id stays an unguessable UUID.
    const isOwnerUpgrade =
      !!diagram && isPersonalOwner(claimedOwnerId, diagram.ownerId, diagram.teamId);
    if (ticketRole) {
      role = ticketRole;
    } else if (isOwnerUpgrade) {
      role = 'edit';
    } else {
      const link = await shareLinkForDiagram(env, url.searchParams.get('s'), id);
      if (link) role = link.role;
    }
    // Refuse the upgrade unless the caller is the owner or holds a valid
    // share code for THIS diagram. Without this, a diagram with no share
    // password forwarded every upgrade (role === null) to the room, so
    // anyone who learned the diagram id could read live ops; and the DO
    // additionally drops op frames from non-edit sessions.
    if (!role) return forbidden();
    // Password gate (docs/specs/013-workspace/share-password.md): a non-owner joining the realtime room of
    // a password-protected diagram must carry the matching password on
    // the `p` query param (WS upgrades can't set headers). Owners
    // bypass, and so do ticket holders — the mint already ran the full
    // REST access policy, including this same password gate for
    // share-code visitors (owners / team members read without it over
    // REST, so the room matches). A bad / missing password refuses the
    // upgrade outright so the room never even sees the peer.
    if (!isOwnerUpgrade && !ticketRole) {
      if (!(await sharePasswordOk(env, id, url.searchParams.get('p')))) return forbidden();
    }
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
    // upgrade is the diagram's OWNER. The facilitator baton needs it so the
    // owner can always take the session back, and a boolean answers that
    // without handing the room an identity it deliberately does not hold.
    forwarded.headers.set('X-Verified-Owner', isOwnerUpgrade ? '1' : '0');
    return stub.fetch(forwarded);
  }

  return null;
}
