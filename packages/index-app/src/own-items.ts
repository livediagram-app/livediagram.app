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
 */
export async function purgeOwnItems(
  client: IndexClient,
  app: App,
  ownerId: string | null | undefined,
): Promise<{ count: number; more: boolean }> {
  let count = 0;
  for (let page = 0; page < OWN_PURGE_PAGES; page++) {
    const [live, trashed] = await Promise.all([
      client.listItems({ app, team: 'personal', limit: OWN_PURGE_PAGE }),
      client.listTrash({ app, team: 'personal', limit: OWN_PURGE_PAGE }),
    ]);
    const own = [...live.items, ...trashed.items].filter((i) => i.ownerId === ownerId);
    if (own.length === 0) return { count, more: false };
    for (let i = 0; i < own.length; i += ROOM_PURGE_CONCURRENCY) {
      const batch = own.slice(i, i + ROOM_PURGE_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((item) => client.deleteItem(item.id, { permanent: true })),
      );
      const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
      count += batch.length;
    }
  }
  return { count, more: true };
}
