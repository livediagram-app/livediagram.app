import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LEDGER_FLOOR_KEY,
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
  const counts = { puts: 0, deletes: 0, lists: 0, listed: 0 };
  const storage: LedgerStorage = {
    get: <T>(key: string) => Promise.resolve(structuredClone(store.get(key)) as T | undefined),
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
    expect([...store.keys()]).toEqual(['ledger:t1:el:a']);
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
    expect(get.mock.calls.filter(([k]) => k === LEDGER_FLOOR_KEY)).toHaveLength(1);
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
    expect([...store.keys()].sort()).toEqual([LEDGER_FLOOR_KEY, 'ledger:t1:el:fresh']);
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
      expect([...store.keys()]).toEqual([LEDGER_FLOOR_KEY]);
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
    // After the upkeep the room keeps only the last 30 days' elements.
    await ledger.upkeep({ now: now(), seq, tabs: new Set(['t1']) });
    const before = counts.listed;
    await ledger.read('t1', seq);
    expect(counts.listed - before).toBeLessThanOrEqual(12 * 31);
  });
});
