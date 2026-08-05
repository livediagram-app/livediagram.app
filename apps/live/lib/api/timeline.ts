// The Explorer's landing feed (spec/138).
//
// Read-only: nothing user-authored lives on this feed in v1, so there
// is no create / update / delete to wrap.
//
// Offline Mode (spec/76) is a deliberate no-op here rather than a
// dispatch. `isOfflineId` keys on a DIAGRAM id, and this endpoint is
// scoped to an owner — there is no id to dispatch on, and a
// browser-only diagram never reaches the worker, so it has no server
// events to show. An offline-only user sees an empty feed, which is
// the truth.

import type { TimelineEvent, TimelineReadResult } from '@livediagram/api-schema';
import { TIMELINE_PAGE_SIZE } from '@livediagram/api-schema';
import { API_BASE, apiHeaders } from './core';

export type TimelinePage = {
  events: TimelineEvent[];
  nextCursor?: string;
  lastRefreshedAt?: number;
};

const EMPTY: TimelinePage = { events: [] };

export async function apiListTimeline(
  ownerId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<TimelinePage> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? TIMELINE_PAGE_SIZE));
  if (opts.cursor) params.set('cursor', opts.cursor);
  try {
    const res = await fetch(`${API_BASE}/timeline?${params.toString()}`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return EMPTY;
    const body = (await res.json()) as Partial<TimelineReadResult>;
    return {
      events: Array.isArray(body.items) ? body.items : [],
      nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : undefined,
      lastRefreshedAt: typeof body.lastRefreshedAt === 'number' ? body.lastRefreshedAt : undefined,
    };
  } catch {
    // Offline, or a self-host with no /api configured. An empty feed
    // degrades the landing page to "nothing yet" rather than an error
    // screen — the same posture the Explorer's diagram list takes, and
    // it matters more here because this is now the first thing a
    // visitor sees.
    return EMPTY;
  }
}

export async function apiRefreshTimeline(ownerId: string): Promise<number | undefined> {
  try {
    const res = await fetch(`${API_BASE}/timeline/refresh`, {
      method: 'POST',
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { lastRefreshedAt?: unknown };
    return typeof body.lastRefreshedAt === 'number' ? body.lastRefreshedAt : undefined;
  } catch {
    return undefined;
  }
}
