import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SheetResponse, SheetsResponse, SheetWriteResponse } from '@livediagram/api-schema';
import { emptyLayout, type SheetWrite } from '@livediagram/sheets';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The sheet store's endpoints (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md): gates incl.
// tab-scoped links, every rejection, the rev guard, the json_each writes, caps, the relay, copies and seeds.

let sql: SqliteD1;
let relayed: { op: Record<string, unknown> }[];

type Call = {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string | null;
  code?: string;
  doc?: string;
};

async function call<T = unknown>({
  method = 'POST',
  path,
  body,
  owner = 'owner',
  code,
  doc = 'd1',
}: Call) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(
    method,
    doc ? `/api/documents/${doc}${path}` : '/api/documents',
    {
      env: sql.env,
      owner,
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
      ...(body === undefined ? {} : { body }),
      waitUntil: (p) => void pending.push(p),
    },
  );
  const res = await handleDocuments(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

let n = 0;
const rand = () => (n = (n * 16807 + 11) % 2147483647) / 2147483647;
const layout = () => emptyLayout(rand, 10, 4);

async function make(extra: Record<string, unknown> = {}) {
  return call<SheetResponse>({
    path: '/sheets',
    body: { id: 'sheetA00', tabId: 't1', title: 'Budget', layout: layout(), ...extra },
  });
}

function write(
  sheetId: string,
  w: SheetWrite,
  extra: Record<string, unknown> = {},
  opts: Partial<Call> = {},
) {
  return call<SheetWriteResponse>({
    path: `/sheets/${sheetId}/writes`,
    body: { write: w, ...extra },
    ...opts,
  });
}

beforeEach(() => {
  n = 7;
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (x: string) => x,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      },
    }),
  };
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO participants (id, name, color, created_at) VALUES ('owner', 'Webber', '#3b82f6', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'One', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Two', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('TAB2', 'd1', 'edit', 't2', 1);
  `);
});

describe('creating and listing sheets', () => {
  it('makes a sheet, relays it and lists it by tab or id', async () => {
    const made = await make();
    expect(made.status).toBe(201);
    expect(made.body.sheet).toMatchObject({
      id: 'sheetA00',
      tabId: 't1',
      title: 'Budget',
      rev: 0,
      cells: [],
    });
    expect(made.body.sheet.updatedBy.name).toBe('Webber');
    expect(made.body.sheet.updatedBy.id).not.toBe('owner');
    expect(relayed[0]!.op).toMatchObject({ kind: 'sheets', sheetId: 'sheetA00', created: true });
    const byTab = await call<SheetsResponse>({ method: 'GET', path: '/sheets?tabId=t1' });
    expect(byTab.body.sheets.map((s) => s.id)).toEqual(['sheetA00']);
    expect(
      (await call<SheetsResponse>({ method: 'GET', path: '/sheets?tabId=t2' })).body.sheets,
    ).toEqual([]);
    expect(
      (await call<SheetsResponse>({ method: 'GET', path: '/sheets?ids=sheetA00' })).body.sheets,
    ).toHaveLength(1);
    expect(
      (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets,
    ).toHaveLength(1);
    expect((await call({ method: 'GET', path: '/sheets?ids=bad' })).status).toBe(400);
  });
  it('makes a filled sheet and refuses bad ones', async () => {
    const l = layout();
    const filled = await call<SheetResponse>({
      path: '/sheets',
      body: {
        tabId: 't1',
        title: 'Filled',
        layout: l,
        cells: [{ r: l.rows[0], c: l.cols[0], i: { n: 5 }, f: { b: true } }],
      },
    });
    expect(filled.status).toBe(201);
    expect(filled.body.sheet.cells).toEqual([
      { r: l.rows[0], c: l.cols[0], i: { n: 5 }, f: { b: true } },
    ]);
    const bad = await call<{ error: string }>({
      path: '/sheets',
      body: {
        tabId: 't1',
        title: 'Bad',
        layout: l,
        cells: [{ r: l.rows[0], c: l.cols[0], i: { x: 1 } }],
      },
    });
    expect(bad).toMatchObject({ status: 400, body: { error: 'write_invalid' } });
    expect(
      (await call({ path: '/sheets', body: { tabId: 't1', title: 'Junk', layout: 'nope' } }))
        .status,
    ).toBe(400);
  });
  it.each([
    [{ title: '' }, 400, 'title_invalid'],
    [{ title: 'x'.repeat(61) }, 400, 'title_invalid'],
    [{ tabId: '' }, 400, 'write_invalid'],
    [{ id: 'x' }, 400, 'write_invalid'],
    [{ copyOf: 'x' }, 400, 'write_invalid'],
    [{ cells: 'x' }, 400, 'write_invalid'],
    [{ cells: Array.from({ length: 5001 }, () => ({})) }, 413, 'write_too_large'],
    [{ tabId: 'nope' }, 404, 'tab_not_found'],
  ])('refuses %j', async (extra, status, error) => {
    expect(await make(extra)).toMatchObject({ status, body: { error } });
  });
  it('refuses a taken id or title, and non-object bodies', async () => {
    await make();
    expect(await make({ title: 'Other' })).toMatchObject({
      status: 409,
      body: { error: 'sheet_exists' },
    });
    expect(await make({ id: 'sheetB00', title: 'budget' })).toMatchObject({
      status: 409,
      body: { error: 'sheet_title_taken' },
    });
    expect((await make({ id: 'sheetB00', tabId: 't2' })).status).toBe(201);
    expect((await call({ path: '/sheets', body: [] })).status).toBe(400);
  });
  it('copies a sheet with its cells', async () => {
    await make();
    const s = (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
    await write('sheetA00', {
      kind: 'cells',
      cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { s: 'hi' } }],
    });
    const copy = await call<SheetResponse>({
      path: '/sheets',
      body: { id: 'sheetC00', tabId: 't1', title: 'Budget (copy)', copyOf: 'sheetA00' },
    });
    expect(copy.status).toBe(201);
    expect(copy.body.sheet.cells).toEqual([
      { r: s.layout.rows[0], c: s.layout.cols[0], i: { s: 'hi' } },
    ]);
    expect(copy.body.sheet.layout).toEqual(s.layout);
    expect(
      (await call({ path: '/sheets', body: { tabId: 't1', title: 'X', copyOf: 'missing00' } }))
        .status,
    ).toBe(404);
  });
  it('caps the sheets of a document', async () => {
    for (let i = 0; i < 200; i++)
      sql.sql
        .prepare(
          `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by) VALUES ('d1', ?, 't1', ?, '{"rows":[],"cols":[]}', 0, 1, 1, '{}')`,
        )
        .run(`fill${String(i).padStart(4, '0')}`, `F${i}`);
    expect(await make()).toMatchObject({ status: 413, body: { error: 'sheets_full' } });
  });
});

describe('access', () => {
  it('lets a viewer read but not write, and confines a tab link to its tab', async () => {
    await make();
    expect(
      (await call({ method: 'GET', path: '/sheets', owner: 'stranger', code: 'VIEW' })).status,
    ).toBe(200);
    expect(
      (
        await make({ id: 'sheetZ00', title: 'Z' }).then(() =>
          call({
            path: '/sheets',
            owner: 'stranger',
            code: 'VIEW',
            body: { tabId: 't1', title: 'Q' },
          }),
        )
      ).status,
    ).toBe(403);
    // The tab-scoped edit link reads only its tab, and must name it.
    expect(
      (await call({ method: 'GET', path: '/sheets', owner: 'stranger', code: 'TAB2' })).status,
    ).toBe(404);
    const scoped = await call<SheetsResponse>({
      method: 'GET',
      path: '/sheets?tabId=t2',
      owner: 'stranger',
      code: 'TAB2',
    });
    expect(scoped.body.sheets).toEqual([]);
    const sneaky = await call<SheetsResponse>({
      method: 'GET',
      path: '/sheets?tabId=t2&ids=sheetA00',
      owner: 'stranger',
      code: 'TAB2',
    });
    expect(sneaky.body.sheets).toEqual([]);
    expect(
      (
        await call({
          path: '/sheets?tabId=t2',
          owner: 'stranger',
          code: 'TAB2',
          body: { tabId: 't1', title: 'X', layout: layout() },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call({
          path: '/sheets?tabId=t2',
          owner: 'stranger',
          code: 'TAB2',
          body: { tabId: 't2', title: 'X', layout: layout() },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await write(
          'sheetA00',
          { kind: 'title', title: 'X' },
          {},
          { path: '/sheets/sheetA00/writes?tabId=t2', owner: 'stranger', code: 'TAB2' },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call({
          method: 'DELETE',
          path: '/sheets/sheetA00?tabId=t2',
          owner: 'stranger',
          code: 'TAB2',
        })
      ).status,
    ).toBe(404);
    expect((await call({ method: 'GET', path: '/sheets', owner: null })).status).toBe(400);
  });
});

describe('writes', () => {
  async function sheet() {
    await make();
    return (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
  }
  it('sets inputs, patches formats per key and clears', async () => {
    const s = await sheet();
    const [r0, r1] = s.layout.rows;
    const [c0] = s.layout.cols;
    const a = await write(
      'sheetA00',
      {
        kind: 'cells',
        cells: [
          { r: r0!, c: c0!, i: { n: 1 }, f: { b: true, fc: '#ff0000' } },
          { r: r1!, c: c0!, i: { s: 'x' } },
        ],
      },
      { wid: 'w1' },
    );
    expect(a.status).toBe(200);
    expect(a.body.rev).toBe(1);
    expect(a.body.cells).toEqual([
      { r: r0, c: c0, i: { n: 1 }, f: { b: true, fc: '#ff0000' } },
      { r: r1, c: c0, i: { s: 'x' } },
    ]);
    expect(relayed.at(-1)!.op).toMatchObject({
      kind: 'sheets',
      rev: 1,
      wid: 'w1',
      tabId: 't1',
      applied: { kind: 'cells' },
    });
    const b = await write('sheetA00', {
      kind: 'cells',
      cells: [{ r: r0!, c: c0!, f: { fc: null, i: true } }],
    });
    expect(b.body.cells[0]).toEqual({ r: r0, c: c0, i: { n: 1 }, f: { b: true, i: true } });
    const c = await write('sheetA00', {
      kind: 'cells',
      cells: [
        { r: r0!, c: c0!, i: null, f: null },
        { r: r1!, c: c0!, i: null },
      ],
    });
    expect(c.body.cells).toEqual([
      { r: r0, c: c0 },
      { r: r1, c: c0 },
    ]);
    const head = await db.readSheetHead(sql.env, 'd1', 'sheetA00');
    expect(head).toMatchObject({ rev: 3, cellCount: 0, cellBytes: 0 });
    // Format only on an empty cell, then cleared to nothing.
    await write('sheetA00', { kind: 'cells', cells: [{ r: r1!, c: c0!, f: { b: true } }] });
    await write('sheetA00', { kind: 'cells', cells: [{ r: r1!, c: c0!, f: { b: null } }] });
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM sheet_cells').get()).toEqual({ n: 0 });
  });
  it('deletes rows with their cells and shrinks formulas', async () => {
    const s = await sheet();
    const [r0, r1, r2, r3] = s.layout.rows;
    const [c0, c1] = s.layout.cols;
    await write('sheetA00', {
      kind: 'cells',
      cells: [
        { r: r0!, c: c0!, i: { n: 1 } },
        { r: r1!, c: c0!, i: { n: 2 } },
        { r: r3!, c: c1!, i: { f: { t: 'SUM(@0)', r: [{ r1: r0!, c1: c0!, r2: r1!, c2: c0! }] } } },
      ],
    });
    const del = await write('sheetA00', {
      kind: 'layout',
      changes: [{ k: 'deleteRows', ids: [r0!] }],
    });
    expect(del.status).toBe(200);
    expect(del.body.cells).toEqual([
      { r: r3, c: c1, i: { f: { t: 'SUM(@0)', r: [{ r1: r1, c1: c0, r2: r1, c2: c0 }] } } },
    ]);
    const after = (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
    expect(after.layout.rows).not.toContain(r0);
    expect(after.cells.map((c) => c.r).sort()).toEqual([r1, r3].sort());
    await write('sheetA00', {
      kind: 'layout',
      changes: [
        { k: 'deleteCols', ids: [c1!] },
        { k: 'insertRows', after: r2!, ids: ['newrow1'] },
      ],
    });
    const again = (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
    expect(again.cells).toHaveLength(1);
    expect(again.layout.rows).toContain('newrow1');
  });
  it('renames, refusing a taken title', async () => {
    await sheet();
    await make({ id: 'sheetB00', title: 'Costs' });
    expect(await write('sheetA00', { kind: 'title', title: 'costs' })).toMatchObject({
      status: 409,
      body: { error: 'sheet_title_taken' },
    });
    const ok = await write('sheetA00', { kind: 'title', title: '  Q3  ' });
    expect(ok.body.applied).toEqual({ kind: 'title', title: 'Q3' });
    expect((await db.readSheetHead(sql.env, 'd1', 'sheetA00'))!.title).toBe('Q3');
  });
  it('refuses bad writes and unknown sheets', async () => {
    const s = await sheet();
    expect((await write('missing00', { kind: 'title', title: 'x' })).status).toBe(404);
    expect((await call({ path: '/sheets/sheetA00/writes', body: { write: null } })).status).toBe(
      400,
    );
    expect(
      (
        await call({
          path: '/sheets/sheetA00/writes',
          body: { write: { kind: 'title', title: 'x' }, wid: 5 },
        })
      ).status,
    ).toBe(400);
    expect(await write('sheetA00', { kind: 'cells', cells: [{ r: 'BAD', c: 'x' }] })).toMatchObject(
      { status: 400, body: { error: 'axis_id_invalid' } },
    );
    const tooMany = Array.from({ length: 200 }, (_, i) => `zz${String(i).padStart(4, '0')}`);
    expect(
      await write('sheetA00', {
        kind: 'layout',
        changes: [{ k: 'insertCols', after: null, ids: tooMany }],
      }),
    ).toMatchObject({ status: 413, body: { error: 'sheet_too_large' } });
    expect(
      (
        await write('sheetA00', {
          kind: 'layout',
          changes: [{ k: 'size', axis: 'r', ids: [s.layout.rows[0]!], px: 5 }],
        })
      ).status,
    ).toBe(400);
    expect((await call({ method: 'PUT', path: '/sheets/sheetA00/writes', body: {} })).status).toBe(
      405,
    );
    expect((await call({ method: 'PUT', path: '/sheets', body: {} })).status).toBe(405);
    expect((await call({ method: 'GET', path: '/sheets/sheetA00' })).status).toBe(405);
  });
  it('refuses a write past the sheet cap', async () => {
    const s = await sheet();
    sql.sql.prepare(`UPDATE sheets SET cell_count = 50000 WHERE id = 'sheetA00'`).run();
    expect(
      await write('sheetA00', {
        kind: 'cells',
        cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { n: 1 } }],
      }),
    ).toMatchObject({ status: 413, body: { error: 'sheet_full' } });
    sql.sql
      .prepare(`UPDATE sheets SET cell_count = 0, cell_bytes = 4194300 WHERE id = 'sheetA00'`)
      .run();
    expect(
      (
        await write('sheetA00', {
          kind: 'cells',
          cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { s: 'abcdefghij' } }],
        })
      ).status,
    ).toBe(413);
    sql.sql.prepare(`UPDATE sheets SET cell_bytes = 0 WHERE id = 'sheetA00'`).run();
    sql.sql
      .prepare(
        `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, cell_count, created_at, updated_at, updated_by) VALUES ('d1', 'bigsheet', 't2', 'Big', '{"rows":[],"cols":[]}', 0, 200000, 1, 1, '{}')`,
      )
      .run();
    expect(
      await write('sheetA00', {
        kind: 'cells',
        cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { n: 1 } }],
      }),
    ).toMatchObject({ status: 413, body: { error: 'sheets_full' } });
  });
  it('retries a lost rev race, then gives up busy', async () => {
    const s = await sheet();
    const real = db.readSheetHead;
    const spy = vi.spyOn(db, 'readSheetHead').mockImplementation(async (...args) => {
      const head = await real(...args);
      return head ? { ...head, rev: head.rev - 1 } : head;
    });
    const res = await write('sheetA00', {
      kind: 'cells',
      cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { n: 1 } }],
    });
    spy.mockRestore();
    expect(res).toMatchObject({ status: 409, body: { error: 'sheet_busy' } });
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM sheet_cells').get()).toEqual({ n: 0 });
  });
  it('relays a huge write as a refetch', async () => {
    const s = await sheet();
    const cells = s.layout.rows.flatMap((r) =>
      s.layout.cols.map((c) => ({ r, c, i: { s: 'x'.repeat(9000) } })),
    );
    const res = await write('sheetA00', { kind: 'cells', cells });
    expect(res.status).toBe(200);
    expect(relayed.at(-1)!.op).toEqual({
      kind: 'sheets',
      sheetId: 'sheetA00',
      tabId: 't1',
      rev: 1,
      refetch: true,
    });
  });
});

describe('deleting, copies and seeds', () => {
  it('deletes a sheet and its cells', async () => {
    await make();
    const s = (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
    await write('sheetA00', {
      kind: 'cells',
      cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { n: 1 } }],
    });
    expect((await call({ method: 'DELETE', path: '/sheets/sheetA00' })).status).toBe(204);
    expect(relayed.at(-1)!.op).toMatchObject({ deleted: true });
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM sheet_cells').get()).toEqual({ n: 0 });
    expect((await call({ method: 'DELETE', path: '/sheets/sheetA00' })).status).toBe(404);
  });
  it('copies a document with its sheets on the new tab ids', async () => {
    await make();
    const s = (await call<SheetsResponse>({ method: 'GET', path: '/sheets' })).body.sheets[0]!;
    await write('sheetA00', {
      kind: 'cells',
      cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, i: { n: 9 } }],
    });
    const copy = await db.copyDocument(sql.env, 'd1', 'd2', 'owner', 'Copy');
    expect(copy).not.toBeNull();
    const copied = await db.listSheets(sql.env, 'd2');
    expect(copied).toHaveLength(1);
    expect(copied[0]!.id).toBe('sheetA00');
    expect(copied[0]!.tabId).not.toBe('t1');
    expect(copied[0]!.cells).toEqual([{ r: s.layout.rows[0], c: s.layout.cols[0], i: { n: 9 } }]);
    const tab = sql.sql
      .prepare(`SELECT tab_id FROM document_tabs WHERE document_id = 'd2' AND order_index = 0`)
      .get() as { tab_id: string };
    expect(copied[0]!.tabId).toBe(tab.tab_id);
  });
  it('seeds a new document’s sheets', async () => {
    const l = layout();
    const cells = Array.from({ length: 6000 }, (_, i) => ({
      r: `seed${String(i).padStart(4, '0')}`,
      c: l.cols[0],
      i: { n: i },
    }));
    const big = { ...l, rows: cells.map((c) => c.r) };
    const res = await call({
      path: '',
      doc: '',
      body: {
        id: 'd9',
        name: 'Seeded',
        tabs: [{ id: 'tseed', name: 'One', elements: [] }],
        sheets: [{ id: 'seeded00', tabId: 'tseed', title: 'Sheet 1', layout: big, cells }],
      },
    });
    expect(res.status).toBeLessThan(300);
    const seeded = await db.listSheets(sql.env, 'd9');
    expect(seeded[0]!.cells).toHaveLength(6000);
    const bad = await call({
      path: '',
      doc: '',
      body: { id: 'd8', name: 'Bad', tabs: [], sheets: 'x' },
    });
    expect(bad.status).toBe(413);
    const badEntry = await call({
      path: '',
      doc: '',
      body: { id: 'd7', name: 'Bad', tabs: [], sheets: [{ title: 'x' }] },
    });
    expect(badEntry.status).toBe(400);
  });
});

describe('deleting with the element', () => {
  const sheetEl = (sheetId: string) => ({
    id: `e-${sheetId}`,
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    planSheet: { sheetId },
  });
  const saveTab = (id: string, elements: unknown[]) =>
    db.upsertTab(sql.env, 'd1', { id, name: id, elements } as never, id === 't1' ? 0 : 1);
  const stored = () =>
    sql.sql.prepare(`SELECT id, delete_when_unreferenced AS del FROM sheets`).all();

  it('notes a new sheet as unreferenced until a tab references it', async () => {
    const since = () =>
      (sql.sql.prepare(`SELECT unreferenced_since AS s FROM sheets`).get() as { s: number | null })
        .s;
    await make();
    expect(since()).toEqual(expect.any(Number));
    await saveTab('t1', [sheetEl('sheetA00')]);
    expect(since()).toBeNull();
    // Its element saved before the sheet was made: referenced from the start.
    await saveTab('t2', [sheetEl('sheetB00')]);
    await make({ id: 'sheetB00', tabId: 't2', title: 'Other' });
    expect(
      sql.sql.prepare(`SELECT unreferenced_since AS s FROM sheets WHERE id = 'sheetB00'`).get(),
    ).toEqual({ s: null });
  });

  it('deletes at once when nothing references the sheet any more', async () => {
    await make();
    await saveTab('t1', [sheetEl('sheetA00')]);
    await saveTab('t1', []);
    const res = await call({ method: 'DELETE', path: '/sheets/sheetA00?whenUnreferenced=true' });
    expect(res.status).toBe(204);
    expect(stored()).toEqual([]);
    expect(relayed.at(-1)!.op).toMatchObject({ sheetId: 'sheetA00', deleted: true });
  });

  it('waits for the tab write that removes the last reference', async () => {
    await make();
    await saveTab('t1', [sheetEl('sheetA00')]);
    const before = relayed.length;
    const res = await call({ method: 'DELETE', path: '/sheets/sheetA00?whenUnreferenced=true' });
    expect(res.status).toBe(204);
    expect(stored()).toEqual([{ id: 'sheetA00', del: 1 }]);
    expect(relayed).toHaveLength(before);
    await saveTab('t1', []);
    expect(stored()).toEqual([]);
  });

  it('restores a sheet still stored by keeping it, so a later removal only notes it', async () => {
    await make();
    await saveTab('t1', [sheetEl('sheetA00')]);
    await call({ method: 'DELETE', path: '/sheets/sheetA00?whenUnreferenced=true' });
    const kept = await make({ restore: true });
    expect(kept.status).toBe(200);
    expect(kept.body.sheet.id).toBe('sheetA00');
    expect(stored()).toEqual([{ id: 'sheetA00', del: null }]);
    await saveTab('t1', []);
    expect(stored()).toEqual([{ id: 'sheetA00', del: null }]);
  });

  it('restores a deleted sheet whole, past one write’s cells', async () => {
    const l = layout();
    const cells = Array.from({ length: 6000 }, (_, i) => ({
      r: `rest${String(i).padStart(4, '0')}`,
      c: l.cols[0],
      i: { n: i },
    }));
    const body = { layout: { ...l, rows: cells.map((c) => c.r) }, cells };
    expect((await make(body)).status).toBe(413);
    const res = await make({ ...body, restore: true });
    expect(res.status).toBe(201);
    expect((await db.listSheets(sql.env, 'd1'))[0]!.cells).toHaveLength(6000);
    expect((await make({ restore: 'yes' })).status).toBe(400);
  });

  it('makes a restore on another tab of a stored id a clash, as any create', async () => {
    await make();
    const res = await make({ tabId: 't2', restore: true });
    expect(res.status).toBe(409);
  });
});
