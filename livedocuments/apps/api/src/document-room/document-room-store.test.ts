import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import { cpuBudgetMs, cpuMsOfAsync } from '@livedocuments/vitest-config/cpu-time';
import type { Element } from '@livedocuments/document';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor } from '../test-media-service';
import { mediaImages } from '../db/test-image-fixtures';
import { mediaOwner } from '../media';
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
  getPersonIdentity: async () => ({ kind: 'guest', guestId: 'guest_owner' }),
  accountCredentials: () => null,
}));

// The index's grants, signed by a stand-in (`G.<claims>`): the owner edits every document it names.
const grantOf = (item: string) =>
  `G.${btoa(JSON.stringify({ item, sub: 'guest_owner', level: 'edit', tab: null, team: null, exp: 9e9 }))}`;
beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});

// What reached the index: every push the documents made, answered as stored.
const indexCalls: string[] = [];
beforeEach(() => {
  indexCalls.length = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    indexCalls.push(`${req.method} ${new URL(req.url).pathname}`);
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
  const env = { DB: d1.env.DB, INDEX_ORIGIN: 'https://index.test', ...extra } as unknown as Env;
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
          'X-Index-Grant': grantOf(documentId),
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
  it('keeps each document in its own SQLite, D1 holding none of it', async () => {
    const w = world();
    await createDocument(w, 'A');
    await createDocument(w, 'B', [
      { id: 't1', name: 'Same id, other document', elements: [box('b')] },
    ]);
    expect(count(w.documents.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.documents.get('B')!.db, 'tabs')).toBe(1);
    // Each document knows itself (its own `document` row); D1 has none of the content.
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
    await w.send('PUT', '/api/documents/A/tabs/t1', { id: 't1', name: 'Board', elements: [action] });
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
      document.db.prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id, image_id').all(),
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

  it('purges a document: every row, every session, and what D1 keeps about it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDocument(w, 'A');
    const document = w.documents.get('A')!;
    w.d1.sql.exec(`PRAGMA foreign_keys = OFF;
      INSERT INTO workbench_session_rooms (session_id, document_id) VALUES ('s1', 'A'), ('s1', 'B');`);
    const res = await w.send('DELETE', '/api/internal/items/A', undefined, auth);
    expect(res.status).toBe(200);
    expect(
      document.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n,
    ).toBe(0);
    expect(w.d1.sql.prepare('SELECT document_id FROM workbench_session_rooms').all()).toEqual([
      { document_id: 'B' },
    ]);
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
    expect(document.db.prepare('SELECT owner_id FROM document').get()).toEqual({ owner_id: 'deleted' });
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
    expect(drainMs).toBeLessThan(cpuBudgetMs(100));
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
