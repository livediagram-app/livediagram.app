import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteItemRow, insertItems, updateItemAtRev, updateItemsAtRev } from './items';
import { projectSavedStatement, headWriteStatement } from './sheets';

// A card or a Sheet's cells are part of the project (docs/specs/006-project/project-snapshots.md): a write to
// either marks it saved, as a tab write does, so the Explorer's "Updated" line and its snapshot follow it. Only a
// write that landed does.

const T0 = 1_700_000_000_000;
const NOW = T0 + 60_000;

function insert(
  sql: ReturnType<typeof sqliteD1>['sql'],
  table: string,
  row: Record<string, string | number | null>,
) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

// A started plan's own row.
function liveDoc(sql: ReturnType<typeof sqliteD1>['sql'], id: string, opts: { savedAt?: number } = {}) {
  insert(sql, 'test_plans', {
    id,
    owner_id: 'owner',
    name: `Project ${id}`,
    saved_at: opts.savedAt ?? T0,
    created_at: opts.savedAt ?? T0,
  });
}
const PERSON = { id: 'p1', name: 'Ali', color: '#ff0000' };

const item = (id: string, key: number, rev = 1): Item => ({
  id,
  type: 'task',
  key,
  rank: 'a',
  fields: { title: id },
  rev,
  createdAt: T0,
  updatedAt: T0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

// The plan's own saved time, in the same transaction as the write; D1's follows with the plan's push
// (plan-room/plan-outbox.ts).
const savedAt = (db: ReturnType<typeof sqliteD1>) =>
  (db.sql.prepare("SELECT saved_at FROM plan WHERE id = 'd1'").get() as { saved_at: number })
    .saved_at;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('card writes', () => {
  it('mark the project saved when they land, and only then', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'd1');
    await insertItems(db.env, 'd1', [item('i1', 1)]);
    expect(savedAt(db)).toBe(NOW);

    vi.setSystemTime(NOW + 1);
    expect(await updateItemAtRev(db.env, 'd1', item('i1', 1, 2), 1)).not.toBeNull();
    expect(savedAt(db)).toBe(NOW + 1);
    // A write against a rev that moved on lands nothing and marks nothing.
    vi.setSystemTime(NOW + 2);
    expect(await updateItemAtRev(db.env, 'd1', item('i1', 1, 3), 1)).toBeNull();
    expect(savedAt(db)).toBe(NOW + 1);

    vi.setSystemTime(NOW + 3);
    await updateItemsAtRev(db.env, 'd1', [{ next: item('i1', 1, 3), expectedRev: 2 }]);
    expect(savedAt(db)).toBe(NOW + 3);

    vi.setSystemTime(NOW + 4);
    expect(await deleteItemRow(db.env, 'd1', 'nope')).toBeNull();
    expect(savedAt(db)).toBe(NOW + 3);
    expect(await deleteItemRow(db.env, 'd1', 'i1')).not.toBeNull();
    expect(savedAt(db)).toBe(NOW + 4);
  });

  it('never move the saved time back', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'd1', { savedAt: NOW + 10_000 });
    await insertItems(db.env, 'd1', [item('i1', 1)]);
    expect(savedAt(db)).toBe(NOW + 10_000);
  });
});

describe('sheet writes', () => {
  it('mark the project saved in the batch of a write that landed, and not for a stale one', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'd1');
    insert(db.sql, 'sheets', {
      plan_id: 'd1',
      id: 's1',
      tab_id: 't1',
      title: 'Sheet',
      layout: '{}',
      rev: 1,
      created_at: T0,
      updated_at: T0,
      updated_by: JSON.stringify(PERSON),
    });
    const write = (fromRev: number, nonce: string, now: number) =>
      db.env.PLAN_DB.batch([
        headWriteStatement(db.env, 'd1', 's1', fromRev, nonce, now, PERSON, {}),
        projectSavedStatement(db.env, 'd1', 's1', nonce, now),
      ]);
    await write(1, 'n1', NOW);
    expect(savedAt(db)).toBe(NOW);
    await write(1, 'n2', NOW + 5);
    expect(savedAt(db)).toBe(NOW);
  });
});
