import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it, vi } from 'vitest';
import type { LastSeenInput } from './last-seen-copies';
import {
  LAST_SEEN_REFRESH_MS,
  createLastSeenFollower,
  type LastSeenFollowerEnv,
  type LastSeenSummary,
} from './last-seen-follower';

type Item = { id: string; name: string; tabs: (LastSeenSummary & { documentId?: string })[] };
type Tab = { id: string; name: string; folder?: string; elements: string[] };

const summary = (id: string, name: string, orderIndex: number, extra = {}) => ({
  id,
  documentId: 'd1',
  name,
  orderIndex,
  ...extra,
});

const copy = (over: Partial<LastSeenInput<Item, unknown>> = {}): LastSeenInput<Item, unknown> => ({
  reader: 'user_a',
  itemId: 'd1',
  item: { id: 'd1', name: 'Plan', tabs: [summary('t1', 'One', 0), summary('t2', 'Two', 1)] },
  firstTab: { id: 't1', rev: 3, tab: { id: 't1', name: 'One', elements: ['a'] } },
  via: null,
  access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  ...over,
});

const tab = (id: string, name: string, elements: string[] = [], folder?: string): Tab =>
  folder === undefined ? { id, name, elements } : { id, name, elements, folder };

// A follower over recording copies and a hand-driven clock.
function setup() {
  const written: LastSeenInput<Item, unknown>[] = [];
  const copies = {
    remember: vi.fn(async (c: LastSeenInput<Item, unknown>) => {
      written.push(c);
    }),
    read: vi.fn(async () => null),
    readVia: vi.fn(async () => null),
    lastReader: vi.fn(async () => null),
    forget: vi.fn(async () => {}),
    forgetVia: vi.fn(async () => {}),
    forgetAll: vi.fn(async () => {}),
  };
  let pending: { run: () => void; ms: number } | null = null;
  const hides: (() => void)[] = [];
  const env: LastSeenFollowerEnv = {
    setTimer: (run, ms) => {
      pending = { run, ms };
      return pending;
    },
    clearTimer: (handle) => {
      if (handle === pending) pending = null;
    },
    onPageHide: (flush) => hides.push(flush),
  };
  const follower = createLastSeenFollower<Item>(copies, { env });
  const fire = () => {
    const p = pending;
    pending = null;
    p?.run();
  };
  return {
    follower,
    copies,
    written,
    fire,
    hide: () => hides.forEach((h) => h()),
    hides,
    pending: () => pending,
  };
}

describe('createLastSeenFollower', () => {
  it('keeps a copy at once and reads through to the copies', async () => {
    const { follower, copies, written } = setup();
    await follower.remember(copy());
    expect(written).toHaveLength(1);
    expect(follower.follows('user_a', 'd1')).toBe(true);
    await follower.read('user_a', 'd1');
    expect(copies.read).toHaveBeenCalledWith('user_a', 'd1');
    await follower.lastReader();
    expect(copies.lastReader).toHaveBeenCalledOnce();
    await follower.readVia('user_a', 'CODE');
    expect(copies.readVia).toHaveBeenCalledWith('user_a', 'CODE');
  });

  it('stops following a copy a share code kept when its reader lost what the code opens', async () => {
    const { follower, copies, written, fire } = setup();
    await follower.remember(copy({ via: 'CODE' }));
    follower.followMeta('user_a', 'd1', { name: 'A', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    await follower.forgetVia('user_b', 'CODE');
    await follower.forgetVia('user_a', 'OTHER');
    expect(follower.follows('user_a', 'd1')).toBe(true);
    await follower.forgetVia('user_a', 'CODE');
    fire();
    expect(written).toHaveLength(1);
    expect(follower.follows('user_a', 'd1')).toBe(false);
    expect(copies.forgetVia).toHaveBeenCalledWith('user_a', 'CODE');
  });

  it('follows the name and the tab list: a rename, a tab added, moved, deleted and put in a folder', async () => {
    const { follower, written, fire, pending } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', {
      name: 'Plan 2',
      tabs: [tab('t1', 'One'), tab('t2', 'Two')],
    });
    expect(pending()?.ms).toBe(LAST_SEEN_REFRESH_MS);
    fire();
    expect(written[1]!.item.name).toBe('Plan 2');
    // Each summary keeps what the load answered for its id.
    expect(written[1]!.item.tabs[0]).toEqual(summary('t1', 'One', 0));

    follower.followMeta('user_a', 'd1', {
      name: 'Plan 2',
      tabs: [tab('t1', 'One', [], 'Ideas'), tab('t3', 'Three'), tab('t2', 'Two')],
    });
    fire();
    expect(written[2]!.item.tabs).toEqual([
      summary('t1', 'One', 0, { folder: 'Ideas' }),
      { id: 't3', name: 'Three', orderIndex: 1 },
      summary('t2', 'Two', 2),
    ]);

    follower.followMeta('user_a', 'd1', {
      name: 'Plan 2',
      tabs: [tab('t1', 'One'), tab('t2', 'Two')],
    });
    fire();
    expect(written[3]!.item.tabs).toEqual([summary('t1', 'One', 0), summary('t2', 'Two', 1)]);
    expect(written[3]!.item.tabs[0]).not.toHaveProperty('folder');
  });

  it('writes nothing for a follow that changed nothing', async () => {
    const { follower, written, pending } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', {
      name: 'Plan',
      tabs: [tab('t1', 'One'), tab('t2', 'Two')],
    });
    expect(pending()).toBeNull();
    expect(written).toHaveLength(1);
  });

  it('renames the first tab body with its tab, and drops it when another tab now loads first', async () => {
    const { follower, written, fire } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', {
      name: 'Plan',
      tabs: [tab('t1', 'Uno'), tab('t2', 'Two')],
    });
    fire();
    expect(written[1]!.firstTab).toEqual({
      id: 't1',
      rev: 3,
      tab: { id: 't1', name: 'Uno', elements: ['a'] },
    });
    follower.followMeta('user_a', 'd1', {
      name: 'Plan',
      tabs: [tab('t2', 'Two'), tab('t1', 'Uno')],
    });
    fire();
    expect(written[2]!.firstTab).toBeNull();
  });

  it('drops the first tab body when its tab is deleted, also under a tab scope', async () => {
    const { follower, written, fire } = setup();
    await follower.remember(
      copy({ access: { role: 'view', isOwner: false, sessionShareCode: 's', tabScope: 't1' } }),
    );
    follower.followMeta('user_a', 'd1', { name: 'Plan', tabs: [tab('t2', 'Two')] });
    fire();
    expect(written[1]!.firstTab).toBeNull();
  });

  it('keeps a body without a name as it was', async () => {
    const { follower, written, fire } = setup();
    await follower.remember(copy({ firstTab: { id: 't1', rev: 1, tab: { id: 't1' } } }));
    follower.followMeta('user_a', 'd1', {
      name: 'Plan',
      tabs: [tab('t1', 'Uno'), tab('t2', 'Two')],
    });
    fire();
    expect(written[1]!.firstTab).toEqual({ id: 't1', rev: 1, tab: { id: 't1' } });
  });

  it("follows the first tab's landed save with the revision it wrote", async () => {
    const { follower, written, fire } = setup();
    await follower.remember(copy());
    const tabs = [tab('t1', 'One', ['a', 'b']), tab('t2', 'Two')];
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs, revs: new Map([['t1', 4]]) });
    fire();
    expect(written[1]!.firstTab).toEqual({ id: 't1', rev: 4, tab: tabs[0] });
  });

  it('fills a dropped first tab when a save of the new first tab lands', async () => {
    const { follower, written, fire } = setup();
    await follower.remember(copy({ firstTab: null }));
    const tabs = [tab('t1', 'One', ['z']), tab('t2', 'Two')];
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs, revs: new Map([['t1', 1]]) });
    fire();
    expect(written[1]!.firstTab).toEqual({ id: 't1', rev: 1, tab: tabs[0] });
  });

  it("leaves the body alone for another tab's save, a save without a revision or an older one", async () => {
    const { follower, written, pending } = setup();
    await follower.remember(copy());
    const tabs = [tab('t1', 'One', ['new']), tab('t2', 'Two', ['x'])];
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs, revs: new Map([['t2', 9]]) });
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs, revs: new Map() });
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs, revs: new Map([['t1', 2]]) });
    expect(pending()).toBeNull();
    expect(written).toHaveLength(1);
    // A landing whose tab list has no first tab at all changes the list only.
    follower.followSave('user_a', 'd1', { name: 'Plan', tabs: [], revs: new Map([['t1', 8]]) });
    expect(pending()).not.toBeNull();
  });

  it('gathers follows into one write of the newest copy per window', async () => {
    const { follower, copies, written, fire } = setup();
    await follower.remember(copy());
    for (let i = 0; i < 5; i++) {
      follower.followMeta('user_a', 'd1', {
        name: `Plan ${i}`,
        tabs: [tab('t1', 'One'), tab('t2', 'Two')],
      });
    }
    fire();
    expect(copies.remember).toHaveBeenCalledTimes(2);
    expect(written[1]!.item.name).toBe('Plan 4');
    // Nothing waiting: a second fire or flush writes nothing.
    fire();
    await follower.flush();
    expect(copies.remember).toHaveBeenCalledTimes(2);
  });

  it('flushes a waiting refresh when the page is hidden, listening once', async () => {
    const { follower, written, hide, hides, pending } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', { name: 'A', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    follower.followMeta('user_a', 'd1', { name: 'B', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    hide();
    expect(written[1]!.item.name).toBe('B');
    expect(pending()).toBeNull();
    follower.followMeta('user_a', 'd1', { name: 'C', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    expect(hides).toHaveLength(1);
  });

  it("never follows another reader's or document's copy, nor any before a keep", async () => {
    const { follower, written, pending } = setup();
    const meta = { name: 'X', tabs: [tab('t1', 'One')] };
    follower.followMeta('user_a', 'd1', meta);
    expect(follower.follows('user_a', 'd1')).toBe(false);
    await follower.remember(copy());
    follower.followMeta('guest_b', 'd1', meta);
    follower.followMeta('user_a', 'd2', meta);
    follower.followSave('guest_b', 'd1', { ...meta, revs: new Map([['t1', 9]]) });
    expect(pending()).toBeNull();
    expect(written).toHaveLength(1);
    expect(follower.follows('guest_b', 'd1')).toBe(false);
  });

  it("writes a waiting refresh before keeping another document's copy", async () => {
    const { follower, written, pending } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', {
      name: 'Last',
      tabs: [tab('t1', 'One'), tab('t2', 'Two')],
    });
    await follower.remember(copy({ itemId: 'd2' }));
    expect(written.map((c) => [c.itemId, c.item.name])).toEqual([
      ['d1', 'Plan'],
      ['d1', 'Last'],
      ['d2', 'Plan'],
    ]);
    expect(pending()).toBeNull();
    expect(follower.follows('user_a', 'd2')).toBe(true);
  });

  it('drops a waiting refresh on sign-out and on a forget of the followed copy', async () => {
    const { follower, copies, written, fire } = setup();
    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', { name: 'A', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    await follower.forgetAll();
    fire();
    expect(written).toHaveLength(1);
    expect(follower.follows('user_a', 'd1')).toBe(false);
    expect(copies.forgetAll).toHaveBeenCalled();

    await follower.remember(copy());
    follower.followMeta('user_a', 'd1', { name: 'B', tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
    await follower.forget('user_a', 'd2');
    expect(follower.follows('user_a', 'd1')).toBe(true);
    await follower.forget('user_a', 'd1');
    fire();
    expect(written).toHaveLength(2);
    expect(copies.forget).toHaveBeenCalledWith('user_a', 'd1');
  });

  it('runs on the browser timers and page events by default', async () => {
    vi.useFakeTimers();
    try {
      const copies = {
        remember: vi.fn(async () => {}),
        read: vi.fn(async () => null),
        readVia: vi.fn(async () => null),
        lastReader: vi.fn(async () => null),
        forget: vi.fn(async () => {}),
        forgetVia: vi.fn(async () => {}),
        forgetAll: vi.fn(async () => {}),
      };
      const listeners: Record<string, () => void> = {};
      vi.stubGlobal('window', {
        addEventListener: (type: string, fn: () => void) => (listeners[`w:${type}`] = fn),
      });
      const doc = {
        visibilityState: 'visible',
        addEventListener: (type: string, fn: () => void) => (listeners[`d:${type}`] = fn),
      };
      vi.stubGlobal('document', doc);
      const follower = createLastSeenFollower<Item>(copies);
      await follower.remember(copy());
      const meta = (name: string) => ({ name, tabs: [tab('t1', 'One'), tab('t2', 'Two')] });
      follower.followMeta('user_a', 'd1', meta('A'));
      vi.advanceTimersByTime(LAST_SEEN_REFRESH_MS);
      expect(copies.remember).toHaveBeenCalledTimes(2);
      follower.followMeta('user_a', 'd1', meta('B'));
      listeners['d:visibilitychange']!();
      expect(copies.remember).toHaveBeenCalledTimes(2);
      doc.visibilityState = 'hidden';
      listeners['d:visibilitychange']!();
      expect(copies.remember).toHaveBeenCalledTimes(3);
      follower.followMeta('user_a', 'd1', meta('C'));
      listeners['w:pagehide']!();
      expect(copies.remember).toHaveBeenCalledTimes(4);
      // A refresh cancelled by a forget clears its timer.
      follower.followMeta('user_a', 'd1', meta('D'));
      await follower.forgetAll();
      vi.advanceTimersByTime(LAST_SEEN_REFRESH_MS);
      expect(copies.remember).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('listens to no page events without a window', async () => {
    vi.useFakeTimers();
    try {
      const copies = {
        remember: vi.fn(async () => {}),
        read: vi.fn(async () => null),
        readVia: vi.fn(async () => null),
        lastReader: vi.fn(async () => null),
        forget: vi.fn(async () => {}),
        forgetVia: vi.fn(async () => {}),
        forgetAll: vi.fn(async () => {}),
      };
      const follower = createLastSeenFollower<Item>(copies);
      await follower.remember(copy());
      follower.followMeta('user_a', 'd1', { name: 'A', tabs: [] });
      vi.advanceTimersByTime(LAST_SEEN_REFRESH_MS);
      expect(copies.remember).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a follow of an unchanged 200-tab list cheap (10,000 follows within budget)', async () => {
    const { follower } = setup();
    const tabs = Array.from({ length: 200 }, (_, i) => tab(`t${i}`, `Tab ${i}`));
    await follower.remember(
      copy({
        item: { id: 'd1', name: 'Plan', tabs: tabs.map((t, i) => summary(t.id, t.name, i)) },
        firstTab: null,
      }),
    );
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i++) follower.followMeta('user_a', 'd1', { name: 'Plan', tabs });
    });
    expect(ms).toBeLessThan(500);
  });
});
