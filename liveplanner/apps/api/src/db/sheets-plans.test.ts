// The sheet cell reads and writes seek each named cell by the primary key (docs/specs/029-sheets/blueprints/sheet-store.md
// "Performance and limits"), against the real migrations: a sheet holds up to SHEET_CELLS_MAX cells, and a write
// that read all of them to find the few it names cost as much as the sheet was big.

import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { cellsNamedBy, readCells } from './sheets';

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
      `INSERT INTO projects (id, owner_id, name, created_at, saved_at) VALUES ('d', 'o', 'D', 1, 1)`,
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
