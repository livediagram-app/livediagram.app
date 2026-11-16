// A plan's Sheets as a chart source (liveworkspace/docs/specs/004-index/sheet-sources.md; docs/specs/015-api/api.md
// "Sheet sources"): the doors on the index's key alone, the plan's Sheets, one range read as a chart reads it (A1
// turned into ids, only the range), a range whose corner is gone, and a watch kept for the document that asked.
import { describe, expect, it } from 'vitest';
import { defaultCatalogue } from '@liveplanner/items';
import { Workbook, readTypedInput, sheetFromJson, type SheetJson } from '@liveplanner/sheets';
import { insertSheetStatements } from '../db/sheets';
import { handleInternalItems } from '../routes/internal-items';
import { sqliteD1 } from '../test-sqlite-d1';
import { setPlanItemTypes } from './plan-content';

const PERSON = { id: 'user_ada', name: 'Ada', color: '#123456' };
const ROWS = ['r001', 'r002', 'r003', 'r004'];
const COLS = ['c001', 'c002', 'c003'];

function typedSheet(id: string, tabId: string, title: string, typed: Record<string, string>) {
  const json: SheetJson = {
    id,
    tabId,
    title,
    layout: { rows: ROWS, cols: COLS },
    cells: [],
    rev: 0,
    createdAt: 5,
    updatedAt: 5,
    updatedBy: PERSON,
  };
  const wb = new Workbook({ sheets: [sheetFromJson(json)], locale: 'en-GB' });
  for (const [a1, text] of Object.entries(typed)) {
    const c = a1.charCodeAt(0) - 65;
    const r = Number(a1.slice(1)) - 1;
    const read = readTypedInput(text, 'en-GB', wb.ctxFor(id));
    if (read.kind !== 'value') throw new Error(`${a1}: ${text}`);
    json.cells.push({ r: ROWS[r]!, c: COLS[c]!, i: read.input });
  }
  return json;
}

async function arrange() {
  const db = sqliteD1({ INDEX_KEY: 'index-key', DATA_EXPORT_KEY: 'export-key' });
  const send = (path: string, body?: unknown, key = 'index-key') =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      db.env,
    );
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', 'user_ada', 'Plan', 0, 1, 1)`,
  );
  await setPlanItemTypes(db.env, 'A', defaultCatalogue());
  const budget = typedSheet('sheet0001', 't2', 'Budget', {
    A1: 'Quarter',
    B1: 'Sales',
    C1: 'Costs',
    A2: 'Q1',
    B2: '10',
    C2: '4',
    A3: 'Q2',
    B3: '=B2*2',
    C3: '5',
    A4: 'Secret',
    B4: '999',
  });
  const blank = typedSheet('sheet0002', 't3', 'Blank', {});
  await db.env.PLAN_DB.batch([
    ...insertSheetStatements(db.env, 'A', budget, 5),
    ...insertSheetStatements(db.env, 'A', blank, 5),
  ]);
  return { db, send };
}

describe('the sheets door', () => {
  it("lists the plan's Sheets with each one's filled extent", async () => {
    const { send } = await arrange();
    const res = await send('A/sheets');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sheets: [
        { id: 'sheet0001', name: 'Budget', tabId: 't2', a1: 'A1:C4' },
        { id: 'sheet0002', name: 'Blank', tabId: 't3', a1: 'A1' },
      ],
    });
  });

  it('answers a plan never started as missing, and refuses the data export key', async () => {
    const { send } = await arrange();
    expect((await send('B/sheets')).status).toBe(404);
    expect((await send('A/sheets', undefined, 'export-key')).status).toBe(401);
  });
});

describe('the sheet-range door', () => {
  it('reads only the asked range, as ids, with formulas worked out', async () => {
    const { send } = await arrange();
    const res = await send('A/sheet-range', { sheetId: 'sheet0001', a1: 'A1:B3' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sheetName: 'Budget',
      tabId: 't2',
      range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
      a1: 'A1:B3',
      table: { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [10, 20] }] },
    });
  });

  it('reads a range of ids, picking columns', async () => {
    const { send } = await arrange();
    const res = await send('A/sheet-range', {
      sheetId: 'sheet0001',
      range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c003' },
      cols: ['c001', 'c003'],
    });
    const read = await res.json<{ a1: string; table: unknown }>();
    expect(read.a1).toBe('A1:C3');
    expect(read.table).toEqual({
      categories: ['Q1', 'Q2'],
      series: [{ name: 'Costs', values: [4, 5] }],
    });
  });

  it('answers a range whose corner is gone, a malformed A1, a missing sheet and a missing plan', async () => {
    const { send } = await arrange();
    const gone = await send('A/sheet-range', {
      sheetId: 'sheet0001',
      range: { r1: 'r001', c1: 'c001', r2: 'r999', c2: 'c002' },
    });
    expect(gone.status).toBe(409);
    expect((await send('A/sheet-range', { sheetId: 'sheet0001', a1: 'A40:B50' })).status).toBe(409);
    expect((await send('A/sheet-range', { sheetId: 'sheet0001', a1: 'nonsense!' })).status).toBe(
      400,
    );
    expect((await send('A/sheet-range', { sheetId: 'sheet0009', a1: 'A1' })).status).toBe(404);
    expect((await send('B/sheet-range', { sheetId: 'sheet0001', a1: 'A1' })).status).toBe(404);
  });

  it('keeps a watch for the document that asked, and none without one', async () => {
    const { db, send } = await arrange();
    await send('A/sheet-range', { sheetId: 'sheet0001', a1: 'A1:B3' });
    await send('A/sheet-range', { sheetId: 'sheet0001', a1: 'A1:B3', watcher: 'doc_1' });
    const watches = await db.env.PLAN_DB.prepare(
      'SELECT watcher, sheet_id, plan_id FROM sheet_watches',
    ).all();
    expect(watches.results).toEqual([{ watcher: 'doc_1', sheet_id: 'sheet0001', plan_id: 'A' }]);
  });
});
