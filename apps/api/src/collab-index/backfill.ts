// One-shot seed of the collaboration index for one owner (spec/142
// §2.3). Tabs saved after the index shipped index themselves in the
// save's own batch; this covers the dormant ones, so the Activity page
// is not empty for somebody whose open actions all predate it.
//
// Runs inside waitUntil after the first read is served, and stamps
// `collab_index_state` so it never runs twice. Each tab gets the same
// full-replace statements a save writes, so overlapping with a live
// save is harmless: whichever lands last is a complete snapshot.

import type { Element } from '@livediagram/diagram';
import {
  collabIndexStatements,
  listCollabTabsToBackfill,
  markCollabIndexBackfilled,
} from '../db/collab-index';
import type { Env } from '../types';

// A cap rather than the whole library because this runs in one
// request's tail. Logged when hit: a reader with more should not be
// told silently that their older actions do not exist.
export const COLLAB_BACKFILL_TAB_LIMIT = 300;

// D1 batch size per round trip. The index statements per tab are small
// (2 + rows), so this keeps a batch well under any bind/statement cap
// while still amortising the round trip.
const TABS_PER_BATCH = 25;

export async function backfillCollabIndex(env: Env, ownerId: string): Promise<void> {
  const tabs = await listCollabTabsToBackfill(env, ownerId, COLLAB_BACKFILL_TAB_LIMIT);
  if (tabs.length === COLLAB_BACKFILL_TAB_LIMIT) {
    console.info('collab index backfill capped', ownerId, COLLAB_BACKFILL_TAB_LIMIT);
  }
  for (let i = 0; i < tabs.length; i += TABS_PER_BATCH) {
    const stmts: D1PreparedStatement[] = [];
    for (const tab of tabs.slice(i, i + TABS_PER_BATCH)) {
      let elements: Element[] = [];
      try {
        const parsed = JSON.parse(tab.data) as { elements?: unknown };
        if (Array.isArray(parsed.elements)) elements = parsed.elements as Element[];
      } catch {
        // A blob that will not parse cannot be indexed; the save that
        // next rewrites it will. Skip rather than abort the seed.
        continue;
      }
      stmts.push(...collabIndexStatements(env, tab.id, elements));
    }
    if (stmts.length > 0) await env.DB.batch(stmts);
  }
  await markCollabIndexBackfilled(env, ownerId);
}
