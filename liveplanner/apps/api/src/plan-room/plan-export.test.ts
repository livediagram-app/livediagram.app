// The plan for liveworkspace's data export (liveworkspace/docs/specs/003-accounts/data-export.md; docs/specs/015-api/
// api.md "Internal"): the export door's `csv` format (every Board tab's board and every drawn Sheet, as Download CSV
// writes them, made safe) and its `comments` format (every thread, with real author ids), through the door on the
// data export's key, and a plan never started not started by asking.
import { describe, expect, it } from 'vitest';
import { defaultCatalogue, type Item } from '@liveplanner/items';
import type { CardThread, Comment, Element, Tab } from '@liveplanner/project';
import { Workbook, readTypedInput, sheetFromJson, type SheetJson } from '@liveplanner/sheets';
import type { Env } from '../types';
import { insertThreadStatement } from '../db/card-threads';
import { insertItems } from '../db/items';
import { insertSheetStatements } from '../db/sheets';
import { upsertTab } from '../db/tabs';
import { handleInternalItems } from '../routes/internal-items';
import { sqliteD1 } from '../test-sqlite-d1';
import { setPlanItemTypes } from './plan-content';
import { planNamespace } from './test-plan-namespace';

const DATA_EXPORT_KEY = 'data-export-key';
const DRIVE_KEY = 'drive-key';
const PERSON = { id: 'user_ada', name: 'Ada', color: '#123456' };

const shape = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...extra,
});

const board = (id: string, title: string): Element =>
  shape(id, {
    shape: 'plan-board',
    planBoard: {
      title,
      columns: [
        { id: 'col1', name: 'To Do', status: 'todo' },
        { id: 'col2', name: 'Finished', status: 'done' },
      ],
    },
  });

const sheetEl = (id: string, sheetId: string, extra: Record<string, unknown> = {}): Element =>
  shape(id, { shape: 'plan-sheet', planSheet: { sheetId }, ...extra });

const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 1,
  createdAt: 10,
  updatedAt: 20,
  createdBy: PERSON,
  updatedBy: PERSON,
});

const ROWS = ['r001', 'r002'];
const COLS = ['c001', 'c002', 'c003'];

// A Sheet whose cells are typed as a person types them (A1-keyed), on tab `tabId`.
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

const comment = (id: string, createdAt: number, author: string | undefined): Comment => ({
  id,
  text: `said ${id}`,
  createdAt,
  authorName: author ? `Name of ${author}` : 'Someone',
  authorColor: '#000000',
  ...(author !== undefined ? { authorId: author } : {}),
});

const thread = (id: string, createdAt: number, extra: Partial<CardThread> = {}): CardThread => ({
  id,
  title: '',
  resolved: false,
  comments: [comment(`${id}-c1`, createdAt, 'user_bea')],
  createdAt,
  createdBy: { name: 'Bea', color: '#000000', authorId: 'user_bea' },
  updatedAt: createdAt,
  home: 'A',
  cards: [{ projectId: 'A', itemId: 'card1', key: 1 }],
  rev: 1,
  ...extra,
});

async function arrange() {
  const db = sqliteD1({ INDEX_KEY: 'index-key', DRIVE_KEY, DATA_EXPORT_KEY });
  const get = (path: string, key = DATA_EXPORT_KEY, method = 'GET') =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}` },
      }),
      db.env,
    );
  const plan = async (id: string) => {
    db.sql.exec(
      `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('${id}', 'user_ada', 'Plan', 0, 1, 1)`,
    );
    await setPlanItemTypes(db.env, id, defaultCatalogue());
  };
  const tab = (planId: string, t: Partial<Tab> & { id: string; name: string }, order: number) =>
    upsertTab(db.env, planId, { elements: [], ...t }, order);
  return { db, get, plan, tab };
}

describe('GET /api/internal/items/:id/export?format=csv', () => {
  it("answers every Board tab's board and every drawn Sheet, in tab order, as Download CSV writes them", async () => {
    const { db, get, plan, tab } = await arrange();
    await plan('A');
    await tab('A', { id: 't1', name: 'Work', kind: 'board', elements: [board('b1', 'Kanban')] }, 0);
    await tab(
      'A',
      {
        id: 't2',
        name: 'Budget',
        kind: 'sheet',
        // The same Sheet drawn twice is written once.
        elements: [sheetEl('s1', 'sheet0001'), sheetEl('s2', 'sheet0001')],
      },
      1,
    );
    await tab('A', { id: 't3', name: 'Notes', kind: 'diagram', elements: [shape('x1')] }, 2);
    await insertItems(db.env, 'A', [
      card('card1', 1, { title: 'Write it', status: 'todo', priority: 'high' }),
      card('card2', 2, { title: '=HYPERLINK("x")', status: 'done' }),
    ]);
    const sheet = typedSheet('sheet0001', 't2', 'Costs', {
      A1: '2',
      B1: '=A1*3',
      C1: "'=1+1",
      A2: '=CARDCOUNT()',
    });
    // A Sheet no element draws (deleted, waiting to expire) is left out.
    const orphan = typedSheet('sheet0002', 't2', 'Gone', { A1: 'old' });
    await db.env.PLAN_DB.batch([
      ...insertSheetStatements(db.env, 'A', sheet, 5),
      ...insertSheetStatements(db.env, 'A', orphan, 5),
    ]);
    const res = await get('A/export?format=csv');
    expect(res.status).toBe(200);
    const { tables } = (await res.json()) as {
      tables: { name: string; kind: string; csv: string }[];
    };
    expect(tables.map((t) => [t.name, t.kind])).toEqual([
      ['Work', 'board'],
      ['Costs', 'sheet'],
    ]);
    const [boardCsv, sheetCsv] = tables.map((t) => t.csv.split('\r\n'));
    // The board: a header, then a row per card in board order, statuses by their column names, a field's value, and
    // a title a spreadsheet would run as a formula made inert.
    expect(boardCsv![0]).toMatch(/^Key,Title,Type,Status,/);
    expect(boardCsv![0]).toContain('Priority');
    expect(boardCsv![1]).toMatch(/^1,Write it,Task,To Do,/);
    expect(boardCsv![1]).toContain('High');
    expect(boardCsv![2]).toMatch(/^2,"'=HYPERLINK\(""x""\)",Task,Finished,/);
    // The Sheet: each value as shown (a formula's result, the cards it counts), and text that would run made inert.
    expect(sheetCsv).toEqual(["2,6,'=1+1", '2,,', '']);
  });

  it('answers no tables for a plan with neither a board nor a Sheet, and 404 for no plan', async () => {
    const { get, plan, tab } = await arrange();
    await plan('A');
    await tab('A', { id: 't1', name: 'Notes', kind: 'diagram', elements: [shape('x1')] }, 0);
    // A Board tab whose board is unreadable has nothing to write.
    await tab('A', { id: 't2', name: 'Empty', kind: 'board', elements: [] }, 1);
    const res = await get('A/export?format=csv');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tables: [] });
    expect((await get('Z/export?format=csv')).status).toBe(404);
  });
});

describe('GET /api/internal/items/:id/export?format=comments', () => {
  it('answers every thread on the tabs, then every card thread, with real author ids, oldest first', async () => {
    const { db, get, plan, tab } = await arrange();
    await plan('A');
    await tab(
      'A',
      {
        id: 't1',
        name: 'Notes',
        kind: 'diagram',
        elements: [
          shape('x1', {
            commentThread: {
              resolved: true,
              comments: [comment('e2', 300, 'user_cy'), comment('e1', 100, 'user_ada')],
            },
          }),
          // An empty thread is no thread.
          shape('x2', { commentThread: { resolved: false, comments: [] } }),
        ],
      },
      0,
    );
    await tab(
      'A',
      {
        id: 't2',
        name: 'Budget',
        kind: 'sheet',
        elements: [
          sheetEl('s1', 'sheet0001', {
            // A comment another person's save carried before its author claimed it has no author yet.
            cellComments: { 'r001:c002': { resolved: false, comments: [comment('k1', 50, '')] } },
          }),
        ],
      },
      1,
    );
    await db.env.PLAN_DB.batch([
      insertThreadStatement(
        db.env,
        thread('th-late', 900, {
          resolved: true,
          resolvedAt: 950,
          comments: [comment('t2', 920, 'user_dee'), comment('t1', 900, 'user_bea')],
        }),
      ),
      // Started on a card in another plan, then put on one of this plan's: pinned to this plan's card.
      insertThreadStatement(
        db.env,
        thread('th-early', 400, {
          comments: [comment('t3', 400, undefined)],
          cards: [
            { projectId: 'B', itemId: 'other', key: 7 },
            { projectId: 'A', itemId: 'card2', key: 2 },
          ],
        }),
      ),
    ]);
    const res = await get('A/export?format=comments');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      threads: [
        {
          id: 'x1',
          tabId: 't1',
          tabName: 'Notes',
          on: 'x1',
          resolved: true,
          comments: [
            {
              id: 'e1',
              authorId: 'user_ada',
              authorName: 'Name of user_ada',
              text: 'said e1',
              createdAt: 100,
            },
            {
              id: 'e2',
              authorId: 'user_cy',
              authorName: 'Name of user_cy',
              text: 'said e2',
              createdAt: 300,
            },
          ],
        },
        {
          id: 's1:r001:c002',
          tabId: 't2',
          tabName: 'Budget',
          on: 's1',
          resolved: false,
          comments: [
            { id: 'k1', authorId: null, authorName: 'Someone', text: 'said k1', createdAt: 50 },
          ],
        },
        {
          id: 'th-early',
          tabId: null,
          tabName: null,
          on: 'card2',
          resolved: false,
          comments: [
            { id: 't3', authorId: null, authorName: 'Someone', text: 'said t3', createdAt: 400 },
          ],
        },
        {
          id: 'th-late',
          tabId: null,
          tabName: null,
          on: 'card1',
          resolved: true,
          comments: [
            {
              id: 't1',
              authorId: 'user_bea',
              authorName: 'Name of user_bea',
              text: 'said t1',
              createdAt: 900,
            },
            {
              id: 't2',
              authorId: 'user_dee',
              authorName: 'Name of user_dee',
              text: 'said t2',
              createdAt: 920,
            },
          ],
        },
      ],
    });
  });

  it('answers no threads for a plan with none, and 404 for no plan', async () => {
    const { get, plan } = await arrange();
    await plan('A');
    expect(await (await get('A/export?format=comments')).json()).toEqual({ threads: [] });
    expect((await get('Z/export?format=comments')).status).toBe(404);
  });

  it('keeps card threads started at once in id order, pins one on no card of this plan to its first card, and reads a comment with no time or words', async () => {
    const { db, get, plan } = await arrange();
    await plan('A');
    const bare = { ...comment('b1', 0, 'user_bea'), text: undefined, createdAt: undefined };
    await db.env.PLAN_DB.batch([
      insertThreadStatement(db.env, thread('th-b', 500)),
      insertThreadStatement(
        db.env,
        thread('th-a', 500, {
          comments: [comment('a2', 10, 'user_bea'), bare as unknown as Comment],
          cards: [{ projectId: 'B', itemId: 'elsewhere', key: 3 }],
        }),
      ),
    ]);
    const { threads } = (await (await get('A/export?format=comments')).json()) as {
      threads: { id: string; on: string | null; comments: { id: string; text: string }[] }[];
    };
    expect(threads.map((t) => [t.id, t.on])).toEqual([
      ['th-a', 'elsewhere'],
      ['th-b', 'card1'],
    ]);
    // A comment with no time sorts as the oldest; one with no words exports as empty.
    expect(threads[0]!.comments).toEqual([
      { id: 'b1', authorId: 'user_bea', authorName: 'Name of user_bea', text: '', createdAt: null },
      {
        id: 'a2',
        authorId: 'user_bea',
        authorName: 'Name of user_bea',
        text: 'said a2',
        createdAt: 10,
      },
    ]);
  });
});

describe('the data export key', () => {
  it('opens the csv and comments formats, which the Drive key does not, and no other door', async () => {
    const { get, plan } = await arrange();
    await plan('A');
    expect((await get('A/export?format=csv')).status).toBe(200);
    expect((await get('A/export?format=comments')).status).toBe(200);
    expect((await get('A/export?format=csv', 'index-key')).status).toBe(200);
    expect((await get('A/export?format=csv', DRIVE_KEY)).status).toBe(401);
    expect((await get('A/export?format=comments', DRIVE_KEY)).status).toBe(401);
    expect((await get('A', DATA_EXPORT_KEY, 'DELETE')).status).toBe(401);
  });
});

describe('the plan room', () => {
  it('answers a plan never started as not found, and asking does not start it', async () => {
    const { open } = planNamespace(() => ({}) as Env);
    const plan = open('never');
    expect(await plan.room.exportTables('never')).toEqual({ status: 'not_found' });
    expect(await plan.room.exportComments('never')).toEqual({ status: 'not_found' });
    expect(plan.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual(
      [],
    );
  });
});
