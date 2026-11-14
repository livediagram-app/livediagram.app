import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  LEDGER_FLOOR_KEY,
  LEDGER_GET_BATCH,
  LEDGER_INDEXED_KEY,
  LEDGER_INDEX_PREFIX,
  LEDGER_MARK_EVERY_MS,
  LEDGER_MARKS_KEY,
  LEDGER_RECENT_MS,
  LEDGER_RETENTION_MS,
  LEDGER_UPKEEP_PAGE,
  LEDGER_VALUE_MAX_CHARS,
  RoomLedgerStore,
  type LedgerRules,
  type LedgerStorage,
} from './room-ledger-store';

// A product's ledger in miniature: an element's notes (each the latest per id, with the seq that set it, as answers,
// ticks and comments are) and a tab's dots (accumulated, as a vote round is).
type Entry = { notes?: Record<string, { text: string; seq: number }>; dots?: string[] };
type Ledger = { elements: Record<string, Entry>; dots?: Entry };
type Op = {
  kind: 'note' | 'dot' | 'boom';
  tabId: string;
  elementId?: string;
  id?: string;
  text?: string;
};

const rules: LedgerRules<Entry, Ledger> = {
  ledgerKey: (op) => {
    const o = op as Op;
    if (o.kind === 'dot') return `ledger:${o.tabId}:vote`;
    if (o.kind === 'note' || o.kind === 'boom') return `ledger:${o.tabId}:el:${o.elementId}`;
    return null;
  },
  ledgerPrefix: (tabId) => `ledger:${tabId}:`,
  recordInLedger: (prev, op, seq) => {
    const o = op as Op;
    if (o.kind === 'boom') throw new Error('boom');
    if (o.kind === 'dot') return { dots: [...(prev?.dots ?? []), o.id!] };
    if (!o.text) return null;
    return { notes: { ...(prev?.notes ?? {}), [o.id!]: { text: o.text, seq } } };
  },
  tabLedgerFrom: (tabId, entries) => {
    const ledger: Ledger = { elements: {} };
    for (const [key, value] of entries) {
      const rest = key.slice(`ledger:${tabId}:`.length);
      if (rest === 'vote') ledger.dots = value as Entry;
      else ledger.elements[rest.slice(3)] = value as Entry;
    }
    return ledger;
  },
  ledgerEntryAccumulates: (key) => key.endsWith(':vote'),
};

// The merge a save makes, in miniature: every note the saver hadn't seen (seq past its cursor) is re-applied.
function merge(saved: Record<string, Record<string, string>>, ledger: Ledger, since: number) {
  const out = structuredClone(saved);
  for (const [el, entry] of Object.entries(ledger.elements)) {
    for (const [id, n] of Object.entries(entry.notes ?? {})) {
      if (n.seq > since) (out[el] ??= {})[id] = n.text;
    }
  }
  return out;
}

// DO storage as the runtime keeps it: sorted keys, `startAfter` and `limit` honoured. Counts what each call costs.
function makeStorage(opts: { honoursCursor?: boolean } = {}) {
  const store = new Map<string, unknown>();
  // `listed` and `got` are the rows each call read: what DO storage bills, and what the room deserialises.
  const counts = { puts: 0, deletes: 0, lists: 0, listed: 0, got: 0 };
  const get = (key: string | string[]) => {
    if (!Array.isArray(key)) return Promise.resolve(structuredClone(store.get(key)));
    if (key.length > LEDGER_GET_BATCH) throw new Error('past the runtime batch limit');
    const found = key.filter((k) => store.has(k));
    counts.got += found.length;
    return Promise.resolve(new Map(found.map((k) => [k, structuredClone(store.get(k))])));
  };
  const storage: LedgerStorage = {
    get: get as LedgerStorage['get'],
    put: (key, value) => {
      counts.puts++;
      store.set(key, structuredClone(value));
      return Promise.resolve();
    },
    delete: (key) => {
      counts.deletes++;
      return Promise.resolve(store.delete(key));
    },
    list: ({ prefix, startAfter, limit }) => {
      counts.lists++;
      let keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (opts.honoursCursor !== false) {
        if (startAfter !== undefined) keys = keys.filter((k) => k > startAfter);
        if (limit !== undefined) keys = keys.slice(0, limit);
      } else {
        // A test double that ignores the cursor, and the order too.
        keys.reverse();
      }
      counts.listed += keys.length;
      return Promise.resolve(new Map(keys.map((k) => [k, structuredClone(store.get(k))])));
    },
  };
  return { storage, store, counts };
}

// The ledger's entries and floor, and its index rows, each sorted.
const entryKeys = (store: Map<string, unknown>) =>
  [...store.keys()].filter((k) => k.startsWith('ledger:') || k === LEDGER_FLOOR_KEY).sort();
const indexRows = (store: Map<string, unknown>) =>
  [...store.keys()].filter((k) => k.startsWith(LEDGER_INDEX_PREFIX)).sort();

const DAY = 24 * 60 * 60 * 1000;
const note = (elementId: string, id: string, text: string, tabId = 't1'): Op => ({
  kind: 'note',
  tabId,
  elementId,
  id,
  text,
});

function setup(opts: { honoursCursor?: boolean } = {}) {
  const s = makeStorage(opts);
  let now = 1_000 * DAY;
  const ledger = new RoomLedgerStore(s.storage, rules, () => now);
  return {
    ...s,
    ledger,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RoomLedgerStore: recording', () => {
  it('stamps each entry with the op that last changed it, and hands the product the entry without it', async () => {
    const { ledger, store, now } = setup();
    const record = vi.spyOn(rules, 'recordInLedger');
    ledger.record(note('a', 'n1', 'one'), 1);
    ledger.record(note('a', 'n2', 'two'), 2);
    await ledger.settled();
    expect(store.get('ledger:t1:el:a')).toEqual({
      notes: { n1: { text: 'one', seq: 1 }, n2: { text: 'two', seq: 2 } },
      ledgerStamp: { seq: 2, at: now() },
    });
    expect(record.mock.calls[1]![0]).toEqual({ notes: { n1: { text: 'one', seq: 1 } } });
    expect(await ledger.read('t1')).toEqual({
      elements: { a: { notes: { n1: { text: 'one', seq: 1 }, n2: { text: 'two', seq: 2 } } } },
    });
  });

  it('skips an untracked op, a refused one, one past the value limit, and survives a throw', async () => {
    const { ledger, store } = setup();
    ledger.record({ kind: 'other', tabId: 't1' }, 1);
    ledger.record(note('a', 'n1', ''), 2);
    ledger.record(note('a', 'n1', 'x'.repeat(LEDGER_VALUE_MAX_CHARS)), 3);
    ledger.record({ kind: 'boom', tabId: 't1', elementId: 'a' }, 4);
    ledger.record(note('a', 'n2', 'kept'), 5);
    await ledger.settled();
    expect(entryKeys(store)).toEqual(['ledger:t1:el:a']);
    expect(indexRows(store)).toEqual(['ledger-seq:t1:0000000000000005:ledger:t1:el:a']);
    expect(store.get('ledger:t1:el:a')).toMatchObject({ notes: { n2: { text: 'kept', seq: 5 } } });
  });

  it('reads an entry stored before stamps as it is, and ignores a value that is not one', async () => {
    const { ledger, store } = setup();
    store.set('ledger:t1:el:old', { notes: { n0: { text: 'legacy', seq: 3 } } });
    store.set('ledger:t1:el:bad', 'not an entry');
    expect(await ledger.read('t1', 99)).toEqual({
      elements: { old: { notes: { n0: { text: 'legacy', seq: 3 } } } },
    });
    ledger.record(note('old', 'n1', 'new'), 100);
    await ledger.settled();
    expect(store.get('ledger:t1:el:old')).toMatchObject({ ledgerStamp: { seq: 100 } });
  });
});

describe("RoomLedgerStore: a save's read", () => {
  it('hands a save the entries changed after its cursor and every entry changed in the last day', async () => {
    const { ledger, advance } = setup();
    ledger.record(note('old', 'n1', 'month old'), 1);
    await ledger.settled();
    advance(40 * DAY);
    ledger.record(note('today', 'n2', 'this morning'), 2);
    await ledger.settled();
    advance(2 * 60 * 60 * 1000);
    ledger.record(note('unseen', 'n3', 'just now'), 3);
    await ledger.settled();
    // A saver at seq 2 had seen 'old' and 'today': only today's entry (recent) and the unseen one go.
    expect(Object.keys((await ledger.read('t1', 2)).elements).sort()).toEqual(['today', 'unseen']);
    // A saver that had seen nothing gets everything; no cursor reads everything.
    expect(Object.keys((await ledger.read('t1', 0)).elements).sort()).toEqual([
      'old',
      'today',
      'unseen',
    ]);
    expect(Object.keys((await ledger.read('t1')).elements)).toHaveLength(3);
    advance(LEDGER_RECENT_MS);
    expect(Object.keys((await ledger.read('t1', 3)).elements)).toEqual([]);
  });

  // The guarantee the filter rests on: whatever the saver's cursor, its merge with the entries it is handed equals
  // its merge with the whole ledger.
  it('merges a save exactly as the whole ledger would, for every cursor', async () => {
    const { ledger, advance } = setup();
    let seq = 0;
    for (let day = 0; day < 60; day++) {
      for (let i = 0; i < 3; i++)
        ledger.record(note(`el${(day * 7 + i) % 25}`, `n${seq}`, `d${day}`), ++seq);
      advance(DAY);
    }
    await ledger.settled();
    const whole = await ledger.read('t1');
    const snapshot = { el1: { stale: 'mine' } };
    for (let since = 0; since <= seq; since++) {
      expect(merge(snapshot, await ledger.read('t1', since), since)).toEqual(
        merge(snapshot, whole, since),
      );
    }
  });

  it('logs a cursor older than the newest entry the upkeep cut', async () => {
    const { ledger, advance, now } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ledger.record(note('a', 'n1', 'old'), 5);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS + DAY);
    await ledger.upkeep({ now: now(), seq: 5, tabs: new Set(['t1']) });
    await ledger.read('t1', 5);
    expect(warn).not.toHaveBeenCalled();
    await ledger.read('t1', 4);
    expect(warn).toHaveBeenCalledWith('[ledger] stale cursor', { tabId: 't1', since: 4, floor: 5 });
  });

  it('reads the floor a woken room stored, once', async () => {
    const { storage, store, counts } = setup();
    store.set(LEDGER_FLOOR_KEY, 9);
    const woken = new RoomLedgerStore(storage, rules);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = vi.spyOn(storage, 'get');
    await woken.read('t1', 3);
    await woken.read('t1', 4);
    expect(get.mock.calls.filter(([k]) => (k as unknown) === LEDGER_FLOOR_KEY)).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(counts.lists).toBe(2);
  });
});

describe('RoomLedgerStore: upkeep', () => {
  it('cuts what nobody has touched for 30 days, and keeps the rest', async () => {
    const { ledger, store, advance, now } = setup();
    ledger.record(note('stale', 'n1', 'old'), 1);
    ledger.record(note('stale', 'n1b', 'old', 't2'), 2);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS - DAY);
    ledger.record(note('fresh', 'n2', 'newer'), 3);
    await ledger.settled();
    advance(2 * DAY);
    expect(await ledger.upkeep({ now: now(), seq: 3, tabs: new Set(['t1', 't2']) })).toEqual({
      dropped: 2,
      stamped: 0,
    });
    expect(entryKeys(store)).toEqual([LEDGER_FLOOR_KEY, 'ledger:t1:el:fresh']);
    // The cut entries' index rows go with them.
    expect(indexRows(store)).toEqual(['ledger-seq:t1:0000000000000003:ledger:t1:el:fresh']);
    expect(store.get(LEDGER_FLOOR_KEY)).toBe(2);
  });

  it("keeps an accumulating entry while its tab lives, and cuts a deleted tab's", async () => {
    const { ledger, store, advance, now } = setup();
    ledger.record({ kind: 'dot', tabId: 'live', id: 'd1' }, 1);
    ledger.record({ kind: 'dot', tabId: 'gone', id: 'd2' }, 2);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS + DAY);
    expect(await ledger.upkeep({ now: now(), seq: 2, tabs: new Set(['live']) })).toEqual({
      dropped: 1,
      stamped: 0,
    });
    expect(store.has('ledger:live:vote')).toBe(true);
    expect(store.has('ledger:gone:vote')).toBe(false);
  });

  it('keeps every accumulating entry when the room cannot say which tabs it stores', async () => {
    const { ledger, store, advance, now } = setup();
    ledger.record({ kind: 'dot', tabId: 'a', id: 'd1' }, 1);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS + DAY);
    for (const tabs of [null, new Set<string>()]) {
      expect(await ledger.upkeep({ now: now(), seq: 1, tabs })).toEqual({ dropped: 0, stamped: 0 });
    }
    expect(store.has('ledger:a:vote')).toBe(true);
    expect(store.has(LEDGER_FLOOR_KEY)).toBe(false);
  });

  it('cuts every kind when the product names none as accumulating', async () => {
    const s = makeStorage();
    let now = 0;
    const { ledgerEntryAccumulates: _none, ...plain } = rules;
    const ledger = new RoomLedgerStore(s.storage, plain, () => now);
    ledger.record({ kind: 'dot', tabId: 'a', id: 'd1' }, 1);
    await ledger.settled();
    now = LEDGER_RETENTION_MS + 1;
    expect(await ledger.upkeep({ now, seq: 1, tabs: new Set(['a']) })).toEqual({
      dropped: 1,
      stamped: 0,
    });
  });

  it('stamps an entry from before stamps, which then ages from its first upkeep', async () => {
    const { ledger, store, advance, now } = setup();
    store.set('ledger:t1:el:legacy', { notes: { n: { text: 'x', seq: 4 } } });
    store.set('ledger:t1:el:junk', 7);
    expect(await ledger.upkeep({ now: now(), seq: 40, tabs: null })).toEqual({
      dropped: 0,
      stamped: 1,
    });
    expect(store.get('ledger:t1:el:legacy')).toEqual({
      notes: { n: { text: 'x', seq: 4 } },
      ledgerStamp: { seq: 40, at: now() },
    });
    advance(LEDGER_RETENTION_MS);
    expect(await ledger.upkeep({ now: now(), seq: 40, tabs: null })).toEqual({
      dropped: 1,
      stamped: 0,
    });
    expect(store.get(LEDGER_FLOOR_KEY)).toBe(40);
    expect(store.get('ledger:t1:el:junk')).toBe(7);
  });

  it('never lowers the floor', async () => {
    const { ledger, store, advance, now } = setup();
    store.set(LEDGER_FLOOR_KEY, 50);
    ledger.record(note('a', 'n', 'x'), 10);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS + 1);
    await ledger.upkeep({ now: now(), seq: 60, tabs: null });
    expect(store.get(LEDGER_FLOOR_KEY)).toBe(50);
  });

  it('pages through every key, also on a store that ignores the cursor', async () => {
    for (const honoursCursor of [true, false]) {
      const { ledger, store, counts, advance, now } = setup({ honoursCursor });
      const n = LEDGER_UPKEEP_PAGE * 2 + 5;
      for (let i = 0; i < n; i++)
        ledger.record(note(`e${String(i).padStart(4, '0')}`, 'n', 'x'), i + 1);
      await ledger.settled();
      // Nothing to cut: every page is read and kept.
      expect(await ledger.upkeep({ now: now(), seq: n, tabs: null })).toEqual({
        dropped: 0,
        stamped: 0,
      });
      advance(LEDGER_RETENTION_MS + 1);
      expect(await ledger.upkeep({ now: now(), seq: n, tabs: null })).toEqual({
        dropped: n,
        stamped: 0,
      });
      expect(entryKeys(store)).toEqual([LEDGER_FLOOR_KEY]);
      expect(indexRows(store)).toEqual([]);
      expect(counts.lists).toBe(honoursCursor ? 6 : 4);
    }
  });

  it('runs on the write chain: an op recorded before it lands first, and a failed upkeep stops nothing after it', async () => {
    const { ledger, storage, store, advance, now } = setup();
    ledger.record(note('a', 'n', 'x'), 1);
    await ledger.settled();
    advance(LEDGER_RETENTION_MS + 1);
    ledger.record(note('a', 'n2', 'y'), 2);
    expect(await ledger.upkeep({ now: now(), seq: 2, tabs: null })).toEqual({
      dropped: 0,
      stamped: 0,
    });
    vi.spyOn(storage, 'list').mockRejectedValueOnce(new Error('storage down'));
    await expect(ledger.upkeep({ now: now(), seq: 2, tabs: null })).rejects.toThrow('storage down');
    ledger.record(note('b', 'n', 'z'), 3);
    await ledger.settled();
    expect(store.has('ledger:t1:el:b')).toBe(true);
  });
});

// The cost a save pays on a long-lived tab: 90 days of comment threads on 1,000 elements, 10 of them touched today.
describe('RoomLedgerStore: a long-lived tab', () => {
  it('ships a save only what it can merge, and the upkeep bounds what the room keeps', async () => {
    const { ledger, counts, advance, now } = setup();
    let seq = 0;
    for (let day = 0; day < 90; day++) {
      for (let i = 0; i < 12; i++) {
        const el = `el${(day * 12 + i) % 1000}`;
        ledger.record(
          note(el, `c${seq}`, 'a comment of about sixty characters, like most people write'),
          ++seq,
        );
      }
      advance(DAY);
    }
    for (let i = 0; i < 10; i++) ledger.record(note(`el${i}`, `today${i}`, 'posted today'), ++seq);
    await ledger.settled();
    const whole = JSON.stringify(await ledger.read('t1'));
    const listedWhole = counts.listed;
    const forSave = JSON.stringify(await ledger.read('t1', seq));
    console.info('[ledger] long-lived tab', {
      keys: listedWhole,
      bytesBefore: whole.length,
      bytesAfter: forSave.length,
    });
    expect(listedWhole).toBe(1000);
    expect(forSave.length).toBeLessThan(whole.length / 40);
    // After the upkeep the room keeps only the last 30 days' elements, and has indexed them: a save reads the index
    // rows from the last day on and the ten entries it ships, not the tab's 372 entries.
    await ledger.upkeep({ now: now(), seq, tabs: new Set(['t1']) });
    const before = counts.listed + counts.got;
    expect(Object.keys((await ledger.read('t1', seq)).elements)).toHaveLength(10);
    expect(counts.listed + counts.got - before).toBeLessThanOrEqual(12 + 10 + 10);
  });

  // A busy board: every one of 1,000 elements touched in the last month, so the upkeep cuts nothing. Before the
  // index a save read all 1,000 entries (1,000 rows, 2.8 ms of CPU here) to ship the 10 touched today.
  it("reads a save's entries through the index, not the whole tab", async () => {
    const { ledger, counts, advance, now } = setup();
    let seq = 0;
    for (let day = 0; day < 30; day++) {
      for (let i = 0; i < 60; i++)
        ledger.record(
          note(`el${(day * 60 + i * 17) % 1000}`, `c${seq}`, 'a comment of about sixty characters'),
          ++seq,
        );
      await ledger.settled();
      advance(DAY / 2);
      await ledger.upkeep({ now: now(), seq, tabs: new Set(['t1']) });
      advance(DAY / 2);
    }
    for (let i = 0; i < 10; i++) ledger.record(note(`el${i}`, `today${i}`, 'posted today'), ++seq);
    await ledger.settled();
    const before = counts.listed + counts.got;
    expect(Object.keys((await ledger.read('t1', seq)).elements)).toHaveLength(10);
    const rows = counts.listed + counts.got - before;
    console.info('[ledger] busy board, rows per save', { entries: 1000, rows });
    expect(rows).toBeLessThanOrEqual(80);
    const cpu = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 20; i++) await ledger.read('t1', seq);
    });
    expect(cpu / 20).toBeLessThan(cpuBudgetMs(1));
  });
});

describe("RoomLedgerStore: the save's index", () => {
  // A room whose upkeep has run daily, so the index answers every read with a cursor.
  async function indexedRoom(opts: { honoursCursor?: boolean } = {}) {
    const room = setup(opts);
    let seq = 0;
    for (let day = 0; day < 40; day++) {
      for (let i = 0; i < 3; i++)
        room.ledger.record(note(`el${(day * 7 + i) % 25}`, `n${seq}`, `d${day}`), ++seq);
      room.ledger.record({ kind: 'dot', tabId: 't1', id: `dot${seq}` }, ++seq);
      room.ledger.record(note('x', `o${seq}`, 'other tab', 't2'), ++seq);
      await room.ledger.settled();
      room.advance(DAY / 3);
      await room.ledger.upkeep({ now: room.now(), seq, tabs: new Set(['t1', 't2']) });
      room.advance((2 * DAY) / 3);
    }
    return { ...room, seq };
  }

  it('merges a save exactly as the whole ledger would, for every cursor, on a store that honours the cursor or not', async () => {
    for (const honoursCursor of [true, false]) {
      const { ledger, storage, counts, seq, now } = await indexedRoom({ honoursCursor });
      // The same room read the way it was before the index: listing the tab.
      const get = ((key: string | string[]) =>
        key === LEDGER_INDEXED_KEY
          ? Promise.resolve(undefined)
          : storage.get(key as string)) as LedgerStorage['get'];
      const listing = new RoomLedgerStore({ ...storage, get }, rules, now);
      const whole = await ledger.read('t1');
      const snapshot = { el1: { stale: 'mine' } };
      for (let since = 0; since <= seq; since++) {
        const fromIndex = await ledger.read('t1', since);
        expect(fromIndex).toEqual(await listing.read('t1', since));
        expect(merge(snapshot, fromIndex, since)).toEqual(merge(snapshot, whole, since));
      }
      expect(counts.got).toBeGreaterThan(0);
    }
  });

  it('keeps one row per entry, at the seq that last changed it', async () => {
    const { ledger, store } = setup();
    ledger.record(note('a', 'n1', 'one'), 1);
    ledger.record(note('a', 'n2', 'two'), 2);
    ledger.record(note('b', 'n3', 'three'), 3);
    await ledger.settled();
    expect(indexRows(store)).toEqual([
      'ledger-seq:t1:0000000000000002:ledger:t1:el:a',
      'ledger-seq:t1:0000000000000003:ledger:t1:el:b',
    ]);
  });

  it('lists the tab until an upkeep has indexed what came before the index, then indexes it', async () => {
    const { ledger, store, counts, advance, now } = setup();
    // An entry written before the index: stamped, with no row, and one from before stamps.
    store.set('ledger:t1:el:old', {
      notes: { n0: { text: 'before', seq: 1 } },
      ledgerStamp: { seq: 1, at: now() },
    });
    store.set('ledger:t1:el:older', { notes: { n9: { text: 'unstamped', seq: 0 } } });
    ledger.record(note('new', 'n1', 'after'), 2);
    await ledger.settled();
    advance(2 * DAY);
    ledger.record(note('newer', 'n2', 'later'), 3);
    await ledger.settled();
    expect(Object.keys((await ledger.read('t1', 0)).elements).sort()).toEqual([
      'new',
      'newer',
      'old',
      'older',
    ]);
    expect(counts.got).toBe(0);
    await ledger.upkeep({ now: now(), seq: 3, tabs: null });
    expect(store.get(LEDGER_INDEXED_KEY)).toBe(true);
    expect(indexRows(store)).toEqual([
      'ledger-seq:t1:0000000000000001:ledger:t1:el:old',
      'ledger-seq:t1:0000000000000002:ledger:t1:el:new',
      'ledger-seq:t1:0000000000000003:ledger:t1:el:newer',
      'ledger-seq:t1:0000000000000003:ledger:t1:el:older',
    ]);
    advance(2 * DAY);
    expect(Object.keys((await ledger.read('t1', 0)).elements).sort()).toEqual([
      'new',
      'newer',
      'old',
      'older',
    ]);
    expect(counts.got).toBe(4);
    // A later upkeep writes no rows for what is already indexed.
    const puts = counts.puts;
    await ledger.upkeep({ now: now(), seq: 3, tabs: null });
    expect(counts.puts).toBe(puts);
  });

  it('lists the tab when no mark is a day old, or the index cannot place the tab', async () => {
    const { ledger, counts, advance, now } = setup();
    ledger.record(note('a', 'n1', 'one'), 1);
    ledger.record(note('a', 'n1', 'one', 'odd:tab'), 2);
    await ledger.settled();
    await ledger.upkeep({ now: now(), seq: 2, tabs: null });
    await ledger.read('t1', 1);
    expect(counts.got).toBe(0);
    advance(DAY + 1);
    await ledger.read('odd:tab', 1);
    expect(counts.got).toBe(0);
    await ledger.read('t1', 1);
    expect(counts.got).toBe(0);
    ledger.record(note('a', 'n2', 'two'), 3);
    await ledger.read('t1', 1);
    expect(counts.got).toBe(1);

    // A product whose tab prefix is not `ledger:<tab>:` reads the whole tab.
    const s = makeStorage();
    const other = new RoomLedgerStore(s.storage, {
      ...rules,
      ledgerPrefix: (tabId) => `ledger:${tabId}:x`,
    });
    s.store.set(LEDGER_INDEXED_KEY, true);
    s.store.set(LEDGER_MARKS_KEY, [{ seq: 0, at: 0 }]);
    await other.read('t1', 0);
    expect(s.counts.lists).toBe(1);
    expect(s.counts.got).toBe(0);
  });

  it('fetches entries in batches the runtime takes, and skips rows whose entry or time is gone', async () => {
    const { ledger, store, counts, advance } = setup();
    const n = LEDGER_GET_BATCH * 2 + 3;
    for (let i = 0; i < n; i++) ledger.record(note(`e${i}`, 'n', 'x'), i + 1);
    await ledger.settled();
    store.set(LEDGER_INDEXED_KEY, true);
    advance(2 * DAY);
    // An orphan row, and a row with no time (read as if recent).
    store.set('ledger-seq:t1:0000000000000001:ledger:t1:el:gone', 0);
    store.set(`ledger-seq:t1:${String(n).padStart(16, '0')}:ledger:t1:el:e0`, 'junk');
    const read = await ledger.read('t1', 0);
    expect(Object.keys(read.elements)).toHaveLength(n);
    expect(counts.got).toBe(n);
  });

  it('keeps a mark an hour at most, and only the last day of them plus the one before', async () => {
    const { ledger, store, advance } = setup();
    let seq = 0;
    for (let i = 0; i < 3 * 24 * 4; i++) {
      ledger.record(note('a', `n${i}`, 'x'), ++seq);
      advance(LEDGER_MARK_EVERY_MS / 4);
    }
    await ledger.settled();
    const marks = store.get(LEDGER_MARKS_KEY) as { seq: number; at: number }[];
    expect(marks.length).toBeGreaterThanOrEqual(24);
    expect(marks.length).toBeLessThanOrEqual(26);
    expect(marks[0]!.at).toBeLessThanOrEqual(marks.at(-1)!.at - LEDGER_RECENT_MS);
    expect(marks[1]!.at).toBeGreaterThan(marks.at(-1)!.at - LEDGER_RECENT_MS);
  });

  it('leaves out of the index a key that names no tab, and still stamps and cuts it', async () => {
    const s = makeStorage();
    let now = 0;
    const ledger = new RoomLedgerStore(
      s.storage,
      { ...rules, ledgerKey: () => 'ledger:loose' },
      () => now,
    );
    ledger.record(note('a', 'n', 'x'), 1);
    ledger.record(note('a', 'n2', 'y'), 2);
    await ledger.settled();
    s.store.set('ledger:legacy', { notes: {} });
    expect(indexRows(s.store)).toEqual([]);
    expect(await ledger.upkeep({ now, seq: 2, tabs: null })).toEqual({ dropped: 0, stamped: 1 });
    now = LEDGER_RETENTION_MS + 1;
    expect(await ledger.upkeep({ now, seq: 2, tabs: null })).toEqual({ dropped: 2, stamped: 0 });
    expect(indexRows(s.store)).toEqual([]);
  });

  it('ignores marks a woken room finds malformed', async () => {
    const { storage, store, counts } = setup();
    store.set(LEDGER_INDEXED_KEY, true);
    store.set(LEDGER_MARKS_KEY, [{ seq: 'x', at: 1 }, { seq: 1, at: 'x' }, null]);
    const woken = new RoomLedgerStore(storage, rules);
    await woken.read('t1', 0);
    expect(counts.got).toBe(0);
    store.set(LEDGER_MARKS_KEY, 'nope');
    await new RoomLedgerStore(storage, rules).read('t1', 0);
    expect(counts.lists).toBe(2);
  });
});

describe("RoomLedgerStore: a whole-tab write's lock read", () => {
  it('hands back the named entries whatever their seq, waiting for queued writes, never listing', async () => {
    const { ledger, store, counts } = setup();
    ledger.record(note('a', 'n1', 'one'), 1);
    ledger.record(note('b', 'n1', 'two'), 2);
    ledger.record({ kind: 'dot', tabId: 't1', id: 'v1' }, 3);
    store.set('ledger:t1:el:bad', 'not an entry');
    const lists = counts.lists;
    const read = await ledger.readKeys('t1', [
      'ledger:t1:el:a',
      'ledger:t1:el:a',
      'ledger:t1:vote',
      'ledger:t1:el:bad',
      'ledger:t1:el:missing',
      'ledger:t2:el:a',
    ]);
    expect(read).toEqual({
      elements: { a: { notes: { n1: { text: 'one', seq: 1 } } } },
      dots: { dots: ['v1'] },
    });
    expect(counts.lists).toBe(lists);
  });

  it('asks the runtime in batches it allows', async () => {
    const { ledger } = setup();
    for (let i = 0; i < LEDGER_GET_BATCH + 5; i++) ledger.record(note(`e${i}`, 'n', 'x'), i + 1);
    const keys = Array.from({ length: LEDGER_GET_BATCH + 5 }, (_, i) => `ledger:t1:el:e${i}`);
    const read = await ledger.readKeys('t1', keys);
    expect(Object.keys(read.elements)).toHaveLength(LEDGER_GET_BATCH + 5);
    expect((await ledger.readKeys('t1', [])).elements).toEqual({});
  });
});
