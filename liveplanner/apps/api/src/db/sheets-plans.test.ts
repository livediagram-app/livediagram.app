// The sheet cell reads and writes seek each named cell by the primary key (docs/specs/029-sheets/blueprints/sheet-store.md
// "Performance and limits"), against the real migrations: a sheet holds up to SHEET_CELLS_MAX cells, and a write
// that read all of them to find the few it names cost as much as the sheet was big.

import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  USED_ROW_WINDOW,
  cellsNamedBy,
  lastUsedSheetRow,
  readCells,
  readRowInputs,
  readRowTexts,
  usedSheetRows,
} from './sheets';

describe('cells named by key', () => {
  it('are sought by (plan, sheet, row, column)', () => {
    const { sql } = sqliteD1();
    const plan = sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM sheet_cells
          WHERE plan_id = ? AND sheet_id = ? AND ${cellsNamedBy('?')}`,
      )
      .all('d', 's', '[]')
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).toContain('(plan_id=? AND sheet_id=? AND row_id=? AND col_id=?)');
  });

  it('match exactly the keys given, splitting each at its first colon', async () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO test_plans (id, owner_id, name, created_at, saved_at) VALUES ('d', 'o', 'D', 1, 1)`,
    );
    sql.exec(
      `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
       VALUES ('d', 's', 't', 'S', '{}', 1, 1, 1, 'o')`,
    );
    for (const [r, c] of [
      ['r1', 'c1'],
      ['r1', 'c2'],
      ['r2', 'c1'],
    ])
      sql
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input) VALUES ('d', 's', ?, ?, '"x"')`,
        )
        .run(r!, c!);
    const cells = await readCells(env, 'd', 's', ['r1:c2', 'r2:c1', 'r9:c9']);
    expect(cells).toEqual([
      { r: 'r1', c: 'c2', i: 'x' },
      { r: 'r2', c: 'c1', i: 'x' },
      { r: 'r9', c: 'c9' },
    ]);
  });
});

describe('readRowTexts', () => {
  it('reads the text cells of the named rows only, by an indexed seek', async () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO test_plans (id, owner_id, name, created_at, saved_at) VALUES ('d', 'o', 'D', 1, 1)`,
    );
    sql.exec(
      `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
       VALUES ('d', 's', 't', 'S', '{}', 1, 1, 1, 'o')`,
    );
    for (const [r, c, input] of [
      ['r1', 'c1', { s: 'Title' }],
      ['r1', 'c2', { n: 4 }],
      ['r2', 'c1', { s: 'Name' }],
      ['r9', 'c1', { s: 'Elsewhere' }],
    ] as const)
      sql
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input) VALUES ('d', 's', ?, ?, ?)`,
        )
        .run(r, c, JSON.stringify(input));
    expect(await readRowTexts(env, 'd', 's', ['r1', 'r2'])).toEqual(
      new Map([
        ['r1', new Map([['c1', 'Title']])],
        ['r2', new Map([['c1', 'Name']])],
      ]),
    );
    expect(await readRowTexts(env, 'd', 's', [])).toEqual(new Map());
    const plan = sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT row_id, col_id, input FROM sheet_cells
          WHERE plan_id = ? AND sheet_id = ? AND input IS NOT NULL AND row_id IN (SELECT value FROM json_each(?))`,
      )
      .all('d', 's', '[]')
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).not.toMatch(/SCAN sheet_cells/);
  });
});

// docs/specs/030-forms/blueprints/forms.md: a response finds the last row holding a value by probing the layout's rows
// from the end, the same answer the read of every cell gave, in a window's worth of seeks.
describe('lastUsedSheetRow', () => {
  function sheet(cells: [string, string, unknown, unknown?][]) {
    const db = sqliteD1();
    db.sql.exec(
      `INSERT INTO test_plans (id, owner_id, name, created_at, saved_at) VALUES ('d', 'o', 'D', 1, 1)`,
    );
    db.sql.exec(
      `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
       VALUES ('d', 's', 't', 'S', '{}', 1, 1, 1, 'o')`,
    );
    const put = db.sql.prepare(
      `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format) VALUES ('d', 's', ?, ?, ?, ?)`,
    );
    for (const [r, c, input, format] of cells)
      put.run(
        r,
        c,
        input === undefined ? null : JSON.stringify(input),
        format === undefined ? null : JSON.stringify(format),
      );
    // How many probes each answer took.
    let probes = 0;
    const prepare = db.env.PLAN_DB.prepare.bind(db.env.PLAN_DB);
    db.env.PLAN_DB.prepare = (q: string) => {
      const stmt = prepare(q);
      const bind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        probes++;
        return bind(...args);
      };
      return stmt;
    };
    return { ...db, probes: () => probes };
  }
  // The answer the old read gave: every row holding a value, then the last of them in the layout's order.
  function naive(sql: ReturnType<typeof sqliteD1>['sql'], rows: readonly string[]) {
    const used = new Set(
      sql
        .prepare(
          `SELECT DISTINCT row_id FROM sheet_cells WHERE plan_id = 'd' AND sheet_id = 's' AND input IS NOT NULL`,
        )
        .all()
        .map((r) => String(r['row_id'])),
    );
    const last = [...rows].reverse().find((r) => used.has(r));
    return new Set(last ? [last] : []);
  }
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`);

  it('answers the last row holding a value, as reading every cell did, gaps and formats included', async () => {
    const rows = ids(10);
    const db = sheet([
      ['r0', 'c1', { s: 'Name' }],
      ['r2', 'c1', { s: 'Ana' }],
      ['r2', 'c2', { n: 4 }],
      ['r5', 'c1', { s: 'Lee' }],
      // Formats only (a banded look's empty rows), and a row the layout no longer holds.
      ['r7', 'c1', undefined, { b: true }],
      ['r9', 'c2', undefined, { b: true }],
      ['gone', 'c1', { s: 'x' }],
    ]);
    expect(await lastUsedSheetRow(db.env, 'd', 's', rows)).toEqual(new Set(['r5']));
    expect(await lastUsedSheetRow(db.env, 'd', 's', rows)).toEqual(naive(db.sql, rows));
    // Another order of the same rows (a sort): the last in the layout's order.
    const sorted = ['r5', 'r2', 'r0', 'r9', 'r7'];
    expect(await lastUsedSheetRow(db.env, 'd', 's', sorted)).toEqual(new Set(['r0']));
    expect(await lastUsedSheetRow(db.env, 'd', 's', sorted)).toEqual(naive(db.sql, sorted));
  });

  // forms.md "A template's table with a total": a total's inputs, and which of a table's rows hold a value.
  it("reads one row's inputs and which rows hold a value, in one probe each", async () => {
    const total = { f: { t: 'SUM(@0)', r: [{ r1: 'r1', c1: 'c1', r2: 'r3', c2: 'c1' }] } };
    const db = sheet([
      ['r1', 'c1', { s: 'Ana' }],
      ['r2', 'c1', undefined, { b: true }],
      ['r4', 'c1', total],
      ['r4', 'c2', undefined, { b: true }],
    ]);
    expect(await readRowInputs(db.env, 'd', 's', 'r4')).toEqual(new Map([['c1', total]]));
    expect(await usedSheetRows(db.env, 'd', 's', ['r1', 'r2', 'r3'])).toEqual(new Set(['r1']));
    expect(await usedSheetRows(db.env, 'd', 's', [])).toEqual(new Set());
    expect(db.probes()).toBe(2);
  });

  it('answers none for an empty sheet, a sheet of formats only, and no rows', async () => {
    const empty = sheet([]);
    expect(await lastUsedSheetRow(empty.env, 'd', 's', ids(300))).toEqual(new Set());
    const styled = sheet([['r1', 'c1', undefined, { b: true }]]);
    expect(await lastUsedSheetRow(styled.env, 'd', 's', ids(5))).toEqual(new Set());
    expect(await lastUsedSheetRow(styled.env, 'd', 's', [])).toEqual(new Set());
    expect(styled.probes()).toBe(1);
  });

  it('finds a value deep above an empty tail, widening its window each probe', async () => {
    const rows = ids(1000);
    const db = sheet([
      ['r3', 'c1', { s: 'Head' }],
      ['r40', 'c1', { s: 'Last' }],
    ]);
    expect(await lastUsedSheetRow(db.env, 'd', 's', rows)).toEqual(new Set(['r40']));
    expect(await lastUsedSheetRow(db.env, 'd', 's', rows)).toEqual(naive(db.sql, rows));
    // 64, 128, 256 and 512 rows from the end take it to r40 within four probes (each answer above took them).
    expect(db.probes()).toBe(2 * 4);
  });

  it('answers a full sheet from one window of seeks, never every cell', async () => {
    const rows = ids(3000);
    const cells: [string, string, unknown][] = [];
    for (const r of rows) for (const c of ['c1', 'c2', 'c3']) cells.push([r, c, { s: 'x' }]);
    const db = sheet(cells);
    expect(await lastUsedSheetRow(db.env, 'd', 's', rows)).toEqual(new Set(['r2999']));
    expect(db.probes()).toBe(1);
    expect(USED_ROW_WINDOW).toBe(64);
    const plan = db.sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT value AS row_id FROM json_each(?) AS r
          WHERE EXISTS (SELECT 1 FROM sheet_cells
                         WHERE plan_id = ? AND sheet_id = ? AND row_id = r.value AND input IS NOT NULL)`,
      )
      .all('[]', 'd', 's')
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).not.toMatch(/SCAN sheet_cells/);
    expect(plan.join('\n')).toContain('(plan_id=? AND sheet_id=? AND row_id=?)');
  });
});
