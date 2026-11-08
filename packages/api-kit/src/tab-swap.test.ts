import { describe, expect, it, vi } from 'vitest';
import {
  TAB_CAS_MAX_ATTEMPTS,
  TabChangeQueue,
  swapTabChange,
  swapTabChanges,
  type StoredTabRow,
  type TabChange,
  type TabSwapStore,
  type TabVersion,
  type TabWriteEnqueue,
} from './tab-swap';

// The room's tab row writes (each product's docs/specs/013-workspace/blueprints/share-roles.md "Behaviour and
// state"): a compare-and-swap on the row's version, and a per-tab drain that answers each change as it would alone.

type Tab = { id: string; name: string; items: string[] };

class TooLarge extends Error {}

// A row in memory: its version moves on every write, as the `tabs_rev_advances` trigger has it.
function memoryStore(items: string[] = [], cap = Infinity) {
  let row: StoredTabRow | null = { data: JSON.stringify({ items }), rev: 1, updatedAt: 100 };
  const calls = { reads: 0, writes: 0 };
  const store: TabSwapStore<Tab> = {
    tabId: 't1',
    read: async () => {
      calls.reads++;
      return row;
    },
    write: async (expected: TabVersion, data: string) => {
      if (data.length > cap) throw new TooLarge();
      if (!row || row.rev !== expected.rev || row.updatedAt !== expected.updatedAt) return false;
      calls.writes++;
      row = { data, rev: row.rev + 1, updatedAt: row.updatedAt + 1 };
      return true;
    },
    tooLarge: (error) => error instanceof TooLarge,
  };
  return {
    store,
    calls,
    stored: () => (row ? (JSON.parse(row.data) as { items: string[] }).items : null),
    bump: (items: string[]) => {
      row = { data: JSON.stringify({ items }), rev: row!.rev + 1, updatedAt: row!.updatedAt + 1 };
    },
    drop: () => {
      row = null;
    },
  };
}

const add =
  (item: string): TabChange<Tab, number> =>
  (tab) =>
    tab.items.includes(item)
      ? { next: null, answer: -1 }
      : { next: { ...tab, items: [...tab.items, item] }, answer: tab.items.length };

const boom: TabChange<Tab, number> = () => {
  throw new Error('rule threw');
};

describe('swapTabChanges', () => {
  it('reads once, applies every change in order, writes once', async () => {
    const m = memoryStore(['a']);
    const out = await swapTabChanges(m.store, [add('b'), add('a'), add('c')]);
    expect(out).toEqual([
      { ok: true, answer: 1 },
      { ok: true, answer: -1 },
      { ok: true, answer: 2 },
    ]);
    expect(m.stored()).toEqual(['a', 'b', 'c']);
    expect(m.calls).toEqual({ reads: 1, writes: 1 });
  });

  it('hands each change the tab with its id and no name, and stores neither', async () => {
    const m = memoryStore();
    const seen = vi.fn((tab: Tab) => ({ next: { ...tab, items: ['x'] }, answer: null }));
    await swapTabChanges(m.store, [seen]);
    expect(seen.mock.calls[0]![0]).toEqual({ items: [], id: 't1', name: '' });
    const write = vi.spyOn(m.store, 'write');
    await swapTabChanges(m.store, [add('y')]);
    expect(write.mock.calls[0]![1]).toBe(JSON.stringify({ items: ['x', 'y'] }));
    expect(write.mock.calls[0]![2]).toEqual({ items: ['x', 'y'] });
  });

  it('writes nothing when no change asks to', async () => {
    const m = memoryStore(['a']);
    expect(await swapTabChanges(m.store, [add('a')])).toEqual([{ ok: true, answer: -1 }]);
    expect(m.calls.writes).toBe(0);
  });

  it('fails a change that throws alone; the others land', async () => {
    const m = memoryStore();
    const out = await swapTabChanges(m.store, [add('a'), boom, add('b')]);
    expect(out[0]).toEqual({ ok: true, answer: 0 });
    expect(out[1]).toMatchObject({ ok: 'threw' });
    expect(out[2]).toEqual({ ok: true, answer: 1 });
    expect(m.stored()).toEqual(['a', 'b']);
  });

  it('re-reads and re-applies after another writer wins, then gives up with 409', async () => {
    const m = memoryStore();
    const write = m.store.write;
    let raced = false;
    m.store.write = async (expected, data, body) => {
      if (!raced) {
        raced = true;
        m.bump(['owner']);
      }
      return write(expected, data, body);
    };
    expect(await swapTabChanges(m.store, [add('p')])).toEqual([{ ok: true, answer: 1 }]);
    expect(m.stored()).toEqual(['owner', 'p']);
    expect(m.calls.reads).toBe(2);
    const lost = vi.fn(async () => false);
    m.store.write = lost;
    expect(await swapTabChanges(m.store, [add('q'), add('r')])).toEqual([
      { ok: false, status: 409 },
      { ok: false, status: 409 },
    ]);
    expect(lost).toHaveBeenCalledTimes(TAB_CAS_MAX_ATTEMPTS);
  });

  it('answers 404 for every change when the tab is gone', async () => {
    const m = memoryStore();
    m.drop();
    expect(await swapTabChanges(m.store, [add('a'), add('b')])).toEqual([
      { ok: false, status: 404 },
      { ok: false, status: 404 },
    ]);
  });

  it('answers each change alone when the drain is over the cap', async () => {
    // Room for two items: the third pushes the tab over, alone.
    const m = memoryStore([], JSON.stringify({ items: ['a', 'b'] }).length);
    const out = await swapTabChanges(m.store, [add('a'), add('b'), add('c')]);
    expect(out).toEqual([
      { ok: true, answer: 0 },
      { ok: true, answer: 1 },
      { ok: false, status: 413 },
    ]);
    expect(m.stored()).toEqual(['a', 'b']);
  });

  it('throws what the store throws that is not the cap', async () => {
    const m = memoryStore();
    m.store.write = async () => {
      throw new Error('disk');
    };
    await expect(swapTabChanges(m.store, [add('a')])).rejects.toThrow('disk');
  });
});

describe('swapTabChange', () => {
  it('answers one change, and throws its error', async () => {
    const m = memoryStore();
    expect(await swapTabChange(m.store, add('a'))).toEqual({ ok: true, answer: 0 });
    await expect(swapTabChange(m.store, boom)).rejects.toThrow('rule threw');
  });
});

function queueOf() {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = { calls: 0 };
  const run: TabWriteEnqueue = (step) => {
    enqueue.calls++;
    const next = tail.then(step);
    tail = next.catch(() => undefined);
    return next;
  };
  return { queue: new TabChangeQueue(run), enqueue };
}

describe('TabChangeQueue', () => {
  it('drains every change waiting for a tab in one read and one write, answering each in order', async () => {
    const m = memoryStore();
    const { queue, enqueue } = queueOf();
    const order: number[] = [];
    const results = await Promise.all(
      ['a', 'b', 'a', 'c'].map((item, i) =>
        queue
          .submit('t1', () => m.store, add(item))
          .then((r) => {
            order.push(i);
            return r;
          }),
      ),
    );
    expect(results).toEqual([
      { ok: true, answer: 0 },
      { ok: true, answer: 1 },
      { ok: true, answer: -1 },
      { ok: true, answer: 2 },
    ]);
    expect(order).toEqual([0, 1, 2, 3]);
    expect(m.calls).toEqual({ reads: 1, writes: 1 });
    expect(enqueue.calls).toBe(1);
  });

  it('starts a new drain for a change that arrives while one writes, and keeps tabs apart', async () => {
    const one = memoryStore();
    const two = memoryStore();
    const { queue, enqueue } = queueOf();
    const first = queue.submit('t1', () => one.store, add('a'));
    const other = queue.submit('t2', () => two.store, add('z'));
    await first;
    const second = queue.submit('t1', () => one.store, add('b'));
    expect(await second).toEqual({ ok: true, answer: 1 });
    expect(await other).toEqual({ ok: true, answer: 0 });
    expect(enqueue.calls).toBe(3);
    expect(one.stored()).toEqual(['a', 'b']);
  });

  it('rejects the change that threw alone, and every change when the write throws', async () => {
    const m = memoryStore();
    const { queue } = queueOf();
    const good = queue.submit('t1', () => m.store, add('a'));
    const bad = queue.submit('t1', () => m.store, boom);
    await expect(bad).rejects.toThrow('rule threw');
    expect(await good).toEqual({ ok: true, answer: 0 });
    m.store.write = async () => {
      throw new Error('disk');
    };
    const x = queue.submit('t1', () => m.store, add('x'));
    const y = queue.submit('t1', () => m.store, add('y'));
    await expect(x).rejects.toThrow('disk');
    await expect(y).rejects.toThrow('disk');
  });
});
