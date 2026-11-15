import { describe, expect, it } from 'vitest';
import {
  LAST_SEEN_MAX_AGE_MS,
  LAST_SEEN_MAX_CHARS,
  LAST_SEEN_MAX_COPIES,
  createLastSeenCopies,
  lastSeenKey,
  type LastSeenInput,
} from './last-seen-copies';
import type { LastSeenEntry, LastSeenRecord, LastSeenStore } from './last-seen-store';

// The last seen copy (livediagram's docs/specs/006-document/offline-mode.md "Warm open of a cloud document"): kept per
// reader, read back only for them, pruned to the limits, forgotten on lost access and cleared on sign-out.

function memoryStore() {
  const rows = new Map<string, unknown>();
  const store: LastSeenStore = {
    get: async (key) => rows.get(key),
    put: async (key, record) => {
      rows.set(key, record);
      return true;
    },
    remove: async (keys) => {
      for (const key of keys) rows.delete(key);
    },
    entries: async () =>
      [...rows].flatMap(([key, value]): LastSeenEntry[] => {
        const r = value as Partial<LastSeenRecord>;
        return [{ key, reader: String(r.reader), seenAt: Number(r.seenAt), via: r.via ?? null }];
      }),
    clear: async () => rows.clear(),
  };
  return { store, rows };
}

type Item = { id: string; ownerId: string; name: string };
type Tab = { id: string; elements: unknown[] };

const input = (over: Partial<LastSeenInput<Item, Tab>> = {}): LastSeenInput<Item, Tab> => ({
  reader: 'user_a',
  itemId: 'd1',
  item: { id: 'd1', ownerId: 'user_a', name: 'Plan' },
  firstTab: { id: 't1', rev: 4, tab: { id: 't1', elements: [{ id: 'e1' }] } },
  via: null,
  access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  ...over,
});

function harness(start = 1_000) {
  let clock = start;
  const { store, rows } = memoryStore();
  const copies = createLastSeenCopies<Item, Tab>(store, { now: () => clock });
  return { copies, rows, tick: (ms: number) => (clock += ms) };
}

describe('createLastSeenCopies', () => {
  it('keeps a copy and reads it back for the same reader only', async () => {
    const h = harness();
    await h.copies.remember(input());
    expect(await h.copies.read('user_a', 'd1')).toEqual({
      reader: 'user_a',
      itemId: 'd1',
      seenAt: 1_000,
      item: { id: 'd1', ownerId: 'user_a', name: 'Plan' },
      firstTab: { id: 't1', rev: 4, tab: { id: 't1', elements: [{ id: 'e1' }] } },
      via: null,
      access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
    });
    expect(await h.copies.read('user_b', 'd1')).toBeNull();
    expect(await h.copies.read('user_a', 'd2')).toBeNull();
    expect([...h.rows.keys()]).toEqual([lastSeenKey('user_a', 'd1')]);
  });

  it('keeps each role as the arrival had it: Editor, Participant and Viewer', async () => {
    const h = harness();
    for (const [itemId, role] of [
      ['edit-link', 'edit'],
      ['participate-link', 'participate'],
      ['view-link', 'view'],
    ] as const) {
      await h.copies.remember(
        input({
          itemId,
          via: 'code',
          access: { role, isOwner: false, sessionShareCode: 'code', tabScope: 't1' },
        }),
      );
      expect((await h.copies.read('user_a', itemId))?.access).toEqual({
        role,
        isOwner: false,
        sessionShareCode: 'code',
        tabScope: 't1',
      });
      expect((await h.copies.read('user_a', itemId))?.via).toBe('code');
    }
  });

  it('never reads a role higher than it was kept', async () => {
    const h = harness();
    await h.copies.remember(
      input({ access: { role: 'owner', isOwner: true, sessionShareCode: null, tabScope: null } }),
    );
    expect((await h.copies.read('user_a', 'd1'))?.access.role).toBe('view');
  });

  it('keeps a copy with no first tab when the eager fetch failed', async () => {
    const h = harness();
    await h.copies.remember(input({ firstTab: null }));
    expect((await h.copies.read('user_a', 'd1'))?.firstTab).toBeNull();
  });

  it('replaces the older copy of the same item, with the newer time', async () => {
    const h = harness();
    await h.copies.remember(input());
    h.tick(50);
    await h.copies.remember(input({ item: { id: 'd1', ownerId: 'user_a', name: 'Renamed' } }));
    const copy = await h.copies.read('user_a', 'd1');
    expect(copy?.item.name).toBe('Renamed');
    expect(copy?.seenAt).toBe(1_050);
    expect(h.rows.size).toBe(1);
  });

  it("prunes every other reader's copies on a keep, so a browser holds one reader's at most", async () => {
    const h = harness();
    await h.copies.remember(input({ reader: 'user_a' }));
    await h.copies.remember(input({ reader: 'guest_1' }));
    expect([...h.rows.keys()]).toEqual([lastSeenKey('guest_1', 'd1')]);
  });

  it('prunes copies past the age limit, and never reads one', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'old' }));
    h.tick(LAST_SEEN_MAX_AGE_MS + 1);
    expect(await h.copies.read('user_a', 'old')).toBeNull();
    expect(h.rows.size).toBe(0);
    await h.copies.remember(input({ itemId: 'old' }));
    h.tick(LAST_SEEN_MAX_AGE_MS + 1);
    await h.copies.remember(input({ itemId: 'new' }));
    expect([...h.rows.keys()]).toEqual([lastSeenKey('user_a', 'new')]);
  });

  it('prunes the oldest seen past the count limit', async () => {
    const h = harness();
    for (let i = 0; i <= LAST_SEEN_MAX_COPIES; i++) {
      await h.copies.remember(input({ itemId: `d${i}` }));
      h.tick(1);
    }
    expect(h.rows.size).toBe(LAST_SEEN_MAX_COPIES);
    expect(h.rows.has(lastSeenKey('user_a', 'd0'))).toBe(false);
    expect(h.rows.has(lastSeenKey('user_a', `d${LAST_SEEN_MAX_COPIES}`))).toBe(true);
  });

  it('keeps no copy over the size limit, and drops the older one so it cannot read stale', async () => {
    const h = harness();
    await h.copies.remember(input());
    const big = { id: 't1', elements: ['x'.repeat(LAST_SEEN_MAX_CHARS)] };
    await h.copies.remember(input({ firstTab: { id: 't1', rev: 5, tab: big } }));
    expect(await h.copies.read('user_a', 'd1')).toBeNull();
    expect(h.rows.size).toBe(0);
  });

  it('forgets one copy when its reader lost the item, pruning as it goes', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'd1' }));
    await h.copies.remember(input({ itemId: 'd2' }));
    await h.copies.forget('user_a', 'd1');
    expect(await h.copies.read('user_a', 'd1')).toBeNull();
    expect(await h.copies.read('user_a', 'd2')).not.toBeNull();
    // A forget under another reader (a sign-out elsewhere, then a guest load) prunes the account's copies too.
    await h.copies.forget('guest_1', 'd9');
    expect(h.rows.size).toBe(0);
  });

  // A link's own address (`/<route>/shared?s=<code>`) names no item: its copy is found by the code it came by.
  it('reads the newest copy a share code kept, for its reader only', async () => {
    const h = harness();
    expect(await h.copies.readVia('user_a', 'CODE')).toBeNull();
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    h.tick(10);
    await h.copies.remember(input({ itemId: 'd2', via: 'CODE' }));
    await h.copies.remember(input({ itemId: 'd3' }));
    expect((await h.copies.readVia('user_a', 'CODE'))?.itemId).toBe('d2');
    expect(await h.copies.readVia('user_a', 'OTHER')).toBeNull();
    expect(await h.copies.readVia('user_b', 'CODE')).toBeNull();
    // Seen again, d1 is the newest though the store lists it first.
    h.tick(10);
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    expect((await h.copies.readVia('user_a', 'CODE'))?.itemId).toBe('d1');
  });

  it('reads no copy by a code when its record is not a copy this code wrote', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    const key = lastSeenKey('user_a', 'd1');
    h.rows.set(key, { ...(h.rows.get(key) as LastSeenRecord), body: '{' });
    expect(await h.copies.readVia('user_a', 'CODE')).toBeNull();
    // The bad record went: nothing is listed under the code any more.
    expect(h.rows.size).toBe(0);
  });

  it('reads no copy by a code whose body names another way in', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    const key = lastSeenKey('user_a', 'd1');
    const kept = h.rows.get(key) as LastSeenRecord;
    h.rows.set(key, { ...kept, body: kept.body.replace('"via":"CODE"', '"via":null') });
    expect(await h.copies.readVia('user_a', 'CODE')).toBeNull();
  });

  it('forgets every copy a share code kept when its reader lost what it opens', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    await h.copies.remember(input({ itemId: 'd2', via: 'OTHER' }));
    await h.copies.remember(input({ itemId: 'd3' }));
    await h.copies.forgetVia('user_b', 'CODE');
    // A forget under another reader prunes this reader's copies, as forget does: keep them again.
    await h.copies.remember(input({ itemId: 'd1', via: 'CODE' }));
    await h.copies.remember(input({ itemId: 'd2', via: 'OTHER' }));
    await h.copies.remember(input({ itemId: 'd3' }));
    await h.copies.forgetVia('user_a', 'CODE');
    expect(await h.copies.read('user_a', 'd1')).toBeNull();
    expect(await h.copies.read('user_a', 'd2')).not.toBeNull();
    expect(await h.copies.read('user_a', 'd3')).not.toBeNull();
  });

  it('forgets every copy on sign-out', async () => {
    const h = harness();
    await h.copies.remember(input({ itemId: 'd1' }));
    await h.copies.remember(input({ itemId: 'd2' }));
    await h.copies.forgetAll();
    expect(h.rows.size).toBe(0);
    // Nobody's copies after sign-out: the warm open expects no account.
    expect(await h.copies.lastReader()).toBeNull();
  });

  it('answers whose copies the store holds: the reader of the newest copy', async () => {
    const h = harness();
    expect(await h.copies.lastReader()).toBeNull();
    await h.copies.remember(input({ itemId: 'd1' }));
    h.tick(10);
    await h.copies.remember(input({ itemId: 'd2' }));
    h.tick(10);
    // Seen again, d1 is the newest though the store lists it first.
    await h.copies.remember(input({ itemId: 'd1' }));
    expect(await h.copies.lastReader()).toBe('user_a');
    // A new reader's keep prunes the old one's copies: the store holds the newest reader's.
    h.tick(10);
    await h.copies.remember(input({ reader: 'guest_1', itemId: 'd3' }));
    expect(await h.copies.lastReader()).toBe('guest_1');
  });

  it('reads a record that is not a copy as none, and removes it', async () => {
    const key = lastSeenKey('user_a', 'd1');
    const good = { v: 1, reader: 'user_a', itemId: 'd1', seenAt: 1_000 };
    const body = (over: Record<string, unknown>) =>
      JSON.stringify({
        item: { id: 'd1' },
        firstTab: null,
        via: null,
        access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
        ...over,
      });
    const access = (over: Record<string, unknown>) => ({
      role: 'edit',
      isOwner: true,
      sessionShareCode: null,
      tabScope: null,
      ...over,
    });
    const bad: unknown[] = [
      null,
      'text',
      { ...good, v: 2, body: body({}) },
      { ...good, reader: 'user_b', body: body({}) },
      { ...good, itemId: 'd2', body: body({}) },
      { ...good, seenAt: 'soon', body: body({}) },
      { ...good, body: 42 },
      { ...good, body: '{not json' },
      { ...good, body: '"a string"' },
      { ...good, body: body({ item: null }) },
      { ...good, body: body({ access: 'edit' }) },
      { ...good, body: body({ via: 7 }) },
      { ...good, body: body({ access: access({ sessionShareCode: 3 }) }) },
      { ...good, body: body({ access: access({ tabScope: false }) }) },
      { ...good, body: body({ firstTab: 'tab' }) },
      { ...good, body: body({ firstTab: { id: 1, rev: 1, tab: {} } }) },
      { ...good, body: body({ firstTab: { id: 't1', rev: '1', tab: {} } }) },
      { ...good, body: body({ firstTab: { id: 't1', rev: 1, tab: null } }) },
    ];
    for (const record of bad) {
      const h = harness();
      h.rows.set(key, record);
      expect(await h.copies.read('user_a', 'd1')).toBeNull();
      expect(h.rows.size).toBe(0);
    }
    // A stored isOwner that is not exactly true reads as not the owner.
    const h = harness();
    h.rows.set(key, { ...good, body: body({ access: access({ isOwner: 'yes' }) }) });
    expect((await h.copies.read('user_a', 'd1'))?.access.isOwner).toBe(false);
  });
});
