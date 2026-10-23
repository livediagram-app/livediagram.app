import { describe, expect, it } from 'vitest';
import { createItemHeadSync, itemHeadOf, type ItemHead } from './item-head';

function memoryStore(initial: ItemHead | null) {
  let stored = initial;
  const counts = { reads: 0, writes: 0 };
  return {
    counts,
    get stored() {
      return stored;
    },
    set stored(head: ItemHead | null) {
      stored = head;
    },
    store: {
      read: async () => {
        counts.reads++;
        return stored;
      },
      write: async (head: ItemHead) => {
        counts.writes++;
        stored = head;
      },
    },
  };
}

describe('itemHeadOf', () => {
  it('names the owner and team a grant carries', () => {
    expect(itemHeadOf({ owner: 'user_a', team: 't1' })).toEqual({
      ownerId: 'user_a',
      teamId: 't1',
    });
  });

  it('is null for a grant that names no owner', () => {
    expect(itemHeadOf({ team: 't1' })).toBeNull();
    expect(itemHeadOf({ owner: null, team: null })).toBeNull();
  });
});

describe('createItemHeadSync', () => {
  it("takes a guest's merge into an account from the next grant", async () => {
    const m = memoryStore({ ownerId: 'guest_g', teamId: null });
    const sync = createItemHeadSync(m.store);
    expect(await sync.sync({ owner: 'user_u', team: null })).toEqual({
      ownerId: 'user_u',
      teamId: null,
    });
    expect(m.stored).toEqual({ ownerId: 'user_u', teamId: null });
  });

  it('takes a move to another team, and back to the owner', async () => {
    const m = memoryStore({ ownerId: 'user_u', teamId: null });
    const sync = createItemHeadSync(m.store);
    await sync.sync({ owner: 'user_u', team: 'team_1' });
    expect(m.stored).toEqual({ ownerId: 'user_u', teamId: 'team_1' });
    await sync.sync({ owner: 'user_u', team: null });
    expect(m.stored).toEqual({ ownerId: 'user_u', teamId: null });
  });

  it('reads the stored copy once, then answers agreeing grants from memory', async () => {
    const m = memoryStore({ ownerId: 'user_u', teamId: 't1' });
    const sync = createItemHeadSync(m.store);
    for (let i = 0; i < 1_000; i++) await sync.sync({ owner: 'user_u', team: 't1' });
    expect(m.counts).toEqual({ reads: 1, writes: 0 });
  });

  it('reads and writes once for grants that arrive together', async () => {
    const m = memoryStore({ ownerId: 'guest_g', teamId: null });
    const sync = createItemHeadSync(m.store);
    await Promise.all(Array.from({ length: 20 }, () => sync.sync({ owner: 'user_u', team: null })));
    expect(m.counts).toEqual({ reads: 1, writes: 1 });
  });

  it('changes nothing for a grant with no owner, or an item not started', async () => {
    const m = memoryStore({ ownerId: 'user_u', teamId: null });
    const sync = createItemHeadSync(m.store);
    expect(await sync.sync({ team: 'team_1' })).toBeNull();
    expect(m.counts).toEqual({ reads: 0, writes: 0 });
    const empty = memoryStore(null);
    expect(await createItemHeadSync(empty.store).sync({ owner: 'user_u', team: null })).toBeNull();
    expect(empty.counts.writes).toBe(0);
  });

  it('reads again after forget, when the app changed the copy itself', async () => {
    const m = memoryStore({ ownerId: 'user_u', teamId: null });
    const sync = createItemHeadSync(m.store);
    await sync.sync({ owner: 'user_u', team: null });
    m.stored = { ownerId: 'anonymised', teamId: null };
    sync.forget();
    await sync.sync({ owner: 'user_u', team: null });
    expect(m.stored).toEqual({ ownerId: 'user_u', teamId: null });
  });

  it('tries again after a failed write', async () => {
    const m = memoryStore({ ownerId: 'guest_g', teamId: null });
    let fail = true;
    const sync = createItemHeadSync({
      read: m.store.read,
      write: async (head) => {
        if (fail) throw new Error('storage');
        return m.store.write(head);
      },
    });
    await expect(sync.sync({ owner: 'user_u', team: null })).rejects.toThrow('storage');
    fail = false;
    await sync.sync({ owner: 'user_u', team: null });
    expect(m.stored).toEqual({ ownerId: 'user_u', teamId: null });
  });
});
