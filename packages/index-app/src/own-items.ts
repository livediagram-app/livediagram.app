// Deleting an account's own items for good through the index (each product's docs/specs/014-identity
// "Deleting an account"), which has each item's Durable Object drop its content. Team items stay with the team.
// Several products' account routes share it.

import type { App, IndexClient } from '@liveworkspace/index-client';
import { ROOM_PURGE_CONCURRENCY } from './purge';

// One account deletion purges at most OWN_PURGE_PAGES pages of OWN_PURGE_PAGE: a person with more is told to try
// again (the delete is idempotent), each run taking the next 1,000.
export const OWN_PURGE_PAGES = 5;
export const OWN_PURGE_PAGE = 200;

/**
 * The person's own items in `app` (live and in the Trash), deleted for good, ROOM_PURGE_CONCURRENCY at a time.
 * Answers how many went and whether some are left; a delete the index refuses fails the purge once its batch
 * has settled, so nothing is left in flight.
 *
 * Each listing (live, then the Trash) is walked by its cursor, OWN_PURGE_PAGES pages in all: re-reading the first
 * page stopped at a page holding none of the person's own (as if nothing were left, though later pages held some).
 */
export async function purgeOwnItems(
  client: IndexClient,
  app: App,
  ownerId: string | null | undefined,
): Promise<{ count: number; more: boolean }> {
  const query = { app, team: 'personal' } as const;
  const listings = [
    (limit: number, cursor?: string) =>
      client.listItems({ ...query, limit, ...(cursor ? { cursor } : {}) }),
    (limit: number, cursor?: string) =>
      client.listTrash({ ...query, limit, ...(cursor ? { cursor } : {}) }),
  ];
  let count = 0;
  let pages = 0;
  for (const [at, list] of listings.entries()) {
    let cursor: string | undefined;
    do {
      if (pages++ === OWN_PURGE_PAGES) {
        // The budget ran out. Mid-listing, more are left; at the start of the next listing (the live one ended on
        // the last page), one look at each listing still to read says whether anything is: a person with exactly
        // 1,000 live items and an empty Trash is done, not asked again.
        if (cursor) return { count, more: true };
        for (const rest of listings.slice(at)) {
          if ((await rest(1)).items.length > 0) return { count, more: true };
        }
        return { count, more: false };
      }
      const page = await list(OWN_PURGE_PAGE, cursor);
      const own = page.items.filter((i) => i.ownerId === ownerId);
      for (let i = 0; i < own.length; i += ROOM_PURGE_CONCURRENCY) {
        const batch = own.slice(i, i + ROOM_PURGE_CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map((item) => client.deleteItem(item.id, { permanent: true })),
        );
        const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failed) throw failed.reason;
        count += batch.length;
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  return { count, more: false };
}
