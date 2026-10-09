import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { framedSheetIds, runSheetSweep, SHEET_UNFRAMED_DAYS } from './sheet-sweep';

let sql: SqliteD1;
const sheetRow = (id: string, tab: string, since: number | null = null) =>
  sql.sql
    .prepare(
      `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, unframed_since, created_at, updated_at, updated_by) VALUES ('d1', ?, ?, ?, '{"rows":[],"cols":[]}', 0, ?, 1, 1, '{}')`,
    )
    .run(id, tab, id, since);
const since = (id: string) =>
  (
    sql.sql.prepare(`SELECT unframed_since AS s FROM sheets WHERE id = ?`).get(id) as
      { s: number | null } | undefined
  )?.s;

beforeEach(() => {
  sql = sqliteD1();
  const el = (id: string) => ({
    id: `e-${id}`,
    type: 'shape',
    shape: 'plan-sheet',
    planSheet: { sheetId: id },
  });
  sql.sql.exec(
    `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'o', 'D', 0, 1, 1);`,
  );
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'One', ?, 1)`)
    .run(JSON.stringify({ elements: [el('framed00'), el('back0000')] }));
  sql.sql
    .prepare(
      `INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Bad', '{oops planSheet', 1)`,
    )
    .run();
  sql.sql.exec(`
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);`);
});

describe('the sheet sweep', () => {
  it('marks, clears and deletes', async () => {
    const now = 100 * 86_400_000;
    const old = now - SHEET_UNFRAMED_DAYS * 86_400_000;
    sheetRow('framed00', 't1');
    sheetRow('back0000', 't1', now - 1000);
    sheetRow('loose000', 't1');
    sheetRow('oldloose', 't1', old);
    sheetRow('newloose', 't1', now - 1000);
    sheetRow('gonetab0', 'tX');
    sheetRow('badtab00', 't2', old);
    const r = await runSheetSweep(sql.env, now);
    expect(r).toEqual({ marked: 2, cleared: 1, deleted: 1 });
    expect(since('framed00')).toBeNull();
    expect(since('back0000')).toBeNull();
    expect(since('loose000')).toBe(now);
    expect(since('oldloose')).toBeUndefined();
    expect(since('newloose')).toBe(now - 1000);
    expect(since('gonetab0')).toBe(now);
    expect(since('badtab00')).toBe(old);
  });
  it('reads framed ids from tab data', () => {
    expect([...framedSheetIds(null)]).toEqual([]);
    expect([...framedSheetIds('{"elements":[]}')]).toEqual([]);
    expect([
      ...framedSheetIds('{"elements":[{"shape":"plan-sheet","planSheet":{"sheetId":5}},null]}'),
    ]).toEqual([]);
  });
});
