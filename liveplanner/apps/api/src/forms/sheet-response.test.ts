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

  it('is missing once the sheet left its tab', async () => {
    sql.sql.prepare(`UPDATE sheets SET tab_id = 'other' WHERE id = ?`).run(SHEET);
    expect(await write()).toBe('missing');
    expect(store.seen).toEqual([]);
  });
});
