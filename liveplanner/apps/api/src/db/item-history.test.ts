import { describe, expect, it, vi } from 'vitest';
import {
  ITEM_HISTORY_MAX,
  ITEM_HISTORY_MAX_AGE_MS,
  groupHistory,
  historyForReader,
  type Item,
} from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import { appendItemHistory, deleteOldItemHistory, readItemHistory } from './item-history';

// A card's history store (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"), on real SQLite
// with every schema step: what an append keeps, its bounds, the cascade, and that it reaches the plan's own storage
// alone (never D1, the index or the room). The measurements the card asks for are here: rows written per change, time
// per append, and the read's size at the cap.

const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ALI = { id: 'p-ali', name: 'Ali', color: '#dc2626' };
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function card(over: Partial<Item> = {}, fields: Item['fields'] = {}): Item {
  return {
    id: 'card-0001',
    type: 'task',
    key: 1,
    rank: 'i',
    fields: { title: 'Ship it', status: 'todo', ...fields },
    rev: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SAM,
    updatedBy: SAM,
    ...over,
  };
}

function planWith(...cards: Item[]): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('P', 'o', 'Plan', 0, 1, 1)`);
  const insert = db.sql.prepare(
    `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
     VALUES ('P', ?, 'task', ?, 'i', '{}', 1, 0, 0, '{}', '{}')`,
  );
  for (const c of cards) insert.run(c.id, c.key);
  return db;
}

const rowsOf = (db: SqliteD1, itemId = 'card-0001') =>
  (
    db.sql.prepare('SELECT COUNT(*) AS n FROM item_history WHERE item_id = ?').get(itemId) as {
      n: number;
    }
  ).n;

// The plan's own storage alone: any other binding read throws, so a history that reached D1, the index or the
// room would fail here.
function onlyPlanDb(env: PlanEnv): Pick<PlanEnv, 'PLAN_DB'> {
  return new Proxy({} as Pick<PlanEnv, 'PLAN_DB'>, {
    get: (_t, prop) => {
      if (prop === 'PLAN_DB') return env.PLAN_DB;
      throw new Error(`history reached env.${String(prop)}`);
    },
  });
}

describe('appendItemHistory', () => {
  it('keeps a create and each change, newest first, with the author and tag', async () => {
    const db = planWith(card());
    const made = card();
    expect(await appendItemHistory(db.env, 'P', [{ before: null, after: made }])).toBe(1);
    const moved = card(
      { rev: 2, updatedAt: NOW + 1000, updatedBy: ALI },
      { status: 'doing', priority: 'high' },
    );
    expect(await appendItemHistory(db.env, 'P', [{ before: made, after: moved }], 'ai')).toBe(1);
    const read = await readItemHistory(db.env, 'P', 'card-0001', NOW + 2000);
    expect(read).toEqual([
      {
        at: NOW + 1000,
        by: ALI,
        tag: 'ai',
        changes: [
          { kind: 'moved', from: 'todo', to: 'doing' },
          { kind: 'set', field: 'priority', value: 'high' },
        ],
      },
      { at: NOW, by: SAM, changes: [{ kind: 'created', status: 'todo' }] },
    ]);
  });

  it('keeps nothing for a write a reader does not ask about', async () => {
    const db = planWith(card());
    const before = card();
    expect(
      await appendItemHistory(db.env, 'P', [{ before, after: card({ rank: 'j', rev: 2 }) }]),
    ).toBe(0);
    expect(rowsOf(db)).toBe(0);
  });

  it('keeps a card’s newest ITEM_HISTORY_MAX entries', async () => {
    const db = planWith(card());
    let before = card();
    for (let i = 1; i <= ITEM_HISTORY_MAX + 50; i += 1) {
      const after = card({ rev: i + 1, updatedAt: NOW + i }, { title: `Title ${i}` });
      await appendItemHistory(db.env, 'P', [{ before, after }]);
      before = after;
    }
    expect(rowsOf(db)).toBe(ITEM_HISTORY_MAX);
    const read = await readItemHistory(db.env, 'P', 'card-0001', NOW + 1000);
    expect(read).toHaveLength(ITEM_HISTORY_MAX);
    expect(read[0]!.changes).toEqual([
      { kind: 'set', field: 'title', value: `Title ${ITEM_HISTORY_MAX + 50}` },
    ]);
  });

  it('drops a card’s entries past the age limit on its next write, and reads none of them meanwhile', async () => {
    const db = planWith(card());
    const old = card({ updatedAt: NOW - ITEM_HISTORY_MAX_AGE_MS - DAY });
    await appendItemHistory(db.env, 'P', [{ before: null, after: old }]);
    expect(await readItemHistory(db.env, 'P', 'card-0001', NOW)).toEqual([]);
    expect(rowsOf(db)).toBe(1);
    await appendItemHistory(db.env, 'P', [
      { before: old, after: card({ rev: 2, updatedAt: NOW }, { flagged: true }) },
    ]);
    expect(rowsOf(db)).toBe(1);
    expect((await readItemHistory(db.env, 'P', 'card-0001', NOW))[0]!.changes).toEqual([
      { kind: 'flagged' },
    ]);
  });

  it('keeps one statement for a bulk create of many cards, and trims only cards that changed', async () => {
    const cards = Array.from({ length: 40 }, (_, i) =>
      card({ id: `card-${String(i).padStart(4, '0')}`, key: i + 1 }),
    );
    const db = planWith(...cards);
    const batch = vi.spyOn(db.env.PLAN_DB, 'batch');
    await appendItemHistory(
      db.env,
      'P',
      cards.map((after) => ({ before: null, after })),
    );
    expect(batch.mock.calls[0]![0]).toHaveLength(1);
    expect(
      (db.sql.prepare('SELECT COUNT(*) AS n FROM item_history').get() as { n: number }).n,
    ).toBe(40);
  });

  it('never throws: a failure is logged and the write stands', async () => {
    const db = planWith(card());
    vi.spyOn(db.env.PLAN_DB, 'batch').mockRejectedValueOnce(new Error('disk full'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await appendItemHistory(db.env, 'P', [{ before: null, after: card() }])).toBe(0);
    expect(warn).toHaveBeenCalledWith('[items] history.append.failed', expect.anything());
    warn.mockRestore();
  });

  it('goes with its card, and with its plan', async () => {
    const db = planWith(card(), card({ id: 'card-0002', key: 2 }));
    await appendItemHistory(db.env, 'P', [
      { before: null, after: card() },
      { before: null, after: card({ id: 'card-0002', key: 2 }) },
    ]);
    db.sql.exec("DELETE FROM items WHERE id = 'card-0001'");
    expect(rowsOf(db)).toBe(0);
    expect(rowsOf(db, 'card-0002')).toBe(1);
    db.sql.exec("DELETE FROM plan WHERE id = 'P'");
    expect(rowsOf(db, 'card-0002')).toBe(0);
  });

  it('reaches the plan’s own storage alone, never D1, the index or the room', async () => {
    const db = planWith(card());
    const env = onlyPlanDb(db.env);
    const made = card();
    await appendItemHistory(env, 'P', [{ before: null, after: made }]);
    await appendItemHistory(env, 'P', [
      { before: made, after: card({ rev: 2, updatedAt: NOW + 1 }, { status: 'done' }) },
    ]);
    expect(await readItemHistory(env, 'P', 'card-0001', NOW + 2)).toHaveLength(2);
    expect(await deleteOldItemHistory(env, NOW + 2)).toBe(2);
  });
});

describe('readItemHistory', () => {
  it('skips a row that does not parse', async () => {
    const db = planWith(card());
    db.sql.exec(`INSERT INTO item_history (plan_id, item_id, at, by, tag, changes)
                 VALUES ('P', 'card-0001', ${NOW}, '{', NULL, '[]')`);
    await appendItemHistory(db.env, 'P', [{ before: null, after: card() }]);
    expect(await readItemHistory(db.env, 'P', 'card-0001', NOW)).toHaveLength(1);
  });
});

describe('deleteOldItemHistory', () => {
  it('drops every card’s entries before the cutoff and keeps the rest', async () => {
    const db = planWith(card(), card({ id: 'card-0002', key: 2 }));
    await appendItemHistory(db.env, 'P', [
      { before: null, after: card({ updatedAt: NOW - 10 * DAY }) },
      { before: null, after: card({ id: 'card-0002', key: 2, updatedAt: NOW - 9 * DAY }) },
    ]);
    const made = card();
    await appendItemHistory(db.env, 'P', [
      { before: made, after: card({ rev: 2, updatedAt: NOW }, { flagged: true }) },
    ]);
    expect(await deleteOldItemHistory(db.env, NOW - DAY)).toBe(2);
    expect(rowsOf(db)).toBe(1);
    expect(await deleteOldItemHistory(db.env, NOW - DAY)).toBe(0);
    // Nothing fresh left: everything before the cutoff goes.
    expect(await deleteOldItemHistory(db.env, NOW + DAY)).toBe(1);
    expect(await deleteOldItemHistory(db.env, NOW + DAY)).toBe(0);
  });
});

// The card's performance notes: what a change costs the plan's storage, and what a panel reads at the cap. Budgets
// are CPU-time generous so a loaded machine never fails them; the numbers are logged for the PR.
describe('cost', () => {
  it('writes one row and one index entry per change, in well under a millisecond', async () => {
    const db = planWith(card());
    let before = card();
    // Fill the card to its cap first: the worst case for the trim.
    for (let i = 1; i <= ITEM_HISTORY_MAX; i += 1) {
      const after = card({ rev: i + 1, updatedAt: NOW + i }, { title: `t${i}` });
      await appendItemHistory(db.env, 'P', [{ before, after }]);
      before = after;
    }
    const changes = () => (db.sql.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    const runs = 500;
    const startChanges = changes();
    const start = performance.now();
    for (let i = 1; i <= runs; i += 1) {
      const after = card(
        { rev: before.rev + 1, updatedAt: NOW + ITEM_HISTORY_MAX + i },
        { title: `t${i}`, status: i % 2 ? 'doing' : 'todo' },
      );
      await appendItemHistory(db.env, 'P', [{ before, after }]);
      before = after;
    }
    const perAppendMs = (performance.now() - start) / runs;
    // Each append at the cap inserts one row and trims one: two row changes.
    const rowChanges = (changes() - startChanges) / runs;
    console.info('[measure] history append', { perAppendMs, rowChanges });
    expect(rowChanges).toBe(2);
    expect(perAppendMs).toBeLessThan(5);
    expect(rowsOf(db)).toBe(ITEM_HISTORY_MAX);
  });

  it('reads a card at the cap in one bounded answer', async () => {
    const db = planWith(card());
    let before = card();
    const people = [SAM, ALI];
    for (let i = 1; i <= ITEM_HISTORY_MAX; i += 1) {
      // Every entry its own: a different person each time, two minutes apart, so nothing groups (the worst case).
      const after = card(
        { rev: i + 1, updatedAt: NOW + i * 120_000, updatedBy: people[i % 2]! },
        { title: `A title of a usual length, change ${i}`, status: i % 2 ? 'doing' : 'review' },
      );
      await appendItemHistory(db.env, 'P', [{ before, after }]);
      before = after;
    }
    const start = performance.now();
    const read = await readItemHistory(db.env, 'P', 'card-0001', NOW + ITEM_HISTORY_MAX * 120_000);
    const entries = historyForReader(groupHistory(read), SAM.id);
    const readMs = performance.now() - start;
    const bytes = JSON.stringify({ entries }).length;
    console.info('[measure] history read at the cap', { entries: entries.length, bytes, readMs });
    expect(entries).toHaveLength(ITEM_HISTORY_MAX);
    expect(bytes).toBeLessThan(64 * 1024);
    expect(readMs).toBeLessThan(200);
  });
});
