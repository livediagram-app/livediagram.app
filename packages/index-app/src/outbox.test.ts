import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_MOVES_MAX,
  COLLAB_MAX_THREADS,
  IndexError,
  type IndexAppClient,
} from '@liveworkspace/index-client';
import {
  capCollabPush,
  CARD_MOVED_KIND,
  cardMoveKeyOf,
  cardMoveOf,
  DRAIN_TABS,
  drainIndexOutbox,
  editedOf,
  editKeyOf,
  dueOutboxRows,
  FLUSH_IDLE_MS,
  FLUSH_MIN_GAP_MS,
  FLUSH_RETRY_MS,
  flushAfterWrite,
  nextFlushAt,
  nextOutboxFlushAt,
  OUTBOX_MAX_ATTEMPTS,
  outboxDueAt,
  outboxRetrySchema,
  pushFailureOf,
  readOutbox,
  recordItemEditor,
  RETRY_MAX_MS,
  retryDelayMs,
  settleOutbox,
  type SqlExec,
} from './outbox';
import { ItemDb } from './item-db';
import { nodeItemSql, nodeSql, nodeTransaction } from './test-sqlite';

const sqlite = (): SqlExec => nodeSql();

function fakeIndex(fail: (kind: string) => unknown = () => null) {
  const calls = {
    summary: [] as unknown[],
    collab: [] as string[],
    events: [] as unknown[],
    moves: [] as unknown[][],
  };
  const client = {
    pushSummary: async (_id: string, summary: unknown) => {
      const err = fail('summary');
      if (err) throw err;
      calls.summary.push(summary);
    },
    pushCollab: async (_id: string, tab: string) => {
      const err = fail('collab');
      if (err) throw err;
      calls.collab.push(tab);
    },
    pushEvents: async (_id: string, events: unknown[]) => {
      const err = fail('events');
      if (err) throw err;
      calls.events.push(...events);
    },
    pushCardMoves: async (_id: string, moves: unknown[]) => {
      const err = fail('moves');
      if (err) throw err;
      calls.moves.push(moves);
    },
  } as unknown as IndexAppClient;
  return { client, calls };
}

const source = {
  collab: async () => ({ threads: [], actions: [] }),
  summary: async () => ({ summary: { elements: 1 }, updatedAt: 5, ownerId: 'user_a' }),
};

const row = (id: number, kind: string, key = '') => ({ id, kind, key });

describe('the outbox', () => {
  it("keeps one edit per person per item in an app's own outbox table", () => {
    const sql = sqlite();
    sql.exec('CREATE TABLE outbox (id INTEGER PRIMARY KEY, plan_id TEXT, kind TEXT, key TEXT)');
    const exec = (q: string, ...b: (string | number)[]) => sql.exec(q, ...b);
    const outbox = { table: 'outbox', itemColumn: 'plan_id' };
    recordItemEditor(exec, outbox, 'P', 'user_a', 1);
    recordItemEditor(exec, outbox, 'Q', 'user_a', 2);
    recordItemEditor(exec, outbox, 'P', 'user_a', 3);
    recordItemEditor(exec, outbox, 'P', 'user_ab', 4);
    const rows = sql.exec('SELECT plan_id, key FROM outbox ORDER BY id').toArray();
    expect(rows).toEqual([
      { plan_id: 'Q', key: 'user_a@2' },
      { plan_id: 'P', key: 'user_a@3' },
      { plan_id: 'P', key: 'user_ab@4' },
    ]);
  });

  it('pushes everything once', async () => {
    const rows = [row(1, 'summary'), row(2, 'tab', 't1'), row(3, 'edit', editKeyOf('user_a', 7))];
    const { client, calls } = fakeIndex();
    const onSummary = vi.fn(async () => {});
    const out = await drainIndexOutbox('I', rows, client, { ...source, onSummary });
    expect(out).toEqual({ done: [1, 2, 3], failed: [], pushes: 3, more: false });
    expect(calls.events).toEqual([{ type: 'edited', actorId: 'user_a', at: 7 }]);
    expect(onSummary).toHaveBeenCalledWith('user_a', 5);
  });

  it('keeps what failed, and drops what the index no longer holds', async () => {
    const { client } = fakeIndex((kind) =>
      kind === 'collab'
        ? new Error('down')
        : kind === 'summary'
          ? new IndexError(404, 'not_found')
          : null,
    );
    const rows = [row(1, 'summary'), row(2, 'tab', 't1')];
    const out = await drainIndexOutbox('I', rows, client, source);
    expect(out.done).toEqual([1]);
    expect(out.failed).toEqual([{ ids: [2], error: new Error('down') }]);
  });

  it(`takes at most ${DRAIN_TABS} tabs a drain`, async () => {
    const rows = Array.from({ length: DRAIN_TABS + 5 }, (_, i) => row(i + 1, 'tab', `t${i}`));
    const { client, calls } = fakeIndex();
    const out = await drainIndexOutbox('I', rows, client, source);
    expect(out.more).toBe(true);
    expect(out.done).toHaveLength(DRAIN_TABS);
    expect(calls.collab).toHaveLength(DRAIN_TABS);
  });

  it(`pushes card moves together, at most ${CARD_MOVES_MAX} a drain, dropping keys that don't parse`, async () => {
    const move = (i: number) =>
      row(
        i,
        CARD_MOVED_KIND,
        cardMoveKeyOf({
          cardId: `c${i}`,
          cardKey: i,
          card: 'Fix',
          from: 'To Do',
          to: 'Done',
          at: i,
        }),
      );
    const rows = [
      ...Array.from({ length: CARD_MOVES_MAX + 2 }, (_, i) => move(i + 1)),
      row(900, CARD_MOVED_KIND, 'not json'),
    ];
    const { client, calls } = fakeIndex();
    const out = await drainIndexOutbox('I', rows, client, source);
    expect(out.more).toBe(true);
    expect(out.pushes).toBe(1);
    expect(calls.moves).toHaveLength(1);
    expect(calls.moves[0]).toHaveLength(CARD_MOVES_MAX);
    expect(calls.moves[0]![0]).toEqual({
      cardId: 'c1',
      cardKey: 1,
      card: 'Fix',
      from: 'To Do',
      to: 'Done',
      at: 1,
    });
    expect(out.done).toHaveLength(CARD_MOVES_MAX);
    // The bad key is past the cap this drain; alone, it is done without a push.
    const again = await drainIndexOutbox(
      'I',
      [row(900, CARD_MOVED_KIND, 'not json')],
      client,
      source,
    );
    expect(again).toEqual({ done: [900], failed: [], pushes: 0, more: false });
  });

  it('keeps card moves whose push failed', async () => {
    const { client } = fakeIndex((kind) => (kind === 'moves' ? new Error('down') : null));
    const key = cardMoveKeyOf({ cardId: 'c', cardKey: null, card: 'x', from: 'a', to: 'b', at: 1 });
    const out = await drainIndexOutbox('I', [row(1, CARD_MOVED_KIND, key)], client, source);
    expect(out.done).toEqual([]);
    expect(out.failed).toEqual([{ ids: [1], error: new Error('down') }]);
  });

  it('drops every key without an index', async () => {
    expect((await drainIndexOutbox('I', [row(1, 'summary')], null, source)).done).toEqual([1]);
  });
});

describe('helpers', () => {
  it('reads edit keys back, refusing malformed ones', () => {
    expect(editedOf(editKeyOf('guest_x', 9))).toEqual({
      type: 'edited',
      actorId: 'guest_x',
      at: 9,
    });
    expect(editedOf('@9')).toBeNull();
    expect(editedOf('user_a@soon')).toBeNull();
  });

  it('writes and reads card move keys, cutting long text and refusing malformed ones', () => {
    const long = 'x'.repeat(300);
    const key = cardMoveKeyOf({
      cardId: 'c',
      cardKey: 3,
      card: long,
      from: long,
      to: long,
      actorName: long,
      at: 9,
    });
    expect(cardMoveOf(key)).toEqual({
      cardId: 'c',
      cardKey: 3,
      card: 'x'.repeat(200),
      from: 'x'.repeat(200),
      to: 'x'.repeat(200),
      actorName: 'x'.repeat(200),
      at: 9,
    });
    const plain = { cardId: 'c', cardKey: null, card: 'a', from: 'b', to: 'c', at: 1 };
    expect(cardMoveOf(cardMoveKeyOf({ ...plain, actorName: null }))).toEqual(plain);
    expect(cardMoveOf(JSON.stringify({ ...plain, cardKey: 'seven' }))).toEqual(plain);
    expect(cardMoveOf('null')).toBeNull();
    expect(cardMoveOf('{')).toBeNull();
    for (const field of ['cardId', 'card', 'from', 'to', 'at'])
      expect(cardMoveOf(JSON.stringify({ ...plain, [field]: undefined }))).toBeNull();
  });

  it('caps a collab push to the newest', () => {
    const threads = Array.from(
      { length: COLLAB_MAX_THREADS + 3 },
      (_, i) => ({ latestAt: i }) as never,
    );
    const capped = capCollabPush({ threads, actions: [] });
    expect(capped.threads).toHaveLength(COLLAB_MAX_THREADS);
    expect((capped.threads[0] as { latestAt: number }).latestAt).toBe(COLLAB_MAX_THREADS + 2);
  });

  it('waits for idle and at most once a minute', () => {
    expect(nextFlushAt(1_000_000, 0)).toBe(1_000_000 + FLUSH_IDLE_MS);
    expect(nextFlushAt(1_000_000, 990_000)).toBe(990_000 + FLUSH_MIN_GAP_MS);
  });
});

// ---------- When a push fails ----------------------------------------------------------------------------------

// An app's outbox as a room keeps it: its own SQLite behind the D1-shaped facade, made before the retry columns
// existed, then given them by the app's schema step.
function appOutbox() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    `CREATE TABLE outbox (id INTEGER PRIMARY KEY, plan_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
       UNIQUE (plan_id, kind, key))`,
  );
  const insert = (kind: string, key = '') =>
    Number(
      raw.prepare('INSERT INTO outbox (plan_id, kind, key) VALUES (?, ?, ?)').run('P', kind, key)
        .lastInsertRowid,
    );
  const db = new ItemDb(nodeItemSql(raw), {
    transaction: nodeTransaction(raw),
    ensureSchema: () => {},
    onWrite: () => {},
  }).asD1();
  const stored = () =>
    raw.prepare('SELECT id, kind, attempts, retry_at FROM outbox ORDER BY id').all();
  return { raw, db, insert, stored, sql: nodeSql(raw) };
}

const PLAN_OUTBOX = { table: 'outbox', itemColumn: 'plan_id' } as const;

describe('when a push fails', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits a minute, doubling, at most an hour', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual(
      [1, 2, 4, 8, 16, 32].map((m) => m * 60_000),
    );
    expect(retryDelayMs(7)).toBe(RETRY_MAX_MS);
    expect(retryDelayMs(OUTBOX_MAX_ATTEMPTS)).toBe(RETRY_MAX_MS);
    expect(retryDelayMs(0)).toBe(FLUSH_RETRY_MS);
  });

  it('takes 404 as done, 400, 403, 413 and 422 as final, and anything else as worth another try', () => {
    expect(pushFailureOf(new IndexError(404, 'not_found'))).toBe('gone');
    for (const status of [400, 403, 413, 422])
      expect(pushFailureOf(new IndexError(status, 'x'))).toBe('final');
    for (const status of [401, 408, 409, 429, 500, 502, 503])
      expect(pushFailureOf(new IndexError(status, 'x'))).toBe('retry');
    expect(pushFailureOf(new Error('network'))).toBe('retry');
  });

  it('reads a key stored before the retry columns as never tried', async () => {
    const box = appOutbox();
    const id = box.insert('summary');
    box.raw.exec(outboxRetrySchema(['outbox']));
    expect(await readOutbox(box.db, PLAN_OUTBOX, 'P')).toEqual([
      { id, kind: 'summary', key: '', attempts: 0, retry_at: 0 },
    ]);
    expect(outboxDueAt(box.sql)).toBe(0);
    // A row as an older reader hands it, without the columns, is due too.
    expect(dueOutboxRows([row(1, 'summary')], 0)).toHaveLength(1);
  });

  it('settles a mixed drain: done and 404 deleted, a 5xx waiting, a 400 parked at once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = appOutbox();
    box.raw.exec(outboxRetrySchema(['outbox']));
    const summary = box.insert('summary');
    const tab = box.insert('tab', 't1');
    const edit = box.insert('edit', editKeyOf('user_a', 7));
    const moved = box.insert(
      CARD_MOVED_KIND,
      cardMoveKeyOf({ cardId: 'c', cardKey: 1, card: 'x', from: 'a', to: 'b', at: 1 }),
    );
    const { client } = fakeIndex((kind) =>
      kind === 'summary'
        ? new IndexError(404, 'not_found')
        : kind === 'collab'
          ? new IndexError(503, 'unavailable')
          : kind === 'events'
            ? new IndexError(400, 'invalid_events')
            : null,
    );
    const now = Date.now();
    const rows = dueOutboxRows(await readOutbox(box.db, PLAN_OUTBOX, 'P'), now);
    const outcome = await drainIndexOutbox('P', rows, client, source);
    expect(await settleOutbox(box.db, PLAN_OUTBOX, 'P', rows, outcome, now)).toEqual({
      retried: 1,
      parked: 1,
    });
    expect(box.stored()).toEqual([
      { id: tab, kind: 'tab', attempts: 1, retry_at: now + 60_000 },
      { id: edit, kind: 'edit', attempts: OUTBOX_MAX_ATTEMPTS, retry_at: 0 },
    ]);
    expect(box.stored().some((r) => r.id === summary || r.id === moved)).toBe(false);
    expect(warn).toHaveBeenCalledWith('[outbox] push failed', {
      itemId: 'P',
      keys: 1,
      error: 'IndexError: index: 503 unavailable',
    });
    expect(warn).toHaveBeenCalledWith('[outbox] parked', {
      itemId: 'P',
      reason: 'refused',
      kinds: ['edit'],
      keys: 1,
      error: 'IndexError: index: 400 invalid_events',
    });
    // The parked key is neither read nor owed; the waiting one is owed when its wait is over.
    expect((await readOutbox(box.db, PLAN_OUTBOX, 'P')).map((r) => r.id)).toEqual([tab]);
    expect(outboxDueAt(box.sql)).toBe(now + 60_000);
    expect(dueOutboxRows(await readOutbox(box.db, PLAN_OUTBOX, 'P'), now + 59_999)).toEqual([]);
  });

  it(`backs off to the hour and parks a key after ${OUTBOX_MAX_ATTEMPTS} failures, until a write replaces it`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = appOutbox();
    box.raw.exec(outboxRetrySchema(['outbox']));
    box.insert('summary');
    const { client, calls } = fakeIndex((kind) => (kind === 'summary' ? new Error('down') : null));
    const waits: number[] = [];
    let pushes = 0;
    // The room's alarm: each drain at the earliest a key may go, over a day.
    for (let at = outboxDueAt(box.sql); at !== null && at < 86_400_000; at = outboxDueAt(box.sql)) {
      vi.setSystemTime(Math.max(at, Date.now()));
      const now = Date.now();
      const rows = dueOutboxRows(await readOutbox(box.db, PLAN_OUTBOX, 'P'), now);
      const outcome = await drainIndexOutbox('P', rows, client, source);
      pushes += outcome.pushes;
      await settleOutbox(box.db, PLAN_OUTBOX, 'P', rows, outcome, now);
      const next = outboxDueAt(box.sql);
      if (next !== null) waits.push(next - now);
    }
    // Twelve pushes in about six hours, not 1,440 a day.
    expect(pushes).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(waits).toEqual(
      Array.from({ length: OUTBOX_MAX_ATTEMPTS - 1 }, (_, i) => retryDelayMs(i + 1)),
    );
    expect(Math.max(...waits)).toBe(RETRY_MAX_MS);
    expect(calls.summary).toEqual([]);
    expect(warn).toHaveBeenLastCalledWith('[outbox] parked', {
      itemId: 'P',
      reason: 'attempts',
      kinds: ['summary'],
      keys: 1,
      error: 'Error: down',
    });
    expect(outboxDueAt(box.sql)).toBeNull();
    expect(box.stored()).toHaveLength(1);
    // The next save rewrites the key (the triggers delete and insert it): a fresh key, owed at once.
    box.raw.exec("DELETE FROM outbox WHERE kind = 'summary'");
    box.insert('summary');
    expect(outboxDueAt(box.sql)).toBe(0);
  });

  it('settles a gone media push as done, and writes nothing when there is nothing to settle', async () => {
    const box = appOutbox();
    box.raw.exec(outboxRetrySchema(['outbox']));
    const media = box.insert('media');
    const batch = vi.spyOn(box.db, 'batch');
    const rows = await readOutbox(box.db, PLAN_OUTBOX, 'P');
    expect(await settleOutbox(box.db, PLAN_OUTBOX, 'P', rows, { done: [], failed: [] }, 0)).toEqual(
      { retried: 0, parked: 0 },
    );
    expect(batch).not.toHaveBeenCalled();
    await settleOutbox(
      box.db,
      PLAN_OUTBOX,
      'P',
      rows,
      { done: [], failed: [{ ids: [media], error: new IndexError(404, 'not_found') }] },
      0,
    );
    expect(box.stored()).toEqual([]);
  });

  it('counts a key the drain did not read as on its first failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = appOutbox();
    box.raw.exec(outboxRetrySchema(['outbox']));
    const id = box.insert('media');
    await settleOutbox(
      box.db,
      PLAN_OUTBOX,
      'P',
      [],
      { done: [], failed: [{ ids: [id], error: new Error('down') }] },
      5,
    );
    expect(box.stored()).toEqual([{ id, kind: 'media', attempts: 1, retry_at: 5 + 60_000 }]);
  });

  it('schedules the room: on idle and once a minute, never before a wait is over, never for parked keys', () => {
    const box = appOutbox();
    box.raw.exec(outboxRetrySchema(['outbox']));
    const now = 10_000_000;
    // Nothing owed: no drain.
    expect(nextOutboxFlushAt(box.sql, now, 0)).toBeNull();
    expect(flushAfterWrite(box.sql, null, now, 0)).toBeNull();
    const waiting = box.insert('tab', 't1');
    box.raw
      .prepare('UPDATE outbox SET attempts = 5, retry_at = ? WHERE id = ?')
      .run(now + RETRY_MAX_MS, waiting);
    const parked = box.insert('edit', editKeyOf('user_a', 1));
    box.raw.prepare('UPDATE outbox SET attempts = ? WHERE id = ?').run(OUTBOX_MAX_ATTEMPTS, parked);
    // Only the waiting key is owed, at the end of its wait.
    expect(nextOutboxFlushAt(box.sql, now, 0)).toBe(now + RETRY_MAX_MS);
    // A drain set at the usual pace stays, without a read.
    expect(flushAfterWrite(box.sql, now + FLUSH_MIN_GAP_MS, now, 0)).toBeNull();
    // A drain set at the waiting key's end stays while nothing fresher is owed.
    expect(flushAfterWrite(box.sql, now + RETRY_MAX_MS, now, 0)).toBeNull();
    // A fresh key: the far-off drain gives way to the usual pace (idle, and a minute after the last drain).
    box.insert('summary');
    expect(flushAfterWrite(box.sql, now + RETRY_MAX_MS, now, now - 1_000)).toBe(
      now - 1_000 + FLUSH_MIN_GAP_MS,
    );
    expect(flushAfterWrite(box.sql, null, now, 0)).toBe(now + FLUSH_IDLE_MS);
  });
});
