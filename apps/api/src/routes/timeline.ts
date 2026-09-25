// /api/timeline — the Explorer's landing feed (spec/138).
//
// GET    /api/timeline             -> { items, nextCursor?, lastSeenAt? }
// GET    /api/timeline/unread      -> { count }
// POST   /api/timeline/refresh     -> { lastSeenAt }
// DELETE /api/timeline/events/:id      -> 204 (spec/138 §2.9)
// POST   /api/timeline/events/dismiss  -> { dismissed } (a whole stack)
//
// Nothing user-AUTHORED lives on this feed: there are no manual entries
// and no stars, so nothing here creates or edits an event. The one
// write is the dismissal, which takes a card (or a stack of them) off
// the caller's own feed and nobody else's.
//
// Hybrid identity like the rest of the api (spec/04): the Clerk userId
// when signed in, X-Owner-Id otherwise. Guests get a Timeline too — a
// thinner one, since team and token events never reach them — and it
// migrates to their account on sign-up (spec/138 §9).

import {
  TIMELINE_PAGE_MAX,
  TIMELINE_PAGE_SIZE,
  parseScope,
  type TimelineScopeRef,
} from '@livediagram/api-schema';
import {
  DISMISS_BATCH_MAX,
  countUnseen,
  dismissTimelineEventForScope,
  dismissTimelineEventsForScope,
  getScopeState,
  markScopeSeen,
  readTimeline,
} from '../db/timeline';
import { getDiagram, getMembership } from '../db';
import { backfillUserScope } from '../timeline';
import { badRequest, forbidden, json, missingAuth, noContent, notFound } from '../responses';
import { gateRead, type RouteContext } from './context';

// The seed endpoint costs a scope-state write and, on a first call, a
// walk of the caller's library. Throttled so a scripted caller can't
// turn it into a write storm. Reads are unthrottled — they're the
// common path and they only touch two indexes.
const REFRESH_THROTTLE_MS = 5_000;

// How long one "visit" lasts for the unread watermark.
//
// Without this the watermark moves on EVERY read, so a second request
// inside the same visit reports nothing new and the New markers vanish
// before the reader has looked at them. That isn't a hypothetical: a
// client can easily fetch twice on mount (React's development
// double-effect does exactly that), and tabbing away and straight back
// would wipe the markers too.
//
// A window makes the semantics what a person would expect — "since I
// was last here", not "since my last HTTP request".
const SEEN_WINDOW_MS = 60_000;

export async function handleTimeline(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'timeline') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const scope = resolveScope(url, ownerId);
    if (scope === null) return badRequest('invalid scope');
    const allowed = await canReadScope(ctx, scope, ownerId);
    if (!allowed) return forbidden();

    const limit = clampLimit(url.searchParams.get('limit'));
    const page = await readTimeline(env, {
      scope,
      limit,
      cursor: url.searchParams.get('cursor'),
      from: numberParam(url.searchParams.get('from')),
      to: numberParam(url.searchParams.get('to')),
      sourceTypes: url.searchParams.getAll('sourceType').filter(Boolean),
    });

    const state = await getScopeState(env, scope);
    // Seed on first sight, off the response path. The reader gets an
    // empty (or partial) first page and a populated one the moment they
    // reopen — better than holding the response while we walk their
    // whole library.
    // Seeding walks the caller's own library, so it only applies to
    // their personal scope; a team's history is whatever its members
    // have actually done since the team existed.
    if (scope.scopeType === 'user' && !state?.backfilledAt) {
      ctx.waitUntil?.(backfillUserScope(env, ownerId).catch(() => {}));
    }

    // The unread watermark (spec/138 §2.5). The response carries the
    // value from BEFORE this read, so the client can mark what was new
    // to the reader on this visit; then it moves forward.
    //
    // Only on the first page — stamping while someone pages backwards
    // through history would mark the whole feed seen halfway down it —
    // and only once per visit window, so the markers survive long
    // enough to be read.
    // Only the personal scope carries an unread marker: "since I was
    // last here" is a question about one reader, and a shared team feed
    // has no single "here" to be last at.
    const isFirstPage = !url.searchParams.get('cursor');
    const staleEnough = !state?.lastSeenAt || Date.now() - state.lastSeenAt > SEEN_WINDOW_MS;
    if (scope.scopeType === 'user' && isFirstPage && staleEnough) {
      ctx.waitUntil?.(markScopeSeen(env, scope).catch(() => {}));
    }

    return json({
      items: page.items,
      nextCursor: page.nextCursor,
      lastSeenAt: state?.lastSeenAt ?? undefined,
    });
  }

  // The sidebar badge. Its own endpoint rather than a field on the
  // list response, because the badge renders on every Explorer section
  // and must not require loading a feed nobody is looking at.
  if (segments.length === 3 && segments[2] === 'unread' && request.method === 'GET') {
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const state = await getScopeState(env, scope);
    // No watermark yet means the reader has never opened the Timeline.
    // Counting their whole history as unread would greet a long-time
    // user with "99+" on a feature they've never seen, so a scope with
    // no watermark reports nothing and starts counting from first view.
    if (!state?.lastSeenAt) return json({ count: 0 });
    return json({ count: await countUnseen(env, scope, state.lastSeenAt) });
  }

  if (segments.length === 3 && segments[2] === 'refresh' && request.method === 'POST') {
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const state = await getScopeState(env, scope);
    const now = Date.now();
    if (state?.lastSeenAt && now - state.lastSeenAt < REFRESH_THROTTLE_MS) {
      // Not an error: the caller asked for a seed and the scope was
      // touched moments ago, so there is nothing to do.
      return json({ lastSeenAt: state.lastSeenAt });
    }
    if (!state?.backfilledAt) {
      await backfillUserScope(env, ownerId).catch(() => {});
    }
    await markScopeSeen(env, scope);
    return json({ lastSeenAt: now });
  }

  // Per-entry dismissal (spec/138 §2.9). Always against the caller's
  // OWN user scope: a card is removed from "my timeline", never from a
  // team's shared feed, so there is no scope parameter to authorise —
  // the identity that resolved the owner is the whole gate. 404 when
  // this scope never held the event, so a guessed id learns nothing
  // beyond "not yours".
  if (
    segments.length === 4 &&
    segments[2] === 'events' &&
    segments[3] &&
    request.method === 'DELETE'
  ) {
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const found = await dismissTimelineEventForScope(env, scope, segments[3]);
    return found ? noContent() : notFound();
  }

  // A whole stack at once (spec/138 §2.9). A POST with an id list
  // rather than N DELETEs: a collapsed run can hold dozens of cards, and
  // it's one action to the reader. Ids the feed never held are ignored
  // rather than refused — the caller is describing a stack it can see,
  // and a member that vanished meanwhile is not an error.
  if (
    segments.length === 4 &&
    segments[2] === 'events' &&
    segments[3] === 'dismiss' &&
    request.method === 'POST'
  ) {
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : null;
    if (!ids || ids.length === 0) return badRequest('ids required');
    if (ids.length > DISMISS_BATCH_MAX) return badRequest('too many ids');
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const dismissed = await dismissTimelineEventsForScope(env, scope, ids);
    return json({ dismissed });
  }

  return notFound();
}

// Absent `scope` means "mine", which is what every v1 client sends.
// A malformed one is a 400 rather than a silent fallback to the
// caller's own scope: a client that meant to ask for something else
// should hear about it.
function resolveScope(url: URL, ownerId: string): TimelineScopeRef | null {
  const raw = url.searchParams.get('scope');
  if (!raw) return { scopeType: 'user', scopeId: ownerId };
  return parseScope(raw);
}

// Who may read which feed.
//
// This is the security boundary of the whole surface: a feed carries
// diagram names and comment text, so getting it wrong hands one owner
// another's work. Each scope type is allowed explicitly and anything
// unrecognised is refused, so a scope type added later is inert until
// somebody writes its rule here.
async function canReadScope(
  ctx: RouteContext,
  scope: TimelineScopeRef,
  ownerId: string,
): Promise<boolean> {
  if (scope.scopeType === 'user') return scope.scopeId === ownerId;
  if (scope.scopeType === 'diagram') {
    // Exactly the diagram's own read gate: its owner, a joined member of
    // its team, or a valid share-code visitor. A missing diagram is a
    // refusal rather than a 404, so a guessed id can't be probed for
    // existence through this endpoint either.
    const diagram = await getDiagram(ctx.env, scope.scopeId);
    if (!diagram) return false;
    return gateRead(ctx, scope.scopeId, diagram.ownerId, diagram.teamId);
  }
  if (scope.scopeType === 'team') {
    // Joined members only — an `invited` row grants no access to the
    // team's content (spec/32), and its feed is content. Teams are
    // Clerk-only, so a guest never passes this.
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
