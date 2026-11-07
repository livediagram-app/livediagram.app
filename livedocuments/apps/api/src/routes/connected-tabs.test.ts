import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Level, TabConnection } from '@liveworkspace/index-client';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { ItemGrant } from '@liveworkspace/index-app';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { addConnectedDocumentTab, connectedTabArrival } from '../document-room/connected-tab';
import { exportDocumentCopy, importDocumentCopy } from '../document-room/document-content';
import { exportDocumentFile, readDocumentFile } from '../document-room/document-file';
import { redactDocumentForCommunity, redactDocumentForScope } from '../redact-document';
import { opForScope } from '../room-scope';

// Connected tabs in a document (liveworkspace/docs/specs/004-index/connected-tabs.md, blueprint "Each app"): the
// column, the editor's save that adds one and the index's confirm, the removal the index hears, the reverse write,
// scope and Community redaction, copies, exports, and who may do each (Editor, Participant, Viewer).

const told = { confirm: vi.fn(), remove: vi.fn() };
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  indexAppClient: () => ({
    confirmConnection: async (...args: unknown[]) => void told.confirm(...args),
    removeConnection: async (...args: unknown[]) => void told.remove(...args),
  }),
}));

const OWNER = 'user_owner';
const CONNECTION: TabConnection = { id: 'cn_abcdefghijklmnop', app: 'liveplanner', itemId: 'p1' };
const AGAIN: TabConnection = { id: 'cn_qrstuvwxyz012345', app: 'livedesign', itemId: 'g1' };

const grantAt = (level: Level, tab: string | null = null): ItemGrant => ({
  item: 'D',
  level,
  tab,
  sub: 'guest_00000000-0000-4000-8000-000000000002',
  team: null,
  exp: 9_999_999_999,
  shareCode: 'LINK',
  token: 'signed',
});

async function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: { body?: unknown; token?: boolean; grant?: ItemGrant; owner?: string } = {},
) {
  const waits: Promise<unknown>[] = [];
  const res = await handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: opts.owner ?? OWNER,
      accountUserId: opts.token ? null : (opts.owner ?? OWNER),
      verifiedUserId: opts.owner ?? OWNER,
      body: opts.body,
      token: opts.token ? { id: 'tok_1' } : null,
      ...(opts.grant ? { grant: opts.grant } : {}),
      waitUntil: (p) => void waits.push(p),
    }),
  );
  await Promise.all(waits);
  return res;
}

async function document(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/documents', {
    body: { id: 'D', name: 'Board', tabs: [{ id: 't1', name: 'Board', elements: [] }] },
  });
  expect(res.status).toBe(201);
  return db;
}

const column = (db: SqliteD1, tabId: string) =>
  db.sql.prepare('SELECT connection, data FROM tabs WHERE id = ?').get(tabId) as
    { connection: string | null; data: string } | undefined;

const addConnected = (db: SqliteD1, tabId = 't2', connection = CONNECTION, grant?: ItemGrant) =>
  call(db, 'PUT', `/api/documents/D/tabs/${tabId}`, {
    body: { id: tabId, name: 'Plan', elements: [], connection: { ...connection, code: 'secret' } },
    ...(grant ? { grant } : {}),
  });

beforeEach(() => {
  told.confirm.mockReset();
  told.remove.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('the editor adds a connected tab', () => {
  it('keeps exactly { id, app, itemId } in the column, never in the body, and confirms it', async () => {
    const db = await document();
    const res = await addConnected(db);
    expect(res.status).toBe(200);
    expect((await res.json<{ tab: { connection: unknown } }>()).tab.connection).toEqual(CONNECTION);
    const row = column(db, 't2')!;
    expect(JSON.parse(row.connection!)).toEqual(CONNECTION);
    expect(row.data).not.toContain('connection');
    expect(told.confirm).toHaveBeenCalledWith('D', CONNECTION.id, 't2');
  });

  it('reads it back on the tab, in the outline, and in the document', async () => {
    const db = await document();
    await addConnected(db);
    const tab = (await (await call(db, 'GET', '/api/documents/D/tabs/t2')).json()) as {
      tab: { connection?: TabConnection };
    };
    expect(tab.tab.connection).toEqual(CONNECTION);
    const doc = (await (await call(db, 'GET', '/api/documents/D')).json()) as {
      document: { tabs: { id: string; connection?: TabConnection }[] };
    };
    expect(doc.document.tabs.find((t) => t.id === 't2')?.connection).toEqual(CONNECTION);
    expect(doc.document.tabs.find((t) => t.id === 't1')?.connection).toBeUndefined();
  });

  it('keeps it through an autosave that leaves it out, and confirms only a new one', async () => {
    const db = await document();
    await addConnected(db);
    told.confirm.mockReset();
    await call(db, 'PUT', '/api/documents/D/tabs/t2', {
      body: { id: 't2', name: 'Plan', elements: [] },
    });
    expect(JSON.parse(column(db, 't2')!.connection!)).toEqual(CONNECTION);
    await addConnected(db);
    expect(told.confirm).not.toHaveBeenCalled();
    // Connect Again: the same tab, a new connection.
    await addConnected(db, 't2', AGAIN);
    expect(JSON.parse(column(db, 't2')!.connection!)).toEqual(AGAIN);
    expect(told.confirm).toHaveBeenCalledWith('D', AGAIN.id, 't2');
  });

  it('never turns a tab of content into a connected one', async () => {
    const db = await document();
    await addConnected(db, 't1');
    expect(column(db, 't1')!.connection).toBeNull();
    expect(told.confirm).not.toHaveBeenCalled();
  });

  it('drops a malformed connection', async () => {
    const db = await document();
    await call(db, 'PUT', '/api/documents/D/tabs/t2', {
      body: { id: 't2', name: 'Plan', elements: [], connection: { id: 'nope', app: 'x' } },
    });
    expect(column(db, 't2')!.connection).toBeNull();
  });
});

describe('share roles', () => {
  it('lets an Editor add one, and neither a Participant nor a Viewer', async () => {
    const db = await document();
    const other = 'guest_00000000-0000-4000-8000-000000000002';
    for (const level of ['view', 'participate'] as const) {
      const res = await call(db, 'PUT', '/api/documents/D/tabs/t2', {
        body: { id: 't2', name: 'Plan', elements: [], connection: CONNECTION },
        grant: grantAt(level),
        owner: other,
      });
      expect(res.status).toBe(403);
      expect(column(db, 't2')).toBeUndefined();
    }
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t2', {
      body: { id: 't2', name: 'Plan', elements: [], connection: CONNECTION },
      grant: grantAt('edit'),
      owner: other,
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(column(db, 't2')!.connection!)).toEqual(CONNECTION);
  });

  it('shows every role the connected tab, and only an Editor removes it', async () => {
    const db = await document();
    await addConnected(db);
    const other = 'guest_00000000-0000-4000-8000-000000000002';
    for (const level of ['view', 'participate', 'edit'] as const) {
      const read = await call(db, 'GET', '/api/documents/D/tabs/t2', {
        grant: grantAt(level),
        owner: other,
      });
      expect((await read.json<{ tab: { connection?: unknown } }>()).tab.connection).toEqual(
        CONNECTION,
      );
    }
    for (const level of ['view', 'participate'] as const) {
      const res = await call(db, 'DELETE', '/api/documents/D/tabs/t2', {
        grant: grantAt(level),
        owner: other,
      });
      expect(res.status).toBe(403);
    }
    expect(told.remove).not.toHaveBeenCalled();
    const res = await call(db, 'DELETE', '/api/documents/D/tabs/t2', {
      grant: grantAt('edit'),
      owner: other,
    });
    expect(res.status).toBe(204);
    expect(told.remove).toHaveBeenCalledWith('D', CONNECTION.id, 't2');
  });
});

describe('removing', () => {
  it('tells the index once a connected tab has left, and nothing for any other tab', async () => {
    const db = await document();
    await addConnected(db);
    await call(db, 'PUT', '/api/documents/D/tabs/t3', {
      body: { id: 't3', name: 'Other', elements: [] },
    });
    expect((await call(db, 'DELETE', '/api/documents/D/tabs/t3')).status).toBe(204);
    expect(told.remove).not.toHaveBeenCalled();
    expect((await call(db, 'DELETE', '/api/documents/D/tabs/t2')).status).toBe(204);
    expect(told.remove).toHaveBeenCalledWith('D', CONNECTION.id, 't2');
    expect(column(db, 't2')).toBeUndefined();
  });
});

describe('agents and the API', () => {
  it('keep no connection on a create', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', {
      token: true,
      body: {
        id: 'D',
        name: 'Board',
        tabs: [{ id: 't1', name: 'Plan', elements: [], connection: CONNECTION }],
      },
    });
    expect(res.status).toBe(201);
    expect(column(db, 't1')!.connection).toBeNull();
  });

  it('keep a well-formed one on an editor’s create (an Offline Mode sync), out of the body', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', {
      body: {
        id: 'D',
        name: 'Board',
        tabs: [{ id: 't1', name: 'Plan', elements: [], connection: { ...CONNECTION, x: 1 } }],
      },
    });
    const row = column(db, 't1')!;
    expect(JSON.parse(row.connection!)).toEqual(CONNECTION);
    expect(row.data).not.toContain('connection');
  });
});

describe('the reverse write', () => {
  it('appends an empty, loose tab holding the connection, once per connection', async () => {
    const db = await document();
    const write = { name: 'Roadmap', connection: CONNECTION };
    const made = await addConnectedDocumentTab(db.env, 'D', write);
    expect(made).toMatchObject({ made: true });
    const tabId = (made as { tabId: string }).tabId;
    expect(await addConnectedDocumentTab(db.env, 'D', write)).toEqual({ tabId, made: false });
    const row = db.sql
      .prepare(
        'SELECT t.name, t.data, t.connection, dt.order_index, dt.folder FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id WHERE t.id = ?',
      )
      .get(tabId) as Record<string, unknown>;
    expect(row).toMatchObject({ name: 'Roadmap', order_index: 1, folder: null });
    expect(JSON.parse(row.data as string)).toEqual({ elements: [] });
    expect(JSON.parse(row.connection as string)).toEqual(CONNECTION);
    // What open editors hear: the tab bar with it at the end.
    expect(await connectedTabArrival(db.env, 'D')).toEqual({
      kind: 'document-meta',
      name: 'Board',
      tabs: [
        { id: 't1', name: 'Board', orderIndex: 0 },
        { id: tabId, name: 'Roadmap', orderIndex: 1, connection: CONNECTION },
      ],
    });
  });

  it('is not_found for a document not started', async () => {
    const db = sqliteD1();
    expect(
      await addConnectedDocumentTab(db.env, 'none', { name: 'x', connection: CONNECTION }),
    ).toBe('not_found');
    expect(await connectedTabArrival(db.env, 'none')).toBeNull();
  });
});

describe('scope and Community', () => {
  it('drops a connection with its name outside a tab-scoped visitor’s scope', async () => {
    const db = await document();
    await addConnected(db);
    const doc = (await (await call(db, 'GET', '/api/documents/D')).json()) as {
      document: Parameters<typeof redactDocumentForScope>[0];
    };
    const scoped = redactDocumentForScope(doc.document, 't1');
    expect(scoped.tabs.find((t) => t.id === 't2')).not.toHaveProperty('connection');
    expect(redactDocumentForCommunity(doc.document).tabs.some((t) => 'connection' in t)).toBe(
      false,
    );
    const op = opForScope(
      {
        kind: 'document-meta',
        name: 'Board',
        tabs: [{ id: 't2', name: 'Plan', orderIndex: 1, connection: CONNECTION }],
      },
      't1',
    ) as { tabs: Record<string, unknown>[] };
    expect(op.tabs[0]).not.toHaveProperty('connection');
  });
});

describe('copies and exports', () => {
  it('carry exactly { id, app, itemId }, and nothing through a Community link', async () => {
    const db = await document();
    await addConnected(db);
    const copy = (await exportDocumentCopy(db.env, 'D', null, null))!;
    const copied = copy.tabs.find((t) => t.name === 'Plan')!;
    expect(copied.connection).toEqual(CONNECTION);
    expect(copied.data).not.toContain('connection');
    const community = (await exportDocumentCopy(db.env, 'D', null, null, true))!;
    expect(community.tabs.find((t) => t.name === 'Plan')!.connection).toBeNull();
    await importDocumentCopy(db.env, 'C', copy);
    expect(JSON.parse(column(db, copied.id)!.connection!)).toEqual(CONNECTION);
  });

  it('writes it into the Drive file, and reads it back from one', async () => {
    const db = await document();
    await addConnected(db);
    const file = await exportDocumentFile(db.env, 'D', null);
    expect(file.status).toBe('ok');
    const text = (file as { body: string }).body;
    expect(text).toContain('"connection"');
    expect(text).not.toContain('secret');
    const read = readDocumentFile(text);
    expect(read.ok).toBe(true);
    const tabs = (read as { content: { copy: { tabs: { connection?: unknown; data: string }[] } } })
      .content.copy.tabs;
    expect(tabs.map((t) => t.connection ?? null)).toEqual([null, CONNECTION]);
    expect(tabs.every((t) => !t.data.includes('connection'))).toBe(true);
  });
});
