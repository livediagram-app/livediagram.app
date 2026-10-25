// The Drive mirror's two doors into a plan (liveworkspace/docs/drive.md "Contracts > The apps";
// docs/specs/015-api/api.md "Internal"): the plan as its `.liveplanner` file, and a new plan from one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TAB_BYTES } from '@liveplanner/api-schema';
import { defaultCatalogue, type Item } from '@liveplanner/items';
import { parseProjectEnvelope, type Element, type Tab } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';

// The index as the owner reaches it with this app's key: the items it is asked to make.
const { made } = vi.hoisted(() => ({
  made: [] as Record<string, unknown>[],
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: (_env: unknown, caller: { personId: string }) => ({
    createItem: async (input: Record<string, unknown>) => {
      made.push({ ...input, owner: caller.personId });
      return { item: { id: input.id }, grant: {} };
    },
    deleteItem: async () => {},
  }),
}));

import { insertItems } from '../db/items';
import { insertSheetStatements } from '../db/sheets';
import { upsertTab } from '../db/tabs';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { sqliteD1 } from '../test-sqlite-d1';
import { handleInternalItems } from './internal-items';

const DRIVE_KEY = 'drive-key';
const OWNER = 'user_ada';
const MIME = 'application/vnd.liveplanner+json';
const PERSON = { id: OWNER, name: 'Ada', color: '#123456' };

beforeEach(() => {
  made.length = 0;
});
afterEach(() => vi.restoreAllMocks());

const box = (id: string, link?: { kind: 'tab'; tabId: string }): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...(link ? { link } : {}),
});

const card: Item = {
  id: 'card1',
  type: 'task',
  key: 3,
  rank: 'a0',
  fields: { title: 'Write it' },
  rev: 2,
  createdAt: 10,
  updatedAt: 20,
  createdBy: PERSON,
  updatedBy: PERSON,
};

const sheet: SheetJson = {
  id: 'sheet0001',
  tabId: 't2',
  title: 'Budget',
  layout: { rows: ['r001'], cols: ['c001'] },
  cells: [{ r: 'r001', c: 'c001', i: { n: 42 } }],
  rev: 0,
  createdAt: 5,
  updatedAt: 5,
  updatedBy: PERSON,
};

async function arrange() {
  const db = sqliteD1({ INDEX_KEY: 'index-key', DRIVE_KEY });
  const send = (method: string, path: string, init: { body?: unknown; etag?: string } = {}) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${DRIVE_KEY}`,
          'Content-Type': 'application/json',
          ...(init.etag ? { 'If-None-Match': init.etag } : {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
      db.env,
    );
  // Ada's plan A: two tabs, the first linking to the second, the second in a folder with a Sheet; a card and its
  // types.
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', '${OWNER}', 'Roadmap', 0, 1, 1)`,
  );
  await upsertTab(
    db.env,
    'A',
    { id: 't1', name: 'One', elements: [box('b1', { kind: 'tab', tabId: 't2' })] },
    0,
  );
  await upsertTab(db.env, 'A', { id: 't2', name: 'Two', elements: [box('b2')] }, 1);
  db.sql.prepare("UPDATE plan_tabs SET folder = 'Later' WHERE tab_id = 't2'").run();
  await setPlanItemTypes(db.env, 'A', defaultCatalogue());
  await insertItems(db.env, 'A', [card]);
  await db.env.PLAN_DB.batch(insertSheetStatements(db.env, 'A', sheet, 5));
  db.sql.prepare('UPDATE plan SET saved_at = 1234 WHERE id = ?').run('A');
  return { db, send };
}

describe('GET /api/internal/items/:id/export?format=file', () => {
  it('answers the whole plan as its envelope, stamped with its last save', async () => {
    const { send } = await arrange();
    const res = await send('GET', 'A/export?format=file');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MIME);
    expect(res.headers.get('ETag')).toBe('"1234"');
    const text = await res.text();
    const parsed = parseProjectEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    const { envelope } = parsed;
    expect(envelope.kind).toBe('liveplanner.project');
    expect(envelope.exportedAt).toBe(1234);
    expect(envelope.project).toMatchObject({ id: 'A', name: 'Roadmap' });
    expect(envelope.project.tabs.map((t) => [t.id, t.name, t.folder])).toEqual([
      ['t1', 'One', undefined],
      ['t2', 'Two', 'Later'],
    ]);
    expect(envelope.project.items?.map((i) => [i.id, i.key])).toEqual([['card1', 3]]);
    expect(envelope.project.itemTypes).toBeTruthy();
    expect(envelope.project.sheets?.map((s) => [s.id, s.tabId, s.title])).toEqual([
      ['sheet0001', 't2', 'Budget'],
    ]);
    // Unchanged content is byte-identical.
    expect(await (await send('GET', 'A/export?format=file')).text()).toBe(text);
  });

  it('answers 304 for the save the caller holds, and 404 for no plan', async () => {
    const { send } = await arrange();
    const unchanged = await send('GET', 'A/export?format=file', { etag: '"1234"' });
    expect(unchanged.status).toBe(304);
    expect(unchanged.headers.get('ETag')).toBe('"1234"');
    expect((await send('GET', 'Z/export?format=file')).status).toBe(404);
  });
});

describe('POST /api/internal/items/import', () => {
  async function exported() {
    const world = await arrange();
    const file = await (await world.send('GET', 'A/export?format=file')).text();
    return { ...world, file };
  }
  const body = (file: string) => ({ owner: OWNER, folderId: 'F1', name: 'Roadmap copy', file });

  it('makes a new plan for the owner from an exported file, with fresh tab ids and links re-pointed', async () => {
    const { db, send, file } = await exported();
    const res = await send('POST', 'import', { body: body(file) });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).not.toBe('A');
    expect(made).toEqual([
      {
        id,
        app: 'liveplanner',
        title: 'Roadmap copy',
        folderId: 'F1',
        source: 'import',
        owner: OWNER,
      },
    ]);
    const meta = db.sql
      .prepare(
        'SELECT name, owner_id, created_at, item_types, items_next_key FROM plan WHERE id = ?',
      )
      .get(id) as {
      name: string;
      owner_id: string;
      created_at: number;
      item_types: string | null;
      items_next_key: number;
    };
    expect(meta).toMatchObject({ name: 'Roadmap copy', owner_id: OWNER, items_next_key: 4 });
    expect(meta.created_at).toBeGreaterThan(0);
    expect(meta.item_types).toBeTruthy();
    const tabs = db.sql
      .prepare(
        `SELECT t.id, t.name, dt.folder, t.data FROM plan_tabs dt JOIN tabs t ON t.id = dt.tab_id
          WHERE dt.plan_id = ? ORDER BY dt.order_index`,
      )
      .all(id) as { id: string; name: string; folder: string | null; data: string }[];
    expect(tabs.map((t) => [t.name, t.folder])).toEqual([
      ['One', null],
      ['Two', 'Later'],
    ]);
    expect(tabs.map((t) => t.id)).not.toContain('t1');
    expect(tabs.map((t) => t.id)).not.toContain('t2');
    const [first] = (JSON.parse(tabs[0]!.data) as { elements: { link?: unknown }[] }).elements;
    expect(first!.link).toEqual({ kind: 'tab', tabId: tabs[1]!.id });
    // The card and the Sheet came along, the Sheet on the copied tab.
    expect(db.sql.prepare('SELECT id, item_key FROM items WHERE plan_id = ?').all(id)).toEqual([
      { id: 'card1', item_key: 3 },
    ]);
    expect(
      db.sql.prepare('SELECT id, tab_id, title, cell_count FROM sheets WHERE plan_id = ?').all(id),
    ).toEqual([{ id: 'sheet0001', tab_id: tabs[1]!.id, title: 'Budget', cell_count: 1 }]);
    // The new plan exports as its own file.
    expect((await send('GET', `${id}/export?format=file`)).status).toBe(200);
  });

  it('refuses a file of another kind, or one that does not parse, with nothing made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send, file } = await exported();
    const other = file.replace('"liveplanner.project"', '"livedesign.design"');
    for (const bad of [other, 'not json', '{"kind":"liveplanner.project","schemaVersion":1}']) {
      const res = await send('POST', 'import', { body: body(bad) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_file' });
    }
    expect(made).toEqual([]);
  });

  it('refuses a tab past the tab cap as too large, with nothing made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send, file } = await exported();
    const envelope = JSON.parse(file) as { project: { tabs: Tab[] } };
    envelope.project.tabs[0]!.elements = [{ ...box('big'), label: 'x'.repeat(MAX_TAB_BYTES) }];
    const res = await send('POST', 'import', { body: body(JSON.stringify(envelope)) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    expect(made).toEqual([]);
  });

  it('is refused to the Drive key on any other door', async () => {
    const { send } = await arrange();
    expect((await send('DELETE', 'A')).status).toBe(401);
    expect((await send('POST', 'A/copy-to/B', { body: {} })).status).toBe(401);
  });
});
