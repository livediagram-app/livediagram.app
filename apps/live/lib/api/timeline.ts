// The Explorer's landing feed (spec/138).
//
// Read-only: nothing user-authored lives on this feed in v1, so there
// is no create / update / delete to wrap. There is no refresh wrapper
// either — the feed loads on mount, re-reads this same GET when the
// reader returns to the tab (spec/138 §2.4a), and the worker seeds a
// first-time scope off it, so a manual refresh button had nothing to
// do that reopening the page doesn't. (The `POST /api/timeline/refresh`
// endpoint stays part of the documented public API for external
// callers who want to force a seed; the app just doesn't need it.)
//
// Offline Mode (spec/76) is a deliberate no-op here rather than a
// dispatch. `isOfflineId` keys on a DIAGRAM id, and this endpoint is
// scoped to an owner — there is no id to dispatch on, and a
// browser-only diagram never reaches the worker, so it has no server
// events to show. An offline-only user sees an empty feed, which is
// the truth.

import type { TimelineEvent, TimelineReadResult, TimelineScopeRef } from '@livediagram/api-schema';
import { TIMELINE_PAGE_SIZE, formatScope } from '@livediagram/api-schema';
import { API_BASE, apiHeaders } from './core';

export type TimelinePage = {
  events: TimelineEvent[];
  nextCursor?: string;
  /** The unread watermark as it stood before this read. */
  lastSeenAt?: number;
};

// Null means the read FAILED — offline, a lapsed session token, a
// worker 500 — as opposed to an empty page, which means the feed really
// is empty (spec/138 §6.4). The two used to be the same value, and the
// result was a reader coming back to a sleeping laptop being told
// nothing had ever happened to them. The caller keeps what it had and
// offers a retry (§2.4).
export async function apiListTimeline(
  ownerId: string,
  opts: {
    cursor?: string;
    limit?: number;
    scope?: TimelineScopeRef;
    // Epoch-ms bounds, for the calendar's on-demand period fetch.
    from?: number;
    to?: number;
  } = {},
): Promise<TimelinePage | null> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? TIMELINE_PAGE_SIZE));
  if (opts.cursor) params.set('cursor', opts.cursor);
  // Omitted for the personal feed, which is what the worker defaults to.
  if (opts.scope) params.set('scope', formatScope(opts.scope));
  if (opts.from !== undefined) params.set('from', String(opts.from));
  if (opts.to !== undefined) params.set('to', String(opts.to));
  try {
    const res = await fetch(`${API_BASE}/timeline?${params.toString()}`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<TimelineReadResult>;
    return {
      events: Array.isArray(body.items) ? body.items : [],
      nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : undefined,
      lastSeenAt: typeof body.lastSeenAt === 'number' ? body.lastSeenAt : undefined,
    };
  } catch {
    // Offline, or a self-host with no /api configured. Still not an
    // empty feed: "we couldn't ask" and "there is nothing" are
    // different answers, and this surface is the first thing a visitor
    // sees, so getting them confused is expensive.
    return null;
  }
}

// The sidebar's unread badge. Its own call rather than a field on the
// list read, because the badge renders on every Explorer section and
// must not require loading a feed nobody is looking at. Zero on any
// failure — a wrong badge is worse than no badge.
export async function apiTimelineUnread(ownerId: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/timeline/unread`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return 0;
    const body = (await res.json()) as { count?: unknown };
    return typeof body.count === 'number' ? body.count : 0;
  } catch {
    return 0;
  }
}
