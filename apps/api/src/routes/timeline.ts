// /api/timeline — the Explorer's landing feed (spec/138).
//
// GET  /api/timeline          -> { items, nextCursor?, lastRefreshedAt? }
// POST /api/timeline/refresh  -> { lastRefreshedAt }
//
// Read-only by design. Nothing user-authored lives on this feed: there
// are no manual entries, no stars, and no per-entry dismissal in v1
// (spec/138 non-goals), so there is no POST/PATCH/DELETE for events.
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
import { getScopeState, markScopeRefreshed, readTimeline } from '../db/timeline';
import { backfillUserScope } from '../timeline';
import { badRequest, forbidden, json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// A deliberate Refresh click costs a scope-state write and, on a first
// visit, a backfill. Throttled so a held-down button doesn't turn into
// a write storm. Reads are unthrottled — they're the common path and
// they only touch two indexes.
const REFRESH_THROTTLE_MS = 5_000;

export async function handleTimeline(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'timeline') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const scope = resolveScope(url, ownerId);
    // The scope parameter exists so the wire shape is fixed before a
    // second scope type ships (spec/138 §3.4). Until one does, the only
    // scope anyone may read is their own — worth stating in code
    // because the parameter looks like it invites more than it does.
    if (scope === null) return badRequest('invalid scope');
    if (scope.scopeType !== 'user' || scope.scopeId !== ownerId) return forbidden();

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
    // refresh — better than holding the response while we walk their
    // whole library.
    if (!state?.backfilledAt) {
      ctx.waitUntil?.(backfillUserScope(env, ownerId).catch(() => {}));
    }

    return json({
      items: page.items,
      nextCursor: page.nextCursor,
      lastRefreshedAt: state?.lastRefreshedAt ?? undefined,
    });
  }

  if (segments.length === 3 && segments[2] === 'refresh' && request.method === 'POST') {
    const scope: TimelineScopeRef = { scopeType: 'user', scopeId: ownerId };
    const state = await getScopeState(env, scope);
    const now = Date.now();
    if (state?.lastRefreshedAt && now - state.lastRefreshedAt < REFRESH_THROTTLE_MS) {
      // Not an error: the client asked for the freshest feed and it
      // already has one. Returning the existing stamp keeps the
      // "Last refreshed …" line truthful rather than lying forward.
      return json({ lastRefreshedAt: state.lastRefreshedAt });
    }
    if (!state?.backfilledAt) {
      await backfillUserScope(env, ownerId).catch(() => {});
    }
    return json({ lastRefreshedAt: await markScopeRefreshed(env, scope) });
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
