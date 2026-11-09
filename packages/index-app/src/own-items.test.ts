import type { IndexClient, Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { OWN_PURGE_PAGE, OWN_PURGE_PAGES, purgeOwnItems } from './own-items';
import { ROOM_PURGE_CONCURRENCY } from './purge';

// An index over `live` and `trashed` items whose deletes take a turn of the event loop, counting how many run at once.
function fakeIndex(live: Item[], trashed: Item[] = [], fail?: string) {
  const deleted: string[] = [];
  let inFlight = 0;
  let most = 0;
  const page = (items: Item[]) =>
    items.filter((i) => !deleted.includes(i.id)).slice(0, OWN_PURGE_PAGE);
  const client = {
    listItems: async () => ({ items: page(live), nextCursor: null }),
    listTrash: async () => ({ items: page(trashed), nextCursor: null }),
    deleteItem: async (id: string, options: { permanent: boolean }) => {
      expect(options).toEqual({ permanent: true });
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;
      if (id === fail) throw new Error('index refused');
      deleted.push(id);
    },
  } as unknown as IndexClient;
  return { client, deleted, most: () => most, inFlight: () => inFlight };
}

const item = (id: string, ownerId = 'me') => ({ id, ownerId }) as Item;

describe('purgeOwnItems', () => {
  it('deletes the person’s own live and trashed items for good, several at a time, and only theirs', async () => {
    const live = Array.from({ length: 25 }, (_, i) => item(`l${i}`));
    const index = fakeIndex([...live, item('theirs', 'other')], [item('t1')]);
    expect(await purgeOwnItems(index.client, 'liveplanner', 'me')).toEqual({
      count: 26,
      more: false,
    });
    expect(index.deleted.sort()).toEqual([...live.map((i) => i.id), 't1'].sort());
    expect(index.most()).toBe(ROOM_PURGE_CONCURRENCY);
  });

  it('stops after its pages and says some are left', async () => {
    const live = Array.from({ length: OWN_PURGE_PAGE * OWN_PURGE_PAGES + 1 }, (_, i) =>
      item(`l${i}`),
    );
    const index = fakeIndex(live);
    expect(await purgeOwnItems(index.client, 'liveplanner', 'me')).toEqual({
      count: OWN_PURGE_PAGE * OWN_PURGE_PAGES,
      more: true,
    });
  });

  it('fails on a refused delete once its batch has settled', async () => {
    const index = fakeIndex([item('a'), item('b'), item('c')], [], 'b');
    await expect(purgeOwnItems(index.client, 'liveplanner', 'me')).rejects.toThrow('index refused');
    expect(index.inFlight()).toBe(0);
    expect(index.deleted.sort()).toEqual(['a', 'c']);
  });
});
