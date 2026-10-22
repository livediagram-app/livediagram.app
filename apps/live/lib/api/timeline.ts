// The event record's reads (docs/specs/013-workspace/timeline.md): a scoped feed, a document's History
// or a team's Team Activity (§3.4), and the Home row's unread count (§2.5).
//
// Nothing user-AUTHORED lives on these feeds, so there is no create, update or delete to wrap. A feed
// loads on mount and re-reads this same GET when the reader returns to the tab (§2.4a) or after one of
// their own writes lands (§2.4b).
//
// Offline Mode (docs/specs/006-document/offline-mode.md) needs no dispatch here: a browser-only document
// never reaches the worker, so it has no server history to show, and the History dialog is never offered
// for one.

import type { TimelineEvent, TimelineReadResult, TimelineScopeRef } from '@liveplanner/api-schema';
import { TIMELINE_PAGE_SIZE, formatScope } from '@liveplanner/api-schema';
import { API_BASE, apiHeaders, apiFetch } from './core';

export type TimelinePage = {
  events: TimelineEvent[];
  nextCursor?: string;
};

// Null means the read FAILED — offline, a lapsed session token, a
// worker 500 — as opposed to an empty page, which means the feed really
// is empty (docs/specs/013-workspace/timeline.md §6.4). The two used to be the same value, and the
// result was a reader coming back to a sleeping laptop being told
// nothing had ever happened to them. The caller keeps what it had and
// offers a retry (§2.4).
export async function apiListTimeline(
  ownerId: string,
  opts: {
    cursor?: string;
    limit?: number;
    scope: TimelineScopeRef;
    // Epoch-ms bounds, for the calendar's on-demand period fetch.
    from?: number;
    to?: number;
  },
): Promise<TimelinePage | null> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? TIMELINE_PAGE_SIZE));
  if (opts.cursor) params.set('cursor', opts.cursor);
  params.set('scope', formatScope(opts.scope));
  if (opts.from !== undefined) params.set('from', String(opts.from));
  if (opts.to !== undefined) params.set('to', String(opts.to));
  try {
    const res = await apiFetch(`${API_BASE}/timeline?${params.toString()}`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<TimelineReadResult>;
    return {
      events: Array.isArray(body.items) ? body.items : [],
      nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : undefined,
    };
  } catch {
    // Offline, or a self-host with no /api configured. Still not an
    // empty feed: "we couldn't ask" and "there is nothing" are
    // different answers.
    return null;
  }
}

// The sidebar's unread badge. Its own call rather than a field on the
// list read, because the badge renders on every Explorer section and
// must not require loading a feed nobody is looking at. Zero on any
// failure — a wrong badge is worse than no badge.
export async function apiTimelineUnread(ownerId: string): Promise<number> {
  try {
    const res = await apiFetch(`${API_BASE}/timeline/unread`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return 0;
    const body = (await res.json()) as { count?: unknown };
    return typeof body.count === 'number' ? body.count : 0;
  } catch {
    return 0;
  }
}
