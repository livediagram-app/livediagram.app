import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@livediagram/vitest-config/cpu-time';
import type { Element } from '@livediagram/document';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { nodeDocumentSql, nodeTransaction } from '../test-document-sql';
import type { Env } from '../types';
import { DRAIN_TABS } from './document-outbox';
import { MAINTENANCE_EVERY_MS, DocumentRoom } from './document-room';

// Each document's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the document's object, which answers from its own SQLite and
// pushes what D1's cross-document reads need through its outbox. Every document here gets its OWN in-memory database (the
// object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between documents but
// D1, as in production.

vi.mock('../auth/accounts', () => ({
  getAccountIdentity: async () => null,
  accountCredentials: () => null,
}));

const box = (id: string, label = id): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label,
});

type Document = { room: DocumentRoom; db: DatabaseSync; transactions: number };

// The DOCUMENT_ROOM namespace: one DocumentRoom per name, each on its own database, with the calls the worker made.
function documentNamespace(envOf: () => Env) {
  const documents = new Map<string, Document>();
  const calls: string[] = [];
  const open = (name: string): Document => {
    const existing = documents.get(name);
    if (existing) return existing;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const store = new Map<string, unknown>();
    const transaction = nodeTransaction(db);
    const document = { db, transactions: 0 } as Document;
    const id = {
      name,
      equals: (other: { name?: string }) => other?.name === name,
      toString: () => name,
    };
    const state = {
      id,
      storage: {
        sql: nodeDocumentSql(db),
        transactionSync: <T>(fn: () => T): T => {
          document.transactions += 1;
          return transaction(fn);
        },
        get: async (key: string) => store.get(key),
        put: async (key: string, value: unknown) => void store.set(key, value),
        delete: async (key: string) => store.delete(key),
        list: async ({ prefix }: { prefix: string }) =>
          new Map([...store].filter(([key]) => key.startsWith(prefix))),
        setAlarm: async () => {},
        deleteAlarm: async () => {},
        // The runtime's deleteAll drops the SQLite database with the key-value pairs.
        deleteAll: async () => {
          store.clear();
          db.exec('PRAGMA foreign_keys = OFF');
          const tables = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .all();
          for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${String(t.name)}"`);
          db.exec('PRAGMA foreign_keys = ON');
        },
      },
      sockets: [] as WebSocket[],
      acceptWebSocket(ws: WebSocket) {
        state.sockets.push(ws);
      },
      getWebSockets: () => [...state.sockets],
      blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
      waitUntil: () => {},
    };
    document.room = new DocumentRoom(state as unknown as DurableObjectState, envOf());
    documents.set(name, document);
    return document;
  };
  const ns = {
    idFromName: (name: string) => ({ name, equals: (o: { name?: string }) => o?.name === name }),
    get: (id: { name: string }) => {
      const { room } = open(id.name);
      return new Proxy(room, {
        get(target, prop, receiver) {
          const value: unknown = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
    },
  };
  return { ns, documents, calls, open };
}

type World = {
  d1: SqliteD1;
  env: Env;
  documents: Map<string, Document>;
  calls: string[];
  send: (
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>;
};

function world(extra: Partial<Env> = {}): World {
  const d1 = sqliteD1();
  const env = { DB: d1.env.DB, WORKBENCH: d1.env.WORKBENCH, ...extra } as unknown as Env;
  const { ns, documents, calls } = documentNamespace(() => env);
  Reflect.set(env, 'DOCUMENT_ROOM', ns);
  const executionCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  const send = (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: { 'X-Owner-Id': 'owner', 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      executionCtx,
    );
  return { d1, env, documents, calls, send };
}

async function createDocument(
  w: World,
  id: string,
  tabs = [{ id: 't1', name: 'Board', elements: [box('a')] }],
) {
  const res = await w.send('POST', '/api/documents', { id, name: id, tabs });
  expect(res.status).toBe(201);
}

const count = (db: DatabaseSync, table: string) =>
  Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a document's content lives in its own Durable Object", () => {
  it('keeps each document in its own SQLite, D1 holding only the document row', async () => {
    const w = world();
    await createDocument(w, 'A');
    await createDocument(w, 'B', [
      { id: 't1', name: 'Same id, other document', elements: [box('b')] },
    ]);
    expect(count(w.documents.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.documents.get('B')!.db, 'tabs')).toBe(1);
    // D1 has the rows, and none of the content (its document tables are the test store's, never written here).
    expect(
      w.d1.sql
        .prepare('SELECT id FROM documents ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['A', 'B']);
    expect(count(w.d1.sql, 'tabs')).toBe(0);
  });

  it('saves a tab in one call to the document and one transaction, and reads it back in one call', async () => {
    const w = world();
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    w.calls.length = 0;
    const before = document.transactions;
    const saved = await w.send('PUT', '/api/documents/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a', 'Edited'), box('c')],
    });
    expect(saved.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    expect(document.transactions - before).toBe(1);

    w.calls.length = 0;
    const read = await w.send('GET', '/api/documents/A/tabs/t1');
    expect(read.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    const tab = await read.json<{ tab: { elements: { label?: string }[] } }>();
    expect(tab.tab.elements.map((e) => e.label)).toEqual(['Edited', 'c']);
  });

  it('pushes what D1 indexes (the listing summary, the Inbox) from its outbox', async () => {
    const w = world();
    await createDocument(w, 'A', [{ id: 't1', name: 'Board', elements: [] }]);
    const action = {
      ...box('act'),
      action: {
        id: 'act-1',
        name: 'Do it',
        description: '',
        assignee: { userId: 'owner', name: 'Owner' },
        teamId: null,
        assignerId: 'owner',
        assignerName: 'Owner',
        status: 'open',
        createdAt: 1,
        updatedAt: 1,
      },
    } as unknown as Element;
    await w.send('PUT', '/api/documents/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [action],
    });
    const document = w.documents.get('A')!;
    expect(count(document.db, 'outbox')).toBeGreaterThan(0);
    expect(count(w.d1.sql, 'collab_actions')).toBe(0);

    await document.room.drain();

    expect(count(document.db, 'outbox')).toBe(0);
    expect(
      w.d1.sql.prepare('SELECT document_id, tab_id, tab_name FROM collab_actions').all(),
    ).toEqual([{ document_id: 'A', tab_id: 't1', tab_name: 'Board' }]);
    const summary = w.d1.sql.prepare("SELECT content_summary FROM documents WHERE id = 'A'").get()!;
    expect(JSON.parse(String(summary.content_summary))).toMatchObject({ hasContent: true });
  });

  it('keeps the images its tabs place, answers the share check itself, and pushes the set to D1', async () => {
    const w = world();
    const picture = (id: string, imageId: string) =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await createDocument(w, 'A', [
      { id: 't1', name: 'One', elements: [picture('p1', 'img-1')] },
      { id: 't2', name: 'Two', elements: [picture('p2', 'img-2')] },
    ]);
    const document = w.documents.get('A')!;
    expect(
      document.db.prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id').all(),
    ).toEqual([
      { tab_id: 't1', image_id: 'img-1' },
      { tab_id: 't2', image_id: 'img-2' },
    ]);
    // Placed a moment ago, before any push: the document itself answers, for the whole document or one tab.
    expect(await document.room.placesImage('A', 'img-2', null)).toBe(true);
    expect(await document.room.placesImage('A', 'img-2', 't1')).toBe(false);
    expect(await document.room.placesImage('A', 'img-3', null)).toBe(false);
    expect(count(w.d1.sql, 'document_images')).toBe(0);

    await document.room.drain();
    expect(
      w.d1.sql
        .prepare('SELECT image_id FROM document_images ORDER BY image_id')
        .all()
        .map((r) => r.image_id),
    ).toEqual(['img-1', 'img-2']);
  });

  it('runs its daily upkeep from its alarm: old changesets go', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    document.db
      .prepare(
        `INSERT INTO agent_changesets (id, document_id, tab_id, rev, base_rev, author_id, author_name, author_color,
           fingerprints, added, changed, removed, created_at)
         VALUES ('cs_old', 'A', 't1', 1, 0, 'u', 'U', '#000', '{}', 0, 0, 0, 1)`,
      )
      .run();
    vi.setSystemTime(Date.now() + MAINTENANCE_EVERY_MS + 1);
    await document.room.alarm();
    expect(count(document.db, 'agent_changesets')).toBe(0);
  });
});

// A tab shared between documents (docs/specs/006-document/tab-document-many-to-many.md): each holder keeps a copy
// under the same tab id, and a write in one reaches the others when its room drains (document-room/tab-shares.ts).
describe('a tab shared between documents', () => {
  const link = (w: World, target: string, tabId: string, from: string, owner = 'owner') =>
    w.send(
      'POST',
      `/api/documents/${target}/tabs/${tabId}/link`,
      { from },
      { 'X-Owner-Id': owner },
    );
  const labels = (w: World, documentId: string, tabId = 't1') => {
    const row = w.documents
      .get(documentId)!
      .db.prepare('SELECT data FROM tabs WHERE id = ?')
      .get(tabId);
    if (!row) return null;
    return (JSON.parse(String(row.data)) as { elements: { label?: string }[] }).elements.map(
      (e) => e.label,
    );
  };
  const holders = (w: World, documentId: string, tabId = 't1') =>
    w.documents
      .get(documentId)!
      .db.prepare('SELECT document_id FROM tab_shares WHERE tab_id = ? ORDER BY document_id')
      .all(tabId)
      .map((r) => r.document_id);
  const save = (w: World, documentId: string, label: string, tabId = 't1') =>
    w.send('PUT', `/api/documents/${documentId}/tabs/${tabId}`, {
      id: tabId,
      name: 'Board',
      elements: [box('a', label)],
    });
  const drain = async (w: World, ...documentIds: string[]) => {
    for (const id of documentIds) await w.documents.get(id)!.room.drain();
  };
  const sharedTabs = async (w: World, documentId: string) => {
    const body: { sharedTabs: unknown } = await (
      await w.send('GET', `/api/documents/${documentId}/shared-tabs`)
    ).json();
    return body.sharedTabs;
  };

  async function twoDocuments() {
    const w = world();
    await createDocument(w, 'A', [{ id: 't1', name: 'Board', elements: [box('a', 'From A')] }]);
    await createDocument(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    return w;
  }

  it('adds the tab to the other document, the same tab in both', async () => {
    const w = await twoDocuments();
    const res = await link(w, 'B', 't1', 'A');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tab: { id: 't1', name: 'Board', orderIndex: 1 } });
    expect(labels(w, 'B')).toEqual(['From A']);
    expect(holders(w, 'A')).toEqual(['B']);
    expect(holders(w, 'B')).toEqual(['A']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, documents: 1 });
    expect(await sharedTabs(w, 'B')).toEqual({ tabs: 1, documents: 1 });
    // A repeat is answered as it is.
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    expect(count(w.documents.get('B')!.db, 'tabs')).toBe(2);
  });

  it('carries an edit in either document to the other, without sending it back', async () => {
    const w = await twoDocuments();
    await link(w, 'B', 't1', 'A');
    await drain(w, 'A', 'B');

    await save(w, 'A', 'Edited in A');
    expect(labels(w, 'B')).toEqual(['From A']);
    await drain(w, 'A');
    expect(labels(w, 'B')).toEqual(['Edited in A']);
    expect(count(w.documents.get('B')!.db, 'share_outbox')).toBe(0);

    await new Promise((r) => setTimeout(r, 2));
    const renamed = await w.send('PUT', '/api/documents/B/tabs/t1/name', { name: 'Renamed in B' });
    expect(renamed.status).toBe(200);
    await save(w, 'B', 'Edited in B');
    await drain(w, 'B');
    expect(labels(w, 'A')).toEqual(['Edited in B']);
    expect(count(w.documents.get('A')!.db, 'share_outbox')).toBe(0);
    // The Inbox and listing pushes still follow the copy taken in.
    expect(count(w.documents.get('A')!.db, 'outbox')).toBeGreaterThan(0);
  });

  it('keeps the later of two writes in every document', async () => {
    const w = await twoDocuments();
    await link(w, 'B', 't1', 'A');
    await save(w, 'B', 'Earlier');
    await new Promise((r) => setTimeout(r, 2));
    await save(w, 'A', 'Later');
    // B sends its earlier write first: A keeps its own, later one, and B takes A's.
    await drain(w, 'B', 'A');
    expect(labels(w, 'A')).toEqual(['Later']);
    expect(labels(w, 'B')).toEqual(['Later']);
  });

  it('shares on through a third document, which every holder then hears of', async () => {
    const w = await twoDocuments();
    await createDocument(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    expect((await link(w, 'C', 't1', 'B')).status).toBe(200);
    expect(holders(w, 'C')).toEqual(['A', 'B']);
    // A hears of C from B's drain.
    expect(holders(w, 'A')).toEqual(['B']);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['B', 'C']);

    await new Promise((r) => setTimeout(r, 2));
    await save(w, 'C', 'Edited in C');
    await drain(w, 'C');
    expect(labels(w, 'A')).toEqual(['Edited in C']);
    expect(labels(w, 'B')).toEqual(['Edited in C']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, documents: 2 });
  });

  it('passes a write on to a holder the writer had not heard of yet', async () => {
    const w = await twoDocuments();
    await createDocument(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    await link(w, 'C', 't1', 'B');
    // A writes before B's drain has told it of C: B, taking A's write, passes it on to C.
    await new Promise((r) => setTimeout(r, 2));
    await save(w, 'A', 'Edited in A');
    await drain(w, 'A');
    expect(labels(w, 'C')).toEqual(['From A']);
    await drain(w, 'B');
    expect(labels(w, 'C')).toEqual(['Edited in A']);
  });

  it('leaves the others their copy when one document drops the tab, or goes for good', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A', [{ id: 't1', name: 'Board', elements: [box('a', 'From A')] }]);
    for (const id of ['B', 'C']) {
      await createDocument(w, id, [{ id: `t${id}`, name: 'Own', elements: [] }]);
      await link(w, id, 't1', 'A');
    }
    await drain(w, 'A');

    expect((await w.send('DELETE', '/api/documents/B/tabs/t1')).status).toBe(204);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['C']);
    expect(holders(w, 'C')).toEqual(['A']);
    expect(labels(w, 'A')).toEqual(['From A']);

    const purged = await w.send('DELETE', '/api/internal/items/C', undefined, {
      Authorization: 'Bearer index-key',
    });
    expect(purged.status).toBe(200);
    expect(holders(w, 'A')).toEqual([]);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 0, documents: 0 });
    expect(labels(w, 'A')).toEqual(['From A']);
  });

  it('drops a holder that no longer has the tab when it says so', async () => {
    const w = await twoDocuments();
    await link(w, 'B', 't1', 'A');
    // B lost the tab without a word (its leave never arrived).
    w.documents.get('B')!.db.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    await save(w, 'A', 'Edited in A');
    await drain(w, 'A');
    expect(holders(w, 'A')).toEqual([]);
    expect(count(w.documents.get('A')!.db, 'share_outbox')).toBe(0);
  });

  it('is only for the owner of both documents, and a tab the other one holds', async () => {
    const w = await twoDocuments();
    expect((await link(w, 'B', 't1', 'A', 'stranger')).status).toBe(403);
    await w.send(
      'POST',
      '/api/documents',
      { id: 'S', name: 'S', tabs: [{ id: 's1', name: 'S', elements: [] }] },
      { 'X-Owner-Id': 'stranger' },
    );
    expect((await link(w, 'B', 's1', 'S')).status).toBe(403);
    expect((await link(w, 'B', 'nope', 'A')).status).toBe(404);
    expect((await link(w, 'B', 't1', 'missing')).status).toBe(404);
    expect((await w.send('POST', '/api/documents/B/tabs/t1/link', {})).status).toBe(400);
    expect((await link(w, 'A', 't1', 'A')).status).toBe(400);
    expect(count(w.documents.get('B')!.db, 'tabs')).toBe(1);
  });
});

describe('/api/internal/items (docs/specs/015-api/api.md "Internal")', () => {
  const auth = { Authorization: 'Bearer index-key' };

  it('is a plain 404 without INDEX_KEY, and 401 for a wrong key', async () => {
    const off = world();
    expect((await off.send('DELETE', '/api/internal/items/A', undefined, auth)).status).toBe(404);
    const on = world({ INDEX_KEY: 'index-key' });
    const wrong = await on.send('DELETE', '/api/internal/items/A', undefined, {
      Authorization: 'Bearer nope',
    });
    expect(wrong.status).toBe(401);
    expect(on.calls).toEqual([]);
  });

  it('copies a document, or one tab of it, into a new document', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A', [
      { id: 't1', name: 'One', elements: [box('a')] },
      { id: 't2', name: 'Two', elements: [box('b')] },
    ]);
    const all = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(all.status).toBe(201);
    expect(count(w.documents.get('C')!.db, 'tabs')).toBe(2);

    const one = await w.send('POST', '/api/internal/items/A/copy-to/D', { tabId: 't2' }, auth);
    expect(one.status).toBe(201);
    expect(w.documents.get('D')!.db.prepare('SELECT name FROM tabs').all()).toEqual([
      { name: 'Two' },
    ]);

    const missing = await w.send(
      'POST',
      '/api/internal/items/A/copy-to/E',
      { tabId: 'nope' },
      auth,
    );
    expect(missing.status).toBe(404);
    const again = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(again.status).toBe(409);
  });

  it('purges a document: every row, every session', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    const res = await w.send('DELETE', '/api/internal/items/A', undefined, auth);
    expect(res.status).toBe(200);
    expect(
      document.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n,
    ).toBe(0);
  });

  it('ends the sessions of revoked codes, refusing a body that is not codes', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const ok = await w.send('POST', '/api/internal/items/A/revoke', { codes: ['abc'] }, auth);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, closed: 0 });
    const bad = await w.send('POST', '/api/internal/items/A/revoke', { codes: 'abc' }, auth);
    expect(bad.status).toBe(400);
  });
});

// Performance (docs/specs/015-api/api.md "Storage"): a save is one call and one transaction whatever its size, a
// read one call however many tabs. CPU budgets, as the other speed tests (cpu-time.js).
describe('speed', () => {
  it('saves and reads a 1 MB tab within budget', async () => {
    const w = world();
    await createDocument(w, 'A');
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    const body = { id: 't1', name: 'Board', elements };
    expect(JSON.stringify(body).length).toBeGreaterThan(1_000_000);
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/documents/A/tabs/t1', body)).status;
    });
    expect(status).toBe(200);
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/documents/A/tabs/t1');
      status = res.status;
      await res.text();
    });
    expect(status).toBe(200);
    const drainMs = await cpuMsOfAsync(() => w.documents.get('A')!.room.drain());
    console.info('[perf] 1 MB tab', { saveMs, readMs, drainMs });
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(readMs).toBeLessThan(cpuBudgetMs(100));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });

  it('sends an edit of a 1 MB tab shared with 20 documents within budget', async () => {
    const w = world();
    await createDocument(w, 'A');
    for (let i = 0; i < 20; i++) {
      await createDocument(w, `S${i}`, [{ id: `own${i}`, name: 'Own', elements: [] }]);
      const res = await w.send('POST', `/api/documents/S${i}/tabs/t1/link`, { from: 'A' });
      expect(res.status).toBe(200);
    }
    // Each join told the holders before it: 190 messages, a drain of 50 at a time.
    const a = w.documents.get('A')!;
    while (count(a.db, 'share_outbox') > 0) await a.room.drain();
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    await new Promise((r) => setTimeout(r, 2));
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (
        await w.send('PUT', '/api/documents/A/tabs/t1', { id: 't1', name: 'Board', elements })
      ).status;
    });
    expect(status).toBe(200);
    const fanOutMs = await cpuMsOfAsync(() => w.documents.get('A')!.room.drain());
    console.info('[perf] 1 MB tab shared with 20', { saveMs, fanOutMs });
    const last = w.documents
      .get('S19')!
      .db.prepare("SELECT element_count FROM tabs WHERE id = 't1'");
    expect(last.get()!.element_count).toBe(2_500);
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(fanOutMs).toBeLessThan(cpuBudgetMs(2_000));
  });

  it('saves a tab placing 500 images and pushes the set within budget', async () => {
    const w = world();
    await createDocument(w, 'A');
    const picture = (i: number) =>
      ({
        id: `p${i}`,
        type: 'image',
        x: i,
        y: 0,
        width: 10,
        height: 10,
        imageId: `img-${i}`,
      }) as unknown as Element;
    const body = {
      id: 't1',
      name: 'Board',
      elements: Array.from({ length: 500 }, (_, i) => picture(i)),
    };
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/documents/A/tabs/t1', body)).status;
    });
    expect(status).toBe(200);
    const drainMs = await cpuMsOfAsync(() => w.documents.get('A')!.room.drain());
    expect(count(w.d1.sql, 'document_images')).toBe(500);
    // A save that keeps the set writes no reference and owes D1 no image push.
    const again = {
      ...body,
      elements: body.elements.map((e) => ({ ...e, x: (e as { x: number }).x + 1 })),
    };
    const resaveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/documents/A/tabs/t1', again)).status;
    });
    expect(status).toBe(200);
    expect(
      w.documents
        .get('A')!
        .db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE kind = 'images'")
        .get()!.n,
    ).toBe(0);
    console.info('[perf] 500-image tab', { saveMs, drainMs, resaveMs });
    expect(saveMs).toBeLessThan(cpuBudgetMs(100));
    expect(drainMs).toBeLessThan(cpuBudgetMs(100));
    expect(resaveMs).toBeLessThan(cpuBudgetMs(100));
  });

  it('reads a 200-tab document in one call within budget', async () => {
    const w = world();
    const tabs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 20 }, (_, j) => box(`e${i}-${j}`)),
    }));
    await createDocument(w, 'A', tabs);
    w.calls.length = 0;
    let status = 0;
    let listed = 0;
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/documents/A');
      status = res.status;
      listed = (await res.json<{ document: { tabs: unknown[] } }>()).document.tabs.length;
    });
    expect(status).toBe(200);
    expect(listed).toBe(200);
    expect(w.calls).toEqual(['route']);
    // The push to D1 goes DRAIN_TABS tabs at a time, each batch bounded whatever the document's size.
    const document = w.documents.get('A')!;
    const d1 = w.env.DB as unknown as { batch: (s: unknown[]) => Promise<unknown> };
    const batch = d1.batch.bind(d1);
    const sizes: number[] = [];
    d1.batch = (statements) => {
      sizes.push(statements.length);
      return batch(statements);
    };
    const drainMs = await cpuMsOfAsync(async () => {
      while (count(document.db, 'outbox') > 0) await document.room.drain();
    });
    console.info('[perf] 200-tab document', { readMs, drainMs, batches: sizes });
    expect(sizes).toHaveLength(Math.ceil(200 / DRAIN_TABS));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DRAIN_TABS * 4 + 2);
    expect(readMs).toBeLessThan(cpuBudgetMs(50));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });
});
