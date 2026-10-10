import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyDocument } from './documents';
import { tabStatsOf } from './tab-stats';
import { seedTabs, swapTabData, upsertTab, upsertTabAtRev } from './tabs';

// Every writer of a tab body keeps its `tab_stats` row in step
// (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from"), proven against
// a real SQLite with every migration applied.

const T0 = 1_700_000_000_000;

function withDocument(id = 'A'): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    )
    .run(id, 'owner', id, T0, T0);
  return db;
}

const shape = (id: string, comments = 0) => ({
  id,
  type: 'shape',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(comments
    ? {
        commentThread: {
          resolved: false,
          comments: Array.from({ length: comments }, (_, i) => ({
            id: `${id}-c${i}`,
            text: 'hello',
            authorName: 'A',
            authorColor: '#000',
            createdAt: T0,
          })),
        },
      }
    : {}),
});

const tab = (id: string, opensIn: string | undefined, ...comments: number[]): Tab =>
  ({
    id,
    name: id,
    ...(opensIn ? { opensIn } : {}),
    elements: comments.map((c, i) => shape(`${id}-e${i}`, c)),
  }) as unknown as Tab;

type Row = { mode: string; element_count: number; comment_count: number; data_bytes: number };

function statsRow(sql: DatabaseSync, tabId: string): Row | undefined {
  return sql
    .prepare(
      'SELECT mode, element_count, comment_count, data_bytes FROM tab_stats WHERE tab_id = ?',
    )
    .get(tabId) as Row | undefined;
}

// What the row must say: the stats of the body actually stored.
function expected(sql: DatabaseSync, tabId: string): Row {
  const data = sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId)!.data as string;
  const s = tabStatsOf(JSON.parse(data) as object, data);
  return {
    mode: s.mode,
    element_count: s.elementCount,
    comment_count: s.commentCount,
    data_bytes: s.dataBytes,
  };
}

describe('upsertTab and upsertTabAtRev', () => {
  it('write the stats of the stored body', async () => {
    const db = withDocument();
    await upsertTab(db.env, 'A', tab('t1', 'draw', 2, 0, 1), 0);
    expect(statsRow(db.sql, 't1')).toEqual({ ...expected(db.sql, 't1'), mode: 'draw' });
    expect(statsRow(db.sql, 't1')).toMatchObject({ element_count: 3, comment_count: 3 });
  });

  it('replace them on the next write', async () => {
    const db = withDocument();
    await upsertTab(db.env, 'A', tab('t1', 'draw', 2), 0);
    const rev = await upsertTab(db.env, 'A', tab('t1', 'plan'), 0);
    await upsertTabAtRev(db.env, 'A', tab('t1', 'plan', 0, 0), 0, rev);
    expect(statsRow(db.sql, 't1')).toEqual(expected(db.sql, 't1'));
    expect(statsRow(db.sql, 't1')).toMatchObject({ mode: 'plan', element_count: 2 });
  });
});

describe('seedTabs', () => {
  it('writes every seeded tab its stats', async () => {
    const db = withDocument();
    await seedTabs(db.env, 'A', [tab('t1', undefined, 1), tab('t2', 'illustrate')]);
    expect(statsRow(db.sql, 't1')).toEqual(expected(db.sql, 't1'));
    expect(statsRow(db.sql, 't2')).toEqual(expected(db.sql, 't2'));
    expect(statsRow(db.sql, 't2')?.mode).toBe('illustrate');
  });
});

describe('swapTabData (participant and Q&A writes)', () => {
  it('writes the next body stats on a won swap, and nothing on a lost one', async () => {
    const db = withDocument();
    await upsertTab(db.env, 'A', tab('t1', 'draw'), 0);
    const before = statsRow(db.sql, 't1');
    const stored = db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get('t1')!.data as string;
    const next = { opensIn: 'draw', elements: [shape('x', 4)] };
    const nextData = JSON.stringify(next);
    expect(
      await swapTabData(db.env, 'A', 't1', 'stale', nextData, tabStatsOf(next, nextData)),
    ).toBe(false);
    expect(statsRow(db.sql, 't1')).toEqual(before);
    expect(await swapTabData(db.env, 'A', 't1', stored, nextData, tabStatsOf(next, nextData))).toBe(
      true,
    );
    expect(statsRow(db.sql, 't1')).toEqual(expected(db.sql, 't1'));
    expect(statsRow(db.sql, 't1')).toMatchObject({ element_count: 1, comment_count: 4 });
  });
});

describe('copyDocument', () => {
  it("counts the copy's tabs from the copied bodies", async () => {
    const db = withDocument();
    await upsertTab(db.env, 'A', tab('t1', 'draw', 2), 0);
    const copy = await copyDocument(db.env, 'A', 'B', 'visitor', 'Copy of A');
    const copied = copy!.tabs[0]!.id;
    expect(statsRow(db.sql, copied)).toEqual(expected(db.sql, copied));
  });

  it('counts a Community copy after its redaction', async () => {
    const db = withDocument();
    await upsertTab(db.env, 'A', tab('t1', 'draw', 2), 0);
    const copy = await copyDocument(db.env, 'A', 'B', 'visitor', 'Copy of A', null, true);
    const copied = copy!.tabs[0]!.id;
    expect(statsRow(db.sql, copied)).toEqual(expected(db.sql, copied));
    expect(statsRow(db.sql, copied)?.comment_count).toBe(0);
  });
});
