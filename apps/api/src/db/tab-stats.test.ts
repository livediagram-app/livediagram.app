import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  documentStatsSql,
  readDocumentStats,
  tabStatsOfData,
  tabStatsStatement,
} from './tab-stats';

// docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from".

afterEach(() => vi.restoreAllMocks());

const T0 = 1_700_000_000_000;

function arrange() {
  const db = sqliteD1();
  const doc = (id: string) =>
    db.sql
      .prepare(
        'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
      )
      .run(id, 'owner', id, T0, T0);
  const tab = (docId: string, tabId: string, order: number) => {
    db.sql
      .prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, ?)')
      .run(tabId, tabId, '{}', T0);
    db.sql
      .prepare(
        'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
      )
      .run(docId, tabId, order, T0);
  };
  const stats = async (
    tabId: string,
    mode: string,
    elements: number,
    comments: number,
    bytes: number,
    at: number,
  ) =>
    tabStatsStatement(
      db.env,
      tabId,
      { mode: mode as 'diagram', elementCount: elements, commentCount: comments, dataBytes: bytes },
      at,
    ).run();
  return { db, doc, tab, stats };
}

function docStats(sql: DatabaseSync, id: string) {
  const row = sql
    .prepare(`SELECT ${documentStatsSql('documents.id')} FROM documents WHERE id = ?`)
    .get(id) as { doc_stats: string | null };
  return readDocumentStats(row.doc_stats);
}

describe('documentStatsSql', () => {
  it('sums every tab and takes the mode of the tab written last', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 0);
    tab('D', 't2', 1);
    await stats('t1', 'draw', 4, 1, 1000, T0 + 2);
    await stats('t2', 'plan', 6, 2, 500, T0 + 1);
    expect(docStats(db.sql, 'D')).toEqual({ mode: 'draw', elements: 10, comments: 3, bytes: 1500 });
  });

  it('breaks a tie in written time by the tab order', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 1);
    tab('D', 't2', 0);
    await stats('t1', 'draw', 1, 0, 1, T0);
    await stats('t2', 'plan', 1, 0, 1, T0);
    expect(docStats(db.sql, 'D')?.mode).toBe('plan');
  });

  it('is null while a tab is not counted yet', async () => {
    const { db, doc, tab, stats } = arrange();
    doc('D');
    tab('D', 't1', 0);
    tab('D', 't2', 1);
    await stats('t1', 'draw', 4, 1, 1000, T0);
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
    await stats('t1', 'draw', 4, 1, 1000, T0);
    await stats('t1', 'plan', 2, 0, 200, T0 + 5);
    expect(docStats(db.sql, 'D')).toEqual({ mode: 'plan', elements: 2, comments: 0, bytes: 200 });
  });
});

describe('readDocumentStats', () => {
  it('is null, with a warning, for a value it cannot read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readDocumentStats('not json')).toBeNull();
    expect(readDocumentStats('{"mode":"bogus","elements":1,"comments":0,"bytes":1}')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]![0])).toContain('tab-stats: unreadable doc_stats');
  });
});

describe('tabStatsOfData', () => {
  it('counts a stored body', () => {
    const data = JSON.stringify({ opensIn: 'plan', elements: [{ id: 'a' }] });
    expect(tabStatsOfData(data)).toEqual({
      stats: { mode: 'plan', elementCount: 1, commentCount: 0, dataBytes: data.length },
      corrupt: false,
    });
  });

  it('counts a corrupt body as an empty Diagram tab, its bytes measured', () => {
    expect(tabStatsOfData('{not json')).toEqual({
      stats: { mode: 'diagram', elementCount: 0, commentCount: 0, dataBytes: 9 },
      corrupt: true,
    });
    expect(tabStatsOfData('null').corrupt).toBe(true);
  });
});
