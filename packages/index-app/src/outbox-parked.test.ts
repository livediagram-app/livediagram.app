import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { IndexError, type IndexAppClient } from '@liveworkspace/index-client';
import {
  CARD_MOVED_KIND,
  cardMoveKeyOf,
  drainIndexOutbox,
  dueOutboxRows,
  OUTBOX_MAX_ATTEMPTS,
  outboxDueAt,
  outboxRetrySchema,
  PARKED_RETRY_MS,
  readOutbox,
  RETRY_MAX_MS,
  settleOutbox,
} from './outbox';
import {
  healthyDrain,
  outboxParkingStep,
  PARKED_KEEP_MAX,
  PARKED_KEEP_MS,
  tendParkedOutbox,
} from './outbox-parked';
import { ItemDb } from './item-db';
import { nodeItemSql, nodeSql, nodeTransaction } from './test-sqlite';

// The outbox's parked keys (outbox-parked.ts; one-explorer-contracts.md "When a push fails"): let back in after a
// healthy drain at most once a day, dropped past 30 days and past the newest 500, and the next-due read indexed.

const OUTBOX = { table: 'outbox', itemColumn: 'plan_id' } as const;
const DAY = 24 * 60 * 60_000;

// An app's outbox as a room keeps it, made before the retry columns, with the parking step run on it.
function room({ retry = true }: { retry?: boolean } = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    `CREATE TABLE outbox (id INTEGER PRIMARY KEY, plan_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
       UNIQUE (plan_id, kind, key))`,
  );
  if (retry) raw.exec(outboxRetrySchema(['outbox']));
  const sql = nodeSql(raw);
  const schema = (q: string) => sql.exec(q);
  const db = new ItemDb(nodeItemSql(raw), {
    transaction: nodeTransaction(raw),
    ensureSchema: () => {},
    onWrite: () => {},
  }).asD1();
  // A write keys a thing as the room's triggers do: delete, then insert under a new id.
  const write = (kind: string, key = '') => {
    raw
      .prepare('DELETE FROM outbox WHERE plan_id = ? AND kind = ? AND key = ?')
      .run('P', kind, key);
    return Number(
      raw.prepare('INSERT INTO outbox (plan_id, kind, key) VALUES (?, ?, ?)').run('P', kind, key)
        .lastInsertRowid,
    );
  };
  const park = (count: number, parkedAt: number, retryAt = 0) => {
    const insert = raw.prepare(
      `INSERT INTO outbox (plan_id, kind, key, attempts, retry_at, parked_at) VALUES ('P', 'edit', ?, ?, ?, ?)`,
    );
    for (let i = 0; i < count; i++) insert.run(`p${i}@1`, OUTBOX_MAX_ATTEMPTS, retryAt, parkedAt);
  };
  const stored = () =>
    raw
      .prepare('SELECT id, kind, attempts, retry_at, parked_at FROM outbox ORDER BY id')
      .all()
      .map((r) => ({ ...r }));
  return { raw, sql, schema, db, write, park, stored };
}

function fakeIndex(fail: (kind: string) => unknown = () => null) {
  const calls = { summary: 0, moves: [] as unknown[] };
  const client = {
    pushSummary: async () => {
      const err = fail('summary');
      if (err) throw err;
      calls.summary++;
    },
    pushCardMoves: async (_id: string, moves: unknown[]) => {
      const err = fail('moves');
      if (err) throw err;
      calls.moves.push(...moves);
    },
  } as unknown as IndexAppClient;
  return { client, calls };
}

const source = {
  collab: async () => ({ threads: [], actions: [] }),
  summary: async () => ({ summary: { elements: 1 }, updatedAt: 5 }),
};

// One drain as a room runs it: the due keys sent, settled, then the parked ones tended.
async function drain(box: ReturnType<typeof room>, client: IndexAppClient, now: number) {
  const rows = dueOutboxRows(await readOutbox(box.db, OUTBOX, 'P'), now);
  const outcome = await drainIndexOutbox('P', rows, client, source);
  const settled = await settleOutbox(box.db, OUTBOX, 'P', rows, outcome, now);
  return tendParkedOutbox(box.db, OUTBOX, 'P', { ...outcome, parked: settled.parked }, now);
}

const move = cardMoveKeyOf({
  cardId: 'c1',
  cardKey: 7,
  card: 'Ship it',
  from: 'Doing',
  to: 'Done',
  at: 1,
});

describe('the parking schema step', () => {
  it('adds parked_at and the (attempts, retry_at) index, stamping the rows parked already, once', () => {
    const box = room();
    box.write('summary');
    box.raw
      .prepare(`INSERT INTO outbox (plan_id, kind, key, attempts) VALUES ('P', 'edit', 'a@1', ?)`)
      .run(OUTBOX_MAX_ATTEMPTS);
    const before = Date.now();
    outboxParkingStep(box.schema);
    const [fresh, parked] = box.stored() as { parked_at: number }[];
    expect(fresh!.parked_at).toBe(0);
    expect(parked!.parked_at).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    const plan = box.raw
      .prepare('EXPLAIN QUERY PLAN SELECT MIN(retry_at) FROM outbox WHERE attempts < ?')
      .all(OUTBOX_MAX_ATTEMPTS)
      .map((r) => String(r.detail));
    expect(plan.join(' ')).toContain('outbox_due');
    // Run again (a room whose version row lags): nothing fails, nothing changes.
    const stamped = box.stored();
    outboxParkingStep(box.schema);
    expect(box.stored()).toEqual(stamped);
  });

  it('is safe on a room made before the retry columns: it adds them too, and the next-due read works', () => {
    const box = room({ retry: false });
    box.raw.exec(`INSERT INTO outbox (plan_id, kind, key) VALUES ('P', 'summary', '')`);
    // Before the step, the read fails as an old local room's did ("no such column: retry_at").
    expect(() => outboxDueAt(box.sql)).toThrow(/retry_at|attempts/);
    outboxParkingStep(box.schema);
    expect(outboxDueAt(box.sql)).toBe(0);
    expect(box.stored()).toEqual([
      { id: 1, kind: 'summary', attempts: 0, retry_at: 0, parked_at: 0 },
    ]);
  });

  it('refuses a table name that is not a bare identifier', () => {
    const box = room();
    expect(() => outboxParkingStep(box.schema, 'outbox; DROP TABLE x')).toThrow(/bad table/);
  });
});

describe('parked keys after an outage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('delivers a card move parked during an outage once the index is healthy, after its day', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const box = room();
    outboxParkingStep(box.schema);
    const id = box.write(CARD_MOVED_KIND, move);
    let down = true;
    const index = fakeIndex(() => (down ? new IndexError(503, 'unavailable') : null));
    // An outage longer than the six hours of trying: the move fails twelve times and is parked.
    let now = 1_000_000;
    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS; i++) {
      await drain(box, index.client, now);
      now += RETRY_MAX_MS;
    }
    const parkedAt = now - RETRY_MAX_MS;
    expect(box.stored()).toEqual([
      {
        id,
        kind: CARD_MOVED_KIND,
        attempts: OUTBOX_MAX_ATTEMPTS,
        retry_at: parkedAt + PARKED_RETRY_MS,
        parked_at: parkedAt,
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[outbox] parked',
      expect.objectContaining({ reason: 'attempts' }),
    );
    expect(outboxDueAt(box.sql)).toBeNull();

    // The index is back. A healthy drain within the parked key's day leaves it parked.
    down = false;
    box.write('summary');
    await drain(box, index.client, parkedAt + DAY - 1);
    expect(index.calls.summary).toBe(1);
    expect(box.stored()).toMatchObject([{ id, attempts: OUTBOX_MAX_ATTEMPTS }]);

    // A healthy drain after it lets the key back in with one try left, due at once: no route, no write to the card.
    box.write('summary');
    const later = parkedAt + DAY;
    expect(await drain(box, index.client, later)).toEqual({ dropped: 0, unparked: 1 });
    expect(info).toHaveBeenCalledWith('[outbox] unparked', { itemId: 'P', keys: 1 });
    expect(box.stored()).toMatchObject([{ id, attempts: OUTBOX_MAX_ATTEMPTS - 1, retry_at: 0 }]);
    expect(outboxDueAt(box.sql)).toBe(0);
    // The next drain delivers it.
    await drain(box, index.client, later + 60_000);
    expect(index.calls.moves).toEqual([JSON.parse(move)]);
    expect(box.stored()).toEqual([]);
  });

  it('parks a key let back in again at once when the index still refuses it, for another day: no loop', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const box = room();
    outboxParkingStep(box.schema);
    const index = fakeIndex((kind) =>
      kind === 'moves' ? new IndexError(400, 'invalid_moves') : null,
    );
    const id = box.write(CARD_MOVED_KIND, move);
    const now = 5_000_000;
    // Refused for good: parked at once, stamped by the same drain's tend.
    expect(await drain(box, index.client, now)).toEqual({ dropped: 0, unparked: 0 });
    expect(box.stored()).toEqual([
      {
        id,
        kind: CARD_MOVED_KIND,
        attempts: OUTBOX_MAX_ATTEMPTS,
        retry_at: now + PARKED_RETRY_MS,
        parked_at: now,
      },
    ]);
    // A day on, a healthy drain lets it back in; its one try is refused, and it is parked for another day,
    // keeping when it was first parked.
    box.write('summary');
    const day = now + PARKED_RETRY_MS;
    expect((await drain(box, index.client, day)).unparked).toBe(1);
    await drain(box, index.client, day + 60_000);
    expect(box.stored()).toEqual([
      {
        id,
        kind: CARD_MOVED_KIND,
        attempts: OUTBOX_MAX_ATTEMPTS,
        retry_at: day + 60_000 + PARKED_RETRY_MS,
        parked_at: now,
      },
    ]);
    // Many healthy drains that same day leave it parked: one try a day at most.
    for (let i = 2; i < 10; i++) {
      box.write('summary');
      expect((await drain(box, index.client, day + i * 60_000)).unparked).toBe(0);
    }
  });

  it('lets nothing back in after a drain that failed, or one that sent nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = room();
    outboxParkingStep(box.schema);
    box.park(3, 1, 0);
    const failed = { done: [], failed: [{ ids: [9], error: new Error('down') }], parked: 0 };
    expect(healthyDrain(failed)).toBe(false);
    expect(healthyDrain({ done: [], failed: [] })).toBe(false);
    expect(healthyDrain({ done: [1], failed: [] })).toBe(true);
    expect(await tendParkedOutbox(box.db, OUTBOX, 'P', failed, 10)).toEqual({
      dropped: 0,
      unparked: 0,
    });
    expect(
      await tendParkedOutbox(box.db, OUTBOX, 'P', { done: [], failed: [], parked: 0 }, 10),
    ).toEqual({
      dropped: 0,
      unparked: 0,
    });
    expect(box.stored().every((r) => r.attempts === OUTBOX_MAX_ATTEMPTS)).toBe(true);
  });
});

describe('parked rows are bounded', () => {
  afterEach(() => vi.restoreAllMocks());

  it('drops parked rows first parked more than 30 days ago, and keeps a fresh key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = room();
    outboxParkingStep(box.schema);
    const now = 100 * DAY;
    box.park(2, now - PARKED_KEEP_MS, now + DAY);
    box.raw
      .prepare(
        `INSERT INTO outbox (plan_id, kind, key, attempts, retry_at, parked_at) VALUES ('P', 'edit', 'young@1', ?, ?, ?)`,
      )
      .run(OUTBOX_MAX_ATTEMPTS, now + DAY, now - PARKED_KEEP_MS + 1);
    const fresh = box.write('summary');
    const done = { done: [1], failed: [], parked: 0 };
    expect(await tendParkedOutbox(box.db, OUTBOX, 'P', done, now)).toEqual({
      dropped: 2,
      unparked: 0,
    });
    expect(warn).toHaveBeenCalledWith('[outbox] parked rows dropped', { itemId: 'P', keys: 2 });
    expect(box.stored().map((r) => r.id)).toEqual([3, fresh]);
  });

  it(`keeps an item's newest ${PARKED_KEEP_MAX} parked rows`, async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = room();
    outboxParkingStep(box.schema);
    const now = 10 * DAY;
    box.park(PARKED_KEEP_MAX + 25, now - DAY, now + DAY);
    const live = box.write('summary');
    const outcome = { done: [], failed: [{ ids: [1], error: new Error('x') }], parked: 1 };
    expect((await tendParkedOutbox(box.db, OUTBOX, 'P', outcome, now)).dropped).toBe(25);
    const ids = box.stored().map((r) => Number(r.id));
    expect(ids).toHaveLength(PARKED_KEEP_MAX + 1);
    expect(ids[0]).toBe(26);
    expect(ids.at(-1)).toBe(live);
    // Another item's rows in the same SQLite are its own.
    box.raw
      .prepare(
        `INSERT INTO outbox (plan_id, kind, key, attempts, parked_at) VALUES ('Q', 'edit', 'q@1', ?, 1)`,
      )
      .run(OUTBOX_MAX_ATTEMPTS);
    await tendParkedOutbox(box.db, OUTBOX, 'P', outcome, now);
    expect(box.raw.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE plan_id = 'Q'`).get()).toEqual({
      n: 1,
    });
  });
});

describe('the next-due read', () => {
  it('stays near constant at 10,000 parked rows (the index on attempts and retry_at)', () => {
    const at = (parked: number) => {
      const box = room();
      outboxParkingStep(box.schema);
      box.park(parked, 1, 0);
      for (let i = 0; i < 10; i++) box.write('tab', `t${i}`);
      return box.sql;
    };
    const small = at(10);
    const large = at(10_000);
    expect(outboxDueAt(large)).toBe(0);
    const sample = (sql: ReturnType<typeof at>) => () =>
      cpuMsOf(() => {
        for (let i = 0; i < 200; i++) outboxDueAt(sql);
      });
    // Without the index the read scanned every parked row: about 450 times slower at 10,000 than at 10.
    const ceiling = cpuRatioCeiling(3);
    expect(cpuGrowthRatio(sample(small), sample(large), { ceiling })).toBeLessThan(ceiling);
  });
});
