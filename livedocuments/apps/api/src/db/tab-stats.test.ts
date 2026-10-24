import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { documentStatsSql, tabStatsOfData, tabStatsStatement } from './tab-stats';

// docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from".

afterEach(() => vi.restoreAllMocks());

const T0 = 1_700_000_000_000;

function arrange() {
  const db = sqliteD1();
  const doc = (id: string) =>
    db.sql
      .prepare(
        'INSERT INTO test_documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
      )
      .run(id, 'owner', id, T0, T0);
  const tab = (docId: string, tabId: string, order: number) => {
    db.sql
      .prepare(
        'INSERT INTO tabs (id, name, data, updated_at, element_count) VALUES (?, ?, ?, ?, 0)',
      )
      .run(tabId, tabId, '{}', T0);
    db.sql
      .prepare(
        'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
      )
      .run(docId, tabId, order, T0);
  };
  const stats = async (
    tabId: string,
    elements: number,
    comments: number,
    bytes: number,
    at: number,
  ) =>
    tabStatsStatement(
      db.env,
      tabId,
      { elementCount: elements, commentCount: comments, dataBytes: bytes },
      at,
    ).run();
  return { db, doc, tab, stats };
}

function docStats(sql: DatabaseSync, id: string) {
  const row = sql.prepare(`SELECT ${documentStatsSql('?1')}`).get(id) as {
    doc_stats: string | null;
  };
  return row.doc_stats === null ? null : (JSON.parse(row.doc_stats) as unknown);
}

describe('documentStatsSql', () => {
  it('sums every tab', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 0);
    tab('D', 't2', 1);
    await stats('t1', 4, 1, 1000, T0 + 2);
    await stats('t2', 6, 2, 500, T0 + 1);
    expect(docStats(db.sql, 'D')).toEqual({
      elements: 10,
      comments: 3,
      bytes: 1500,
    });
  });

  it('is null while a tab is not counted yet', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 0);
    tab('D', 't2', 1);
    await stats('t1', 4, 1, 1000, T0);
    expect(docStats(db.sql, 'D')).toBeNull();
  });

  it('is null for a document with no tab', () => {
    const { db, doc } = arrange();
    doc('D');
    expect(docStats(db.sql, 'D')).toBeNull();
  });

  it('upserts a tab row, the newest write winning', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 0);
    await stats('t1', 4, 1, 1000, T0);
    await stats('t1', 2, 0, 200, T0 + 5);
    expect(docStats(db.sql, 'D')).toEqual({ elements: 2, comments: 0, bytes: 200 });
  });
});

describe('tabStatsOfData', () => {
  it('counts a stored body', () => {
    const data = JSON.stringify({ elements: [{ id: 'a' }] });
    expect(tabStatsOfData(data)).toEqual({
      stats: { elementCount: 1, commentCount: 0, dataBytes: data.length },
      corrupt: false,
    });
  });

  it('counts a corrupt body as an empty tab, its bytes measured', () => {
    expect(tabStatsOfData('{not json')).toEqual({
      stats: { elementCount: 0, commentCount: 0, dataBytes: 9 },
      corrupt: true,
    });
    expect(tabStatsOfData('null').corrupt).toBe(true);
  });
});
