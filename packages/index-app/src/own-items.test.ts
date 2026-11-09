import type { IndexClient, Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { OWN_PURGE_PAGE, OWN_PURGE_PAGES, purgeOwnItems } from './own-items';
import { ROOM_PURGE_CONCURRENCY } from './purge';

// An index over `live` and `trashed` items whose deletes take a turn of the event loop, counting how many run at once.
function fakeIndex(live: Item[], trashed: Item[] = [], fail?: string) {
  const deleted: string[] = [];
  let inFlight = 0;
  let most = 0;
  // Paged by a keyset cursor (the last id's place in the list as first read), as the index's: deleting an item
  // never shifts the next page.
  const order = new Map<string, number>();
  const page = (items: Item[], q: { cursor?: string; limit?: number }) => {
    for (const i of items) if (!order.has(i.id)) order.set(i.id, order.size);
    const after = q.cursor === undefined ? -1 : Number(q.cursor);
    const rest = items.filter((i) => !deleted.includes(i.id) && order.get(i.id)! > after);
    const slice = rest.slice(0, q.limit ?? OWN_PURGE_PAGE);
    const more = rest.length > slice.length;
    return { items: slice, nextCursor: more ? String(order.get(slice.at(-1)!.id)) : null };
  };
  const client = {
    listItems: async (q: { cursor?: string; limit?: number }) => page(live, q),
    listTrash: async (q: { cursor?: string; limit?: number }) => page(trashed, q),
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

  it('reads past a page holding none of the person’s own items', async () => {
    const others = Array.from({ length: OWN_PURGE_PAGE }, (_, i) => item(`o${i}`, 'other'));
    const index = fakeIndex([...others, item('mine')], [...others.slice(0, 1), item('t1')]);
    expect(await purgeOwnItems(index.client, 'liveplanner', 'me')).toEqual({
      count: 2,
      more: false,
    });
    expect(index.deleted.sort()).toEqual(['mine', 't1']);
  });

  it('finishes when its pages empty the listings under the cap', async () => {
    const live = Array.from({ length: OWN_PURGE_PAGE * (OWN_PURGE_PAGES - 1) }, (_, i) =>
      item(`l${i}`),
    );
    expect(await purgeOwnItems(fakeIndex(live).client, 'liveplanner', 'me')).toEqual({
      count: live.length,
      more: false,
    });
  });

  it('finishes at exactly its cap of live items, reading the Trash past the last page', async () => {
    const own = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => item(`${prefix}${i}`));
    const cap = OWN_PURGE_PAGE * OWN_PURGE_PAGES;
    expect(await purgeOwnItems(fakeIndex(own(cap, 'e')).client, 'liveplanner', 'me')).toEqual({
      count: cap,
      more: false,
    });
    const trashLeft = fakeIndex(own(cap, 'f'), own(1, 't'));
    expect(await purgeOwnItems(trashLeft.client, 'liveplanner', 'me')).toEqual({
      count: cap,
      more: true,
    });
    expect(trashLeft.deleted).not.toContain('t0');
  });

  it('fails on a refused delete once its batch has settled', async () => {
    const index = fakeIndex([item('a'), item('b'), item('c')], [], 'b');
    await expect(purgeOwnItems(index.client, 'liveplanner', 'me')).rejects.toThrow('index refused');
    expect(index.inFlight()).toBe(0);
    expect(index.deleted.sort()).toEqual(['a', 'c']);
  });
});
