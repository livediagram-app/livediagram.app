// Explorer Home's reads (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home.md "Client").
//
// Null means the read FAILED (a refusal, offline, an unparseable body), never an empty Home: "we
// could not ask" and "there is nothing" are different answers, as the Timeline learnt
// (docs/specs/013-workspace/timeline.md §2.4). The caller keeps what it had and offers a retry.
//
// Opens are not sent from here: the editor declares them on its first tab read
// (apiLoadTab's `open`).

import type { HomeResponse, HomeTimelinePage } from '@livediagram/api-schema';
import { API_BASE, apiFetch, apiHeaders } from './core';

async function read<T>(ownerId: string, path: string, isShape: (body: unknown) => boolean) {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}${path}`, { headers: await apiHeaders(ownerId) });
  } catch {
    console.warn('[home] read failed status=thrown');
    return null;
  }
  if (!res.ok) {
    console.warn(`[home] read failed status=${res.status}`);
    return null;
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!isShape(body)) {
    console.warn('[home] read failed status=unparseable');
    return null;
  }
  return body as T;
}

function isTimelinePage(body: unknown): boolean {
  return (
    typeof body === 'object' && body !== null && Array.isArray((body as HomeTimelinePage).items)
  );
}

function isHome(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const home = body as HomeResponse;
  return (
    Array.isArray(home.jumpBackIn) &&
    Array.isArray(home.whatHappened) &&
    isTimelinePage(home.timeline) &&
    (home.lastSeenAt === null || typeof home.lastSeenAt === 'number')
  );
}

/** The whole first screen: Jump back in, the Timeline's first page and What happened, grouped
 *  by day in `tz` (the reader's IANA time zone). */
export function apiReadHome(ownerId: string, opts: { tz: string }): Promise<HomeResponse | null> {
  const params = new URLSearchParams({ tz: opts.tz });
  return read<HomeResponse>(ownerId, `/home?${params.toString()}`, isHome);
}

/** The Timeline's next page, from the previous page's `nextCursor`. */
export function apiReadHomeTimeline(
  ownerId: string,
  opts: { cursor: string },
): Promise<HomeTimelinePage | null> {
  const params = new URLSearchParams({ cursor: opts.cursor });
  return read<HomeTimelinePage>(ownerId, `/home/timeline?${params.toString()}`, isTimelinePage);
}
