import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livedocuments/document';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor } from '../test-media-service';
import { mediaImages } from '../db/test-image-fixtures';
import { mediaOwner } from '../media';
import { MAX_TAB_HOLDERS } from '@liveworkspace/index-app';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { Env } from '../types';
import { DRAIN_TABS } from './document-outbox';
import { MAINTENANCE_EVERY_MS, DocumentRoom } from './document-room';

// Each document's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the document's object, which answers from its own SQLite and
// pushes what the index and the media service need through its outbox. Every document here gets its OWN in-memory
// database (the object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between
// documents, as in production.

// `Bearer guest:<id>` stands in for a verified guest token; any other bearer is the owner's.
vi.mock('../auth/accounts', () => ({
  getPersonIdentity: async (_env: unknown, request: Request) => {
    const bearer = request.headers.get('Authorization') ?? '';
    return {
      kind: 'guest',
      guestId: bearer.startsWith('Bearer guest:')
        ? bearer.slice('Bearer guest:'.length)
        : 'guest_owner',
    };
  },
  accountCredentials: () => null,
}));

const OWNER = 'guest_owner';
const as = (person: string) => ({ Authorization: `Bearer guest:${person}` });

// The index's grants, signed by a stand-in (`G.<claims>`): `person` edits the document it names (`level` and
// `shareCode`, a link's, for the access tests).
const grantOf = (item: string, person = OWNER, level = 'edit') =>
  `G.${btoa(JSON.stringify({ item, sub: person, level, tab: null, team: null, exp: 9e9 }))}`;
beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});

// What reached the index: every push the documents made, answered as stored. A grant a document asks for (a tab
// linked in from another of the caller's documents) is given at `levelOf(document, person)`, as the index would:
// the owner edits their own, anyone else gets nothing unless a test says otherwise.
const indexCalls: string[] = [];
let ownerOf: (documentId: string) => string | null = () => OWNER;
let levelOf: (documentId: string, person: string) => string | null = (id, person) =>
  ownerOf(id) === person ? 'edit' : null;
beforeEach(() => {
  indexCalls.length = 0;
  ownerOf = () => OWNER;
  levelOf = (id, person) => (ownerOf(id) === person ? 'edit' : null);
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    indexCalls.push(`${req.method} ${path}`);
    const asked = /^\/api\/index\/items\/([^/]+)\/grant$/.exec(path);
    if (asked) {
      const id = decodeURIComponent(asked[1]!);
      const bearer = req.headers.get('Authorization') ?? '';
      const person = bearer.startsWith('Bearer guest:') ? bearer.slice(13) : OWNER;
      const level = levelOf(id, person);
      if (!level) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({
        grant: grantOf(id, person, level),
        level,
        tabId: null,
        expiresAt: 9e12,
      });
    }
    return Response.json({ ok: true });
  });
});

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
        sql: nodeItemSql(db),
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

const personOf = (headers: Record<string, string>) =>
  headers.Authorization?.startsWith('Bearer guest:') ? headers.Authorization.slice(13) : OWNER;

function world(extra: Partial<Env> = {}): World {
  const d1 = sqliteD1();
  const env = {
    INDEX_ORIGIN: 'https://index.test',
    ...extra,
  } as unknown as Env;
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
  ) => {
    const documentId = path.split('/')[3] ?? (body as { id?: string } | undefined)?.id ?? '';
    return worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: {
          Authorization: 'Bearer guest-token',
          'X-Index-Grant': grantOf(
            documentId,
            personOf(headers),
            levelOf(documentId, personOf(headers)) ?? 'view',
          ),
          'Content-Type': 'application/json',
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      executionCtx,
    );
  };
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
  vi.unstubAllGlobals();
  setGrantVerifierForTests(null);
});

describe("a document's content lives in its own Durable Object", () => {
  it('keeps each document in its own SQLite', async () => {
    const w = world();
    await createDocument(w, 'A');
    await createDocument(w, 'B', [
      { id: 't1', name: 'Same id, other document', elements: [box('b')] },
    ]);
    expect(count(w.documents.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.documents.get('B')!.db, 'tabs')).toBe(1);
    // Each document knows itself (its own `document` row), and none of another's.
    expect(w.documents.get('A')!.db.prepare('SELECT owner_id FROM document').all()).toEqual([
      { owner_id: 'guest_owner' },
    ]);
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

  it('records nothing for a read: no edit key, no outbox row, no push scheduled', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const item = w.documents.get('A')!;
    await item.room.drain();
    expect(count(item.db, 'outbox')).toBe(0);
    indexCalls.length = 0;

    for (const path of ['/api/documents/A', '/api/documents/A/tabs', '/api/documents/A/tabs/t1']) {
      const res = await w.send('GET', path);
      expect(res.status, path).toBeLessThan(500);
      expect(
        item.db.prepare('SELECT kind, key FROM outbox').all(),
        `${path} queued an outbox row`,
      ).toEqual([]);
    }
    await item.room.drain();
    expect(indexCalls).toEqual([]);
  });

  it('pushes its summary and Inbox rows to the index from its outbox, never on the save itself', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
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
    indexCalls.length = 0;
    await w.send('PUT', '/api/documents/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [action],
    });
    const document = w.documents.get('A')!;
    expect(count(document.db, 'outbox')).toBeGreaterThan(0);
    expect(indexCalls).toEqual([]);
    // The save was the person's who asked: one edit key for them, at its time.
    const editors = document.db.prepare("SELECT key FROM outbox WHERE kind = 'edit'").all();
    expect(editors.map((r) => String(r.key))).toEqual([expect.stringMatching(/^guest_owner@\d+$/)]);

    await document.room.drain();

    expect(count(document.db, 'outbox')).toBe(0);
    expect(indexCalls.sort()).toEqual([
      'PUT /api/index/app/items/A/collab/t1',
      'PUT /api/index/app/items/A/events',
      'PUT /api/index/app/items/A/summary',
    ]);
  });

  it('records no editor for the create: the making is no edit, so markUsed: false counts no use day', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    const edits = () => document.db.prepare("SELECT key FROM outbox WHERE kind = 'edit'").all();
    expect(edits()).toEqual([]);
    // A re-commit of its own id is the making again, not an edit.
    await createDocument(w, 'A');
    expect(edits()).toEqual([]);
    indexCalls.length = 0;
    await document.room.drain();
    expect(indexCalls).toContain('PUT /api/index/app/items/A/summary');
    expect(indexCalls).not.toContain('PUT /api/index/app/items/A/events');
    // Its first edit afterwards is a use like any other.
    const saved = await w.send('PUT', '/api/documents/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a'), box('b')],
    });
    expect(saved.status).toBe(200);
    expect(edits()).toHaveLength(1);
  });

  it("records an API client's create as its use unless it says markUsed: false", async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    // The index makes an API client's item and answers its grant; the rest as the suite's stand-in answers.
    const indexFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      if (req.method === 'POST' && new URL(req.url).pathname === '/api/index/items') {
        indexCalls.push('POST /api/index/items');
        const { id } = (await req.json()) as { id: string };
        return Response.json(
          {
            item: { id, folderId: null, teamId: null },
            grant: { grant: grantOf(id), level: 'edit', tabId: null, expiresAt: 9e12 },
          },
          { status: 201 },
        );
      }
      return indexFetch(input, init);
    });
    const apiCreate = async (id: string, extra: Record<string, unknown> = {}) => {
      const res = await w.send(
        'POST',
        '/api/documents',
        { id, name: id, tabs: [{ id: `${id}-t1`, name: 'Board', elements: [box('a')] }], ...extra },
        { 'X-Index-Grant': '' },
      );
      expect(res.status).toBe(201);
      // Told beside the create, never waited on.
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    await apiCreate('used');
    await apiCreate('batch', { markUsed: false });
    expect(indexCalls).toContain('POST /api/index/items/used/open');
    expect(indexCalls).not.toContain('POST /api/index/items/batch/open');

    // An editor's create sends the index's grant and records its own open: nothing recorded here.
    indexCalls.length = 0;
    await createDocument(w, 'mine');
    expect(indexCalls.filter((call) => call.endsWith('/open'))).toEqual([]);
  });

  it('keeps the images its tabs place, answers the share check itself, and pushes the set to the media service', async () => {
    const w = world();
    const media = mediaServiceFor(w.env, { passOn: true });
    mediaImages(media, await mediaOwner('guest_owner'), ['img-1', 'img-2']);
    mediaImages(media, 'user_mallory', ['img-3']);
    const picture = (id: string, imageId: string) =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await createDocument(w, 'A', [
      { id: 't1', name: 'One', elements: [picture('p1', 'img-1'), picture('p3', 'img-3')] },
      { id: 't2', name: 'Two', elements: [picture('p2', 'img-2')] },
    ]);
    const document = w.documents.get('A')!;
    expect(
      document.db
        .prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id, image_id')
        .all(),
    ).toEqual([
      { tab_id: 't1', image_id: 'img-1' },
      { tab_id: 't1', image_id: 'img-3' },
      { tab_id: 't2', image_id: 'img-2' },
    ]);
    // Placed a moment ago, before any push: the document itself answers, for the whole document or one tab, and
    // serves only what it may (its owner's images; someone else's pasted id serves nothing).
    expect(await document.room.servesImage('A', 'img-2', null)).toBe(true);
    expect(await document.room.servesImage('A', 'img-2', 't1')).toBe(false);
    expect(await document.room.servesImage('A', 'img-3', null)).toBe(false);
    expect(await document.room.servesImage('A', 'img-4', null)).toBe(false);
    expect(media.sql.prepare('SELECT 1 FROM refs').all()).toEqual([]);

    await document.room.drain();
    expect(
      media.sql
        .prepare(`SELECT image_id FROM refs WHERE document = 'A' ORDER BY image_id`)
        .all()
        .map((r) => r.image_id),
    ).toEqual(['img-1', 'img-2', 'img-3']);
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

describe("the document's owner and team, from the index's grant", () => {
  const grantNaming = (owner: string | undefined, team: string | null) =>
    `G.${btoa(JSON.stringify({ item: 'A', sub: 'user_merged', level: 'edit', tab: null, team, owner, exp: 9e9 }))}`;
  const head = (doc: Document) => doc.db.prepare('SELECT owner_id, team_id FROM document').get();
  const editsQueued = (doc: Document) =>
    doc.db.prepare("SELECT 1 FROM outbox WHERE kind = 'edit'").all().length;

  it("takes a guest's merge and a team move from the next request's grant, as no edit", async () => {
    const w = world();
    await createDocument(w, 'A');
    const doc = w.documents.get('A')!;
    doc.db.exec('DELETE FROM outbox');

    const merged = await w.send('GET', '/api/documents/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', null),
    });
    expect(merged.status).toBe(200);
    expect(head(doc)).toEqual({ owner_id: 'user_merged', team_id: null });

    await w.send('GET', '/api/documents/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', 'team_1'),
    });
    expect(head(doc)).toEqual({ owner_id: 'user_merged', team_id: 'team_1' });
    expect(editsQueued(doc)).toBe(0);
  });

  it('leaves the copy alone for a grant that names no owner, or says the same', async () => {
    const w = world();
    await createDocument(w, 'A');
    const doc = w.documents.get('A')!;
    await w.send('GET', '/api/documents/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming(undefined, 'team_1'),
    });
    await w.send('GET', '/api/documents/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('guest_owner', null),
    });
    expect(head(doc)).toEqual({ owner_id: 'guest_owner', team_id: null });
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

  // liveworkspace/docs/specs/006-media/previews.md "The export door": the document draws itself for liveworkspace's previews, on the
  // index's key or the media service's, and stores nothing.
  it('draws the document for the previews, versioned by its save, on either key', async () => {
    const w = world({ INDEX_KEY: 'index-key', MEDIA_KEY: 'media-key' });
    await createDocument(w, 'A', [
      { id: 't1', name: 'One', elements: [box('a')] },
      { id: 't2', name: 'Empty', elements: [] },
    ]);
    const exported = (query: string, headers: Record<string, string> = auth) =>
      w.send('GET', `/api/internal/items/A/export?format=svg${query}`, undefined, headers);

    const first = await exported('');
    expect(first.status).toBe(200);
    expect(first.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(await first.text()).toContain('<svg');
    const etag = first.headers.get('ETag')!;
    expect(etag).toBeTruthy();

    const media = { Authorization: 'Bearer media-key' };
    expect((await exported('', media)).status).toBe(200);
    expect((await exported('', { ...media, 'If-None-Match': etag })).status).toBe(304);
    expect((await exported('&tab=t2')).status).toBe(204);
    expect((await exported('&tab=nope')).status).toBe(404);
    expect((await exported('', { Authorization: 'Bearer nope' })).status).toBe(401);
    const missing = await w.send('GET', '/api/internal/items/Z/export?format=svg', undefined, auth);
    expect(missing.status).toBe(404);
    // The media service's key opens only this door.
    expect((await w.send('DELETE', '/api/internal/items/A', undefined, media)).status).toBe(401);
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

  it('purges a document: every row of its store', async () => {
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

  it("takes a closed account's name off the documents that name them, and starts none", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    const data = JSON.stringify({
      elements: [
        {
          ...box('a'),
          comments: [
            { id: 'c1', authorId: 'user_ada', authorName: 'Ada', text: 'hi' },
            { id: 'c2', authorId: 'user_bea', authorName: 'Bea', text: 'yo' },
          ],
        },
      ],
    });
    document.db.prepare('UPDATE tabs SET data = ?, rev = rev + 1').run(data);
    document.db.prepare(`UPDATE document SET owner_id = 'user_ada'`).run();
    const res = await w.send(
      'POST',
      '/api/internal/people/user_ada/purge',
      { items: ['A', 'Z'] },
      auth,
    );
    expect(await res.json()).toEqual({ ok: true, anonymised: 2, unreached: [] });
    const stored = JSON.parse(String(document.db.prepare('SELECT data FROM tabs').get()!.data)) as {
      elements: { comments: { authorId: string; authorName: string }[] }[];
    };
    expect(stored.elements[0]!.comments.map((c) => [c.authorId, c.authorName])).toEqual([
      ['deleted', 'Deleted account'],
      ['user_bea', 'Bea'],
    ]);
    expect(document.db.prepare('SELECT owner_id FROM document').get()).toEqual({
      owner_id: 'deleted',
    });
    // Z was never started: its storage stays empty.
    const z = w.documents.get('Z');
    expect(
      z ? z.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n : 0,
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

  it('saves a tab placing 500 images and pushes the set within budget', async () => {
    const w = world();
    const media = mediaServiceFor(w.env, { passOn: true });
    mediaImages(
      media,
      await mediaOwner('guest_owner'),
      Array.from({ length: 500 }, (_, i) => `img-${i}`),
    );
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
    expect(count(media.sql, 'refs')).toBe(500);
    // A save that keeps the set writes no reference and owes the media service no push.
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
    // The drain writes 500 references to the media service: 57 to 72 ms on a laptop, so it gets the 200 ms the
    // other drains here have (100 missed CI under coverage at 332 ms).
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
    expect(resaveMs).toBeLessThan(cpuBudgetMs(100));
  });

  it('reads a 200-tab document in one call within budget', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
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
    // The push to the index goes DRAIN_TABS tabs a drain, so each drain's requests are bounded whatever the
    // document's size.
    const document = w.documents.get('A')!;
    const sizes: number[] = [];
    const drainMs = await cpuMsOfAsync(async () => {
      while (count(document.db, 'outbox') > 0) {
        indexCalls.length = 0;
        await document.room.drain();
        sizes.push(indexCalls.length);
      }
    });
    console.info('[perf] 200-tab document', { readMs, drainMs, requestsPerDrain: sizes });
    expect(sizes).toHaveLength(Math.ceil(200 / DRAIN_TABS));
    // DRAIN_TABS tabs, the summary and who edited.
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DRAIN_TABS + 2);
    expect(readMs).toBeLessThan(cpuBudgetMs(50));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });
});

// A tab shared between documents (docs/specs/006-document/tab-document-many-to-many.md): each holder keeps a copy under the same tab id,
// and a write in one reaches the others when its room drains (document-room/tab-shares.ts).
describe('a tab shared between documents', () => {
  const link = (w: World, target: string, tabId: string, from: unknown, person = OWNER) =>
    w.send('POST', `/api/documents/${target}/tabs/${tabId}/link`, { from }, as(person));
  const labels = (w: World, id: string, tabId = 't1') => {
    const row = w.documents.get(id)!.db.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId);
    if (!row) return null;
    return (JSON.parse(String(row.data)) as { elements: { label?: string }[] }).elements.map(
      (e) => e.label,
    );
  };
  const holders = (w: World, id: string, tabId = 't1') =>
    w.documents
      .get(id)!
      .db.prepare('SELECT item_id FROM tab_shares WHERE tab_id = ? ORDER BY item_id')
      .all(tabId)
      .map((r) => r.item_id);
  const save = async (w: World, id: string, label: string, tabId = 't1') => {
    await new Promise((r) => setTimeout(r, 2));
    const res = await w.send('PUT', `/api/documents/${id}/tabs/${tabId}`, {
      id: tabId,
      name: 'Board',
      elements: [box('a', label)],
    });
    expect(res.status).toBe(200);
  };
  const drain = async (w: World, ...ids: string[]) => {
    for (const id of ids) await w.documents.get(id)!.room.drain();
  };
  const sharedTabs = async (w: World, id: string) => {
    const res = await w.send('GET', `/api/documents/${id}/shared-tabs`);
    expect(res.status).toBe(200);
    return (await res.json<{ sharedTabs: unknown }>()).sharedTabs;
  };

  async function two() {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A', [{ id: 't1', name: 'Board', elements: [box('a', 'From A')] }]);
    await createDocument(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    return w;
  }

  it('adds the tab to the other document, the same tab in both', async () => {
    const w = await two();
    const res = await link(w, 'B', 't1', 'A');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tab: { id: 't1', name: 'Board' } });
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
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await drain(w, 'A', 'B');
    await save(w, 'A', 'Edited in A');
    expect(labels(w, 'B')).toEqual(['From A']);
    await drain(w, 'A');
    expect(labels(w, 'B')).toEqual(['Edited in A']);
    expect(count(w.documents.get('B')!.db, 'share_outbox')).toBe(0);
    await save(w, 'B', 'Edited in B');
    await drain(w, 'B');
    expect(labels(w, 'A')).toEqual(['Edited in B']);
    expect(count(w.documents.get('A')!.db, 'share_outbox')).toBe(0);
    // The Inbox and listing pushes still follow the copy taken in.
    expect(count(w.documents.get('A')!.db, 'outbox')).toBeGreaterThan(0);
  });

  it('keeps the later of two writes in every document', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await save(w, 'B', 'Earlier');
    await save(w, 'A', 'Later');
    await drain(w, 'B', 'A');
    expect(labels(w, 'A')).toEqual(['Later']);
    expect(labels(w, 'B')).toEqual(['Later']);
  });

  it('shares on through a third document, which every holder then hears of', async () => {
    const w = await two();
    await createDocument(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    expect((await link(w, 'C', 't1', 'B')).status).toBe(200);
    expect(holders(w, 'C')).toEqual(['A', 'B']);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['B', 'C']);
    await save(w, 'C', 'Edited in C');
    await drain(w, 'C');
    expect(labels(w, 'A')).toEqual(['Edited in C']);
    expect(labels(w, 'B')).toEqual(['Edited in C']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, documents: 2 });
  });

  it('leaves the others their copy when one document drops the tab, or goes for good', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = await two();
    await createDocument(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    await link(w, 'C', 't1', 'A');
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

  it('grants the holder taking it in the images its sender may serve, and no others', async () => {
    const w = world();
    const media = mediaServiceFor(w.env, { passOn: true });
    mediaImages(media, await mediaOwner(OWNER), ['img-1']);
    mediaImages(media, 'user_mallory', ['img-3']);
    const picture = (id: string, imageId: string) =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await createDocument(w, 'A', [
      { id: 't1', name: 'Board', elements: [picture('p1', 'img-1'), picture('p3', 'img-3')] },
    ]);
    await createDocument(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    const b = w.documents.get('B')!;
    expect(b.db.prepare('SELECT image_id FROM image_grants').all()).toEqual([
      { image_id: 'img-1' },
    ]);
    expect(await b.room.servesImage('B', 'img-1', 't1')).toBe(true);
    expect(await b.room.servesImage('B', 'img-3', 't1')).toBe(false);
  });

  it('drops a holder that no longer has the tab when it says so', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    w.documents.get('B')!.db.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    await save(w, 'A', 'Edited in A');
    await drain(w, 'A');
    expect(holders(w, 'A')).toEqual([]);
    expect(count(w.documents.get('A')!.db, 'share_outbox')).toBe(0);
  });

  it('refuses a tab the caller cannot edit, or into a document they cannot edit', async () => {
    const w = await two();
    // A stranger edits neither.
    expect((await link(w, 'B', 't1', 'A', 'stranger')).status).toBe(403);
    // A person per case: the index's grants are remembered per person and item.
    levelOf = (id, person) => {
      if (person === 'viewsSource') return id === 'B' ? 'edit' : 'view';
      if (person === 'viewsTarget') return id === 'A' ? 'edit' : 'view';
      if (person === 'teammate' || person === 'viaLink') return 'edit';
      return ownerOf(id) === person ? 'edit' : null;
    };
    // Edits the target but only views the source.
    expect((await link(w, 'B', 't1', 'A', 'viewsSource')).status).toBe(403);
    // Edits the source but only views the target.
    expect((await link(w, 'B', 't1', 'A', 'viewsTarget')).status).toBe(403);
    // Edits both through a share link (the request names a link's code): not as their own.
    const viaLink = await w.send(
      'POST',
      '/api/documents/B/tabs/t1/link',
      { from: 'A' },
      { ...as('viaLink'), 'X-Share-Code': 'code' },
    );
    expect(viaLink.status).toBe(403);
    expect(holders(w, 'A')).toEqual([]);
    // Edits both as their own: a teammate, say.
    expect((await link(w, 'B', 't1', 'A', 'teammate')).status).toBe(200);
    expect((await link(w, 'B', 'nope', 'A')).status).toBe(404);
    expect((await link(w, 'B', 't1', 'missing')).status).toBe(404);
    expect((await w.send('POST', '/api/documents/B/tabs/t1/link', {})).status).toBe(400);
    expect((await link(w, 'A', 't1', 'A')).status).toBe(400);
  });

  it('answers the shared-tabs count only to those who may delete the document', async () => {
    const w = await two();
    expect(
      (await w.send('GET', '/api/documents/A/shared-tabs', undefined, as('stranger'))).status,
    ).toBe(403);
  });
});

describe('shared tab speed', () => {
  it(`sends an edit of a 1 MB tab held by ${MAX_TAB_HOLDERS} documents within budget, and refuses one more`, async () => {
    const w = world();
    await createDocument(w, 'A');
    for (let i = 0; i < MAX_TAB_HOLDERS; i++) {
      await createDocument(w, `S${i}`, [{ id: `own${i}`, name: 'Own', elements: [] }]);
      const res = await w.send('POST', `/api/documents/S${i}/tabs/t1/link`, { from: 'A' });
      expect(res.status).toBe(i < MAX_TAB_HOLDERS - 1 ? 200 : 409);
    }
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
    const fanOutMs = await cpuMsOfAsync(() => a.room.drain());
    // Opening a document holding shared tabs reads its own copies: no call to any other holder.
    const holder = w.documents.get(`S${MAX_TAB_HOLDERS - 2}`)!;
    let openStatus = 0;
    const openMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', `/api/documents/S${MAX_TAB_HOLDERS - 2}/tabs/t1`);
      openStatus = res.status;
      await res.text();
    });
    expect(openStatus).toBe(200);
    console.info('[perf] 1 MB tab held by documents', {
      holders: MAX_TAB_HOLDERS - 1,
      saveMs,
      fanOutMs,
      openMs,
    });
    expect(
      holder.db.prepare("SELECT element_count FROM tabs WHERE id = 't1'").get()!.element_count,
    ).toBe(2_500);
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(fanOutMs).toBeLessThan(cpuBudgetMs(2_000));
    expect(openMs).toBeLessThan(cpuBudgetMs(100));
  });
});
