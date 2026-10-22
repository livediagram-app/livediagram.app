// /api/timeline — the scoped feeds read from the event record (docs/specs/013-workspace/timeline.md):
// a document's History and a team's Activity, plus Home's unread count.
//
// GET    /api/timeline?scope=document:<id> | team:<id>  -> { items, nextCursor? }
// GET    /api/timeline/unread                           -> { count }
//
// Read-only: nothing user-authored lives on these feeds. The personal feed (the Explorer's Timeline
// section, its refresh and its Remove from Timeline) is gone, so a read names its scope, and a `user`
// scope is refused like any other the reader may not see; Home (/api/home) is what moves the unread mark.
//
// Hybrid identity like the rest of the api (docs/specs/014-identity/auth-and-guest-access.md): the account
// id when signed in, X-Owner-Id otherwise.

import {
  TIMELINE_PAGE_MAX,
  TIMELINE_PAGE_SIZE,
  parseScope,
  type TimelineScopeRef,
} from '@liveplanner/api-schema';
import { countUnseen, getScopeState, readTimeline } from '../db/timeline';
import { getDocument, getMembership } from '../db';
import { badRequest, forbidden, json, missingAuth, notFound } from '../responses';
import { gateRead, type RouteContext } from './context';

// More source-type filters than any real feed has (one per source type).
const MAX_SOURCE_TYPES = 20;

export async function handleTimeline(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'timeline') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const raw = url.searchParams.get('scope');
    if (!raw) return badRequest('scope required');
    const scope = parseScope(raw);
    if (scope === null) return badRequest('invalid scope');
    const allowed = await canReadScope(ctx, scope);
    if (!allowed) return forbidden();

    const limit = clampLimit(url.searchParams.get('limit'));
    const page = await readTimeline(env, {
      scope,
      readerId: ownerId,
      limit,
      cursor: url.searchParams.get('cursor'),
      from: numberParam(url.searchParams.get('from')),
      to: numberParam(url.searchParams.get('to')),
      // Bounded: each one is a bound parameter, and D1 refuses past 100.
      sourceTypes: url.searchParams.getAll('sourceType').filter(Boolean).slice(0, MAX_SOURCE_TYPES),
    });

    // An owner id is a credential (a guest's X-Owner-Id is their whole
    // workspace), and a document feed is readable by anyone holding a share
    // code. So a document scope only names the reader themself; every other
    // actor goes out as null, and the renderers fall back to the snapshot's
    // display name. The client only ever compares actorId with its own id.
    const items =
      scope.scopeType === 'document'
        ? page.items.map((e) => (e.actorId === ownerId ? e : { ...e, actorId: null }))
        : page.items;

    return json({ items, nextCursor: page.nextCursor });
  }

  // The Home row's badge: other people's events since the reader last viewed Home. Its own endpoint,
  // because the badge renders on every Explorer section.
  if (segments.length === 3 && segments[2] === 'unread' && request.method === 'GET') {
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const state = await getScopeState(env, scope);
    // No watermark yet means the reader has never opened Home.
    // Counting their whole history as unread would greet a long-time
    // user with "99+" on a feature they've never seen, so a scope with
    // no watermark reports nothing and starts counting from first view.
    if (!state?.lastSeenAt) return json({ count: 0 });
    return json({ count: await countUnseen(env, scope, state.lastSeenAt) });
  }

  return notFound();
}

// Who may read which feed.
//
// This is the security boundary of the whole surface: a feed carries
// document names and comment text, so getting it wrong hands one owner
// another's work. Each scope type is allowed explicitly and anything
// unrecognised is refused, so a scope type added later is inert until
// somebody writes its rule here.
async function canReadScope(ctx: RouteContext, scope: TimelineScopeRef): Promise<boolean> {
  // A `user` scope was the personal feed, which is gone: refused like any unrecognised scope.
  if (scope.scopeType === 'document') {
    // Exactly the document's own read gate: its owner, a joined member of
    // its team, or a valid share-code visitor. A missing document is a
    // refusal rather than a 404, so a guessed id can't be probed for
    // existence through this endpoint either.
    const liveDoc = await getDocument(ctx.env, scope.scopeId);
    if (!liveDoc) return false;
    return gateRead(ctx, scope.scopeId, liveDoc.ownerId, liveDoc.teamId);
  }
  if (scope.scopeType === 'team') {
    // Joined members only — an `invited` row grants no access to the
    // team's content (docs/specs/013-workspace/teams.md), and its feed is content. Teams are
    // signed-in only, so a guest never passes this.
    if (!ctx.verifiedUserId) return false;
    const membership = await getMembership(ctx.env, scope.scopeId, ctx.verifiedUserId);
    return membership?.status === 'joined';
  }
  return false;
}

function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return TIMELINE_PAGE_SIZE;
  return Math.min(Math.floor(n), TIMELINE_PAGE_MAX);
}

function numberParam(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
