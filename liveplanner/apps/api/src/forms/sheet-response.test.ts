import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import type { SheetWrite } from '@liveplanner/sheets';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';

// A response's row as the store answers it (docs/specs/030-forms/forms.md "A counted response is never lost"): a sheet
// that moved on is planned again, and a row whose cells did not all land is never reported written.

const store = vi.hoisted(() => ({
  answers: [] as ((write: SheetWrite, atRev: number | undefined) => Response)[],
  seen: [] as (number | undefined)[],
}));
vi.mock('../routes/sheet-write-route', () => ({
  storeSheetWrite: async (
    _ctx: unknown,
    _project: string,
    _sheet: string,
    body: { write: SheetWrite },
    _by: unknown,
    _scope: unknown,
    opts: { atRev?: number } = {},
  ) => {
    store.seen.push(opts.atRev);
    const next = store.answers.shift();
    return next!(body.write, opts.atRev);
  },
}));
const { writeResponseRow } = await import('./sheet-response');

const SHEET = 'shtAAAAAA001';
const form: Pick<FormDefinition, 'sections'> = {
  sections: [{ id: 's-1', title: '', questions: [{ id: 'q-a', type: 'short', prompt: 'A' }] }],
};
let sql: SqliteD1;
let ctx: ReturnType<typeof makeTestRouteContext>;
const write = () =>
  writeResponseRow(ctx, {
    projectId: 'd1',
    sheet: { tabId: 'stab', sheetId: SHEET },
    form,
    answers: new Map([['q-a', 'x']]),
    number: 1,
    preview: false,
    by: { id: 'form:x', name: 'Form', color: '#000' },
  });
const stored = (w: SheetWrite, drop = 0) =>
  Response.json({
    applied: w.kind === 'title' ? w : { ...w, cells: (w.cells ?? []).slice(drop) },
    rev: 1,
    cells: [],
  });
const busy = () => Response.json({ error: 'sheet_busy' }, { status: 409 });

beforeEach(() => {
  store.answers = [];
  store.seen = [];
  sql = sqliteD1();
  sql.sql
    .prepare(
      `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'owner', 'Ops', 1, 1, 1)`,
    )
    .run();
  sql.sql
    .prepare(
      `INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('stab', 'Responses', '{}', 1, 0, 0)`,
    )
    .run();
  sql.sql
    .prepare(
      `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 'stab', 1, 1)`,
    )
    .run();
  sql.sql
    .prepare(
      `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
       VALUES ('d1', ?, 'stab', 'Responses', '{"rows":["ra01","ra02"],"cols":["ca01"]}', 7, 1, 1, '{}')`,
    )
    .run(SHEET);
  ctx = makeTestRouteContext('POST', '/api/forms/x/responses', {
    env: sql.env,
    owner: null,
  });
});

describe('writeResponseRow', () => {
  it('stores at the rev it planned on', async () => {
    store.answers.push((w) => stored(w));
    expect(await write()).toBe('written');
    expect(store.seen).toEqual([7]);
  });

  it('plans again when the sheet moved on, then lands', async () => {
    store.answers.push(busy, (w) => stored(w));
    expect(await write()).toBe('written');
    expect(store.seen).toEqual([7, 7]);
  });

  it('gives up as busy after the retries', async () => {
    store.answers.push(busy, busy, busy);
    expect(await write()).toBe('busy');
  });

  it('is never written when a planned cell did not land', async () => {
    store.answers.push((w) => stored(w, 1));
    expect(await write()).toBe('busy');
  });

  it('reads a sheet now gone, or full, as the store says', async () => {
    store.answers.push(() => Response.json({ error: 'sheet_not_found' }, { status: 404 }));
    expect(await write()).toBe('missing');
    store.answers.push(() => Response.json({ error: 'sheet_full' }, { status: 413 }));
    expect(await write()).toBe('full');
    store.answers.push(() => Response.json({ error: 'write_invalid' }, { status: 400 }));
    expect(await write()).toBe('busy');
    store.answers.push(() => new Response('not json', { status: 409 }));
    expect(await write()).toBe('busy');
  });

  it("writes under a template's headers on a lower row, not a new header row on row 1", async () => {
    sql.sql
      .prepare(
        `UPDATE sheets SET layout = '{"rows":["ra01","ra02","ra03","ra04","ra05","ra06"],"cols":["ca01","ca02"]}' WHERE id = ?`,
      )
      .run(SHEET);
    for (const [row, col, text] of [
      ['ra01', 'ca01', 'Contacts'],
      ['ra04', 'ca01', 'A'],
      ['ra04', 'ca02', 'Company'],
    ] as const)
      sql.sql
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input) VALUES ('d1', ?, ?, ?, ?)`,
        )
        .run(SHEET, row, col, JSON.stringify({ s: text }));
    let planned: SheetWrite | null = null;
    store.answers.push((w) => {
      planned = w;
      return stored(w);
    });
    expect(await write()).toBe('written');
    const w = planned as SheetWrite | null;
    const cells = !w || w.kind === 'title' ? [] : (w.cells ?? []);
    // The form's "A" header is on row 4 already; the headers it adds join it there, the answer goes on row 5.
    expect(cells.filter((c) => c.f).every((c) => c.r === 'ra04')).toBe(true);
    expect(cells.filter((c) => !c.f).every((c) => c.r === 'ra05')).toBe(true);
    expect(cells.some((c) => c.r === 'ra01' || c.r === 'ra02')).toBe(false);
  });

  describe("a template's table with a total", () => {
    const total = {
      f: { t: 'COUNTA(@0)', r: [{ r1: 'ra05', c1: 'ca01', r2: 'ra07', c2: 'ca01' }] },
    };
    const table = (rows: [string, string, object][]) => {
      sql.sql
        .prepare(
          `UPDATE sheets SET layout = '{"rows":["ra01","ra02","ra03","ra04","ra05","ra06","ra07","ra08","ra09"],"cols":["ca01","ca02"]}' WHERE id = ?`,
        )
        .run(SHEET);
      for (const [row, col, input] of [
        ['ra01', 'ca01', { s: 'Contacts' }],
        ['ra04', 'ca01', { s: 'A' }],
        ['ra04', 'ca02', { s: 'Company' }],
        ['ra08', 'ca01', total],
        ...rows,
      ] as const)
        sql.sql
          .prepare(
            `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input) VALUES ('d1', ?, ?, ?, ?)`,
          )
          .run(SHEET, row, col, JSON.stringify(input));
    };
    const planned = async () => {
      let w: SheetWrite | null = null;
      store.answers.push((x) => {
        w = x;
        return stored(x);
      });
      expect(await write()).toBe('written');
      return w as unknown as SheetWrite;
    };
    const answerRows = (w: SheetWrite) =>
      new Set(
        (w.kind === 'title' ? [] : (w.cells ?? []))
          .filter((c) => c.c === 'ca01' && 's' in c.i!)
          .map((c) => c.r),
      );

    it('fills the first empty row between the header and the total', async () => {
      table([
        ['ra05', 'ca01', { s: 'Jordan' }],
        ['ra07', 'ca01', { s: 'Sam' }],
      ]);
      const w = await planned();
      expect(answerRows(w)).toEqual(new Set(['ra06']));
      expect(w.kind === 'layout' && w.changes.some((c) => c.k === 'insertRows')).toBe(false);
    });

    it("inserts a row above a full table's total, and the total grows to take it", async () => {
      table([
        ['ra05', 'ca01', { s: 'Jordan' }],
        ['ra06', 'ca01', { s: 'Kim' }],
        ['ra07', 'ca01', { s: 'Sam' }],
      ]);
      const w = await planned();
      if (w.kind !== 'layout') throw new Error('a layout write');
      const insert = w.changes.find((c) => c.k === 'insertRows') as {
        after: string;
        ids: string[];
      };
      expect(insert.after).toBe('ra07');
      const added = insert.ids[0]!;
      expect(answerRows(w)).toEqual(new Set([added]));
      const grown = w.cells!.find((c) => c.r === 'ra08');
      expect(grown?.i).toEqual({ f: { t: 'COUNTA(@0)', r: [{ ...total.f.r[0], r2: added }] } });
    });

    it('appends under a value written below the total', async () => {
      table([
        ['ra05', 'ca01', { s: 'Jordan' }],
        ['ra09', 'ca01', { s: 'Below' }],
      ]);
      const w = await planned();
      expect(answerRows(w).size).toBe(1);
      expect([...answerRows(w)][0]).not.toMatch(/^ra0[1-9]$/);
    });

    it('appends under a last row that is not a total', async () => {
      table([['ra05', 'ca01', { s: 'Jordan' }]]);
      sql.sql.prepare(`DELETE FROM sheet_cells WHERE row_id = 'ra08'`).run();
      sql.sql
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input) VALUES ('d1', ?, 'ra08', 'ca02', ?)`,
        )
        .run(SHEET, JSON.stringify({ s: 'Notes' }));
      const w = await planned();
      expect(answerRows(w)).toEqual(new Set(['ra09']));
    });
  });

  it('is missing once the sheet left its tab', async () => {
    sql.sql.prepare(`UPDATE sheets SET tab_id = 'other' WHERE id = ?`).run(SHEET);
    expect(await write()).toBe('missing');
    expect(store.seen).toEqual([]);
  });
});
