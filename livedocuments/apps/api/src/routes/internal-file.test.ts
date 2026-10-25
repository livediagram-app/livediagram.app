// The Drive mirror's two doors into a document (liveworkspace/docs/drive.md "Contracts > The apps";
// docs/specs/015-api/api.md "Internal"): the document as its `.livedocuments` file, and a new document from one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TAB_BYTES } from '@livedocuments/api-schema';
import { parseDocumentEnvelope, type ShapeElement, type Tab } from '@livedocuments/document';

// The index as the owner reaches it with this app's key: the items it is asked to make, and to take away.
const { made, removed } = vi.hoisted(() => ({
  made: [] as Record<string, unknown>[],
  removed: [] as string[],
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: (_env: unknown, caller: { personId: string }) => ({
    createItem: async (input: { id: string }) => {
      made.push({ ...input, owner: caller.personId });
      return { item: { id: input.id }, grant: {} };
    },
    deleteItem: async (id: string) => void removed.push(id),
  }),
}));

import { upsertTab } from '../db/tabs';
import { liveDoc } from '../db/test-image-fixtures';
import { sqliteD1 } from '../test-sqlite-d1';
import { handleInternalItems } from './internal-items';

const DRIVE_KEY = 'drive-key';
const OWNER = 'user_ada';
const MIME = 'application/vnd.livedocuments+json';

beforeEach(() => {
  made.length = 0;
  removed.length = 0;
});
afterEach(() => vi.restoreAllMocks());

const box = (id: string, link?: ShapeElement['link']): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...(link ? { link } : {}),
});

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
  // Ada's document A: two tabs, the first linking to the second, the second in a folder, and a deck on the first.
  liveDoc(db.sql, 'A', OWNER, 'Plan');
  await upsertTab(
    db.env,
    'A',
    { id: 't1', name: 'One', elements: [box('b1', { kind: 'tab', tabId: 't2' })] },
    0,
  );
  await upsertTab(db.env, 'A', { id: 't2', name: 'Two', elements: [box('b2')] }, 1);
  db.sql.prepare("UPDATE document_tabs SET folder = 'Later' WHERE tab_id = 't2'").run();
  db.sql
    .prepare('UPDATE document SET presentation = ?, saved_at = 1234 WHERE id = ?')
    .run(JSON.stringify({ decks: [{ slides: [{ id: 's', tabId: 't1' }] }] }), 'A');
  return { db, send };
}

describe('GET /api/internal/items/:id/export?format=file', () => {
  it('answers the whole document as its envelope, stamped with its last save', async () => {
    const { send } = await arrange();
    const res = await send('GET', 'A/export?format=file');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MIME);
    expect(res.headers.get('ETag')).toBe('"1234"');
    const text = await res.text();
    const parsed = parseDocumentEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    const { envelope } = parsed;
    expect(envelope.kind).toBe('livedocuments.document');
    expect(envelope.exportedAt).toBe(1234);
    expect(envelope.document).toMatchObject({ id: 'A', name: 'Plan' });
    expect(envelope.document.tabs.map((t) => [t.id, t.name, t.folder])).toEqual([
      ['t1', 'One', undefined],
      ['t2', 'Two', 'Later'],
    ]);
    expect(envelope.document.presentation).toContain('"tabId":"t1"');
    // Unchanged content is byte-identical.
    expect(await (await send('GET', 'A/export?format=file')).text()).toBe(text);
  });

  it('answers 304 for the save the caller holds, and 404 for no document', async () => {
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
  const body = (file: string) => ({ owner: OWNER, folderId: 'F1', name: 'Plan copy', file });

  it('makes a new document for the owner from an exported file, with fresh ids and links re-pointed', async () => {
    const { db, send, file } = await exported();
    const res = await send('POST', 'import', { body: body(file) });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).not.toBe('A');
    expect(made).toEqual([
      {
        id,
        app: 'livedocuments',
        title: 'Plan copy',
        folderId: 'F1',
        source: 'import',
        owner: OWNER,
      },
    ]);
    const meta = db.sql
      .prepare('SELECT name, owner_id, created_at, presentation FROM document WHERE id = ?')
      .get(id) as { name: string; owner_id: string; created_at: number; presentation: string };
    expect(meta).toMatchObject({ name: 'Plan copy', owner_id: OWNER });
    expect(meta.created_at).toBeGreaterThan(0);
    const tabs = db.sql
      .prepare(
        `SELECT t.id, t.name, dt.folder, t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
          WHERE dt.document_id = ? ORDER BY dt.order_index`,
      )
      .all(id) as { id: string; name: string; folder: string | null; data: string }[];
    expect(tabs.map((t) => [t.name, t.folder])).toEqual([
      ['One', null],
      ['Two', 'Later'],
    ]);
    expect(tabs.map((t) => t.id)).not.toContain('t1');
    expect(tabs.map((t) => t.id)).not.toContain('t2');
    const [first] = (JSON.parse(tabs[0]!.data) as Pick<Tab, 'elements'>)
      .elements as ShapeElement[];
    expect(first!.link).toEqual({ kind: 'tab', tabId: tabs[1]!.id });
    expect(meta.presentation).toContain(`"tabId":"${tabs[0]!.id}"`);
    // The new document exports as its own file.
    expect((await send('GET', `${id}/export?format=file`)).status).toBe(200);
  });

  it('refuses a file of another kind, or one that does not parse, with nothing made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send, file } = await exported();
    const other = file.replace('"livedocuments.document"', '"livedesign.design"');
    for (const bad of [other, 'not json', '{"kind":"livedocuments.document","schemaVersion":1}']) {
      const res = await send('POST', 'import', { body: body(bad) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_file' });
    }
    expect(made).toEqual([]);
  });

  it('refuses a tab past the tab cap as too large, with nothing made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send, file } = await exported();
    const envelope = JSON.parse(file) as { document: { tabs: Tab[] } };
    envelope.document.tabs[0]!.elements = [
      { ...box('big'), label: 'x'.repeat(MAX_TAB_BYTES) },
    ];
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
