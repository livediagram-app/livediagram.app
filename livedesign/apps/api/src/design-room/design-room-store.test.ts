import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import { cpuBudgetMs, cpuMsOfAsync } from '@livedesign/vitest-config/cpu-time';
import type { Element } from '@livedesign/design';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor } from '../test-media-service';
import { mediaImages } from '../db/test-image-fixtures';
import { mediaOwner } from '../media';
import { MAX_TAB_HOLDERS } from '@liveworkspace/index-app';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { Env } from '../types';
import { DRAIN_TABS } from './design-outbox';
import { MAINTENANCE_EVERY_MS, DesignRoom } from './design-room';

// Each design's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the design's object, which answers from its own SQLite and
// pushes what the index needs through its outbox. Every design here gets its OWN in-memory database (the
// object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between designs, as in
// production.

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

// The index's grants, signed by a stand-in (`G.<claims>`): `person` holds `level` on the design it names.
const grantOf = (item: string, person = OWNER, level = 'edit') =>
  `G.${btoa(JSON.stringify({ item, sub: person, level, tab: null, team: null, exp: 9e9 }))}`;
beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});

// What reached the index: every push the designs made, answered as stored. A grant a design asks for (a tab
// linked in from another of the caller's designs) is given at `levelOf(design, person)`, as the index would:
// the owner edits their own, anyone else gets nothing unless a test says otherwise.
const indexCalls: string[] = [];
let ownerOf: (designId: string) => string | null = () => OWNER;
let levelOf: (designId: string, person: string) => string | null = (id, person) =>
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

type Design = { room: DesignRoom; db: DatabaseSync; transactions: number };

// The DESIGN_ROOM namespace: one DesignRoom per name, each on its own database, with the calls the worker made.
function designNamespace(envOf: () => Env) {
  const designs = new Map<string, Design>();
  const calls: string[] = [];
  const open = (name: string): Design => {
    const existing = designs.get(name);
    if (existing) return existing;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const store = new Map<string, unknown>();
    const transaction = nodeTransaction(db);
    const design = { db, transactions: 0 } as Design;
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
          design.transactions += 1;
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
    design.room = new DesignRoom(state as unknown as DurableObjectState, envOf());
    designs.set(name, design);
    return design;
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
  return { ns, designs, calls, open };
}

type World = {
  d1: SqliteD1;
  env: Env;
  designs: Map<string, Design>;
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
    WORKBENCH: d1.env.WORKBENCH,
    INDEX_ORIGIN: 'https://index.test',
    ...extra,
  } as unknown as Env;
  const { ns, designs, calls } = designNamespace(() => env);
  Reflect.set(env, 'DESIGN_ROOM', ns);
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
    const designId = path.split('/')[3] ?? (body as { id?: string } | undefined)?.id ?? '';
    return worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: {
          Authorization: 'Bearer guest-token',
          'X-Index-Grant': grantOf(
            designId,
            personOf(headers),
            levelOf(designId, personOf(headers)) ?? 'view',
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
  return { d1, env, designs, calls, send };
}

async function createDesign(
  w: World,
  id: string,
  tabs = [{ id: 't1', name: 'Board', elements: [box('a')] }],
) {
  const res = await w.send('POST', '/api/designs', { id, name: id, tabs });
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

describe("a design's content lives in its own Durable Object", () => {
  it('keeps each design in its own SQLite', async () => {
    const w = world();
    await createDesign(w, 'A');
    await createDesign(w, 'B', [{ id: 't1', name: 'Same id, other design', elements: [box('b')] }]);
    expect(count(w.designs.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.designs.get('B')!.db, 'tabs')).toBe(1);
    // Each design knows itself (its own `design` row).
    expect(w.designs.get('A')!.db.prepare('SELECT owner_id FROM design').all()).toEqual([
      { owner_id: 'guest_owner' },
    ]);
    expect(count(w.d1.sql, 'tabs')).toBe(0);
  });

  it('saves a tab in one call to the design and one transaction, and reads it back in one call', async () => {
    const w = world();
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    w.calls.length = 0;
    const before = design.transactions;
    const saved = await w.send('PUT', '/api/designs/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a', 'Edited'), box('c')],
    });
    expect(saved.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    expect(design.transactions - before).toBe(1);

    w.calls.length = 0;
    const read = await w.send('GET', '/api/designs/A/tabs/t1');
    expect(read.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    const tab = await read.json<{ tab: { elements: { label?: string }[] } }>();
    expect(tab.tab.elements.map((e) => e.label)).toEqual(['Edited', 'c']);
  });

  it('records nothing for a read: no edit key, no outbox row, no push scheduled', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A');
    const item = w.designs.get('A')!;
    await item.room.drain();
    expect(count(item.db, 'outbox')).toBe(0);
    indexCalls.length = 0;

    for (const path of [
      '/api/designs/A',
      '/api/designs/A/tabs',
      '/api/designs/A/tabs/t1',
      '/api/designs/A/thumbnail',
    ]) {
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
    await createDesign(w, 'A', [{ id: 't1', name: 'Board', elements: [] }]);
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
    await w.send('PUT', '/api/designs/A/tabs/t1', { id: 't1', name: 'Board', elements: [action] });
    const design = w.designs.get('A')!;
    expect(count(design.db, 'outbox')).toBeGreaterThan(0);
    expect(indexCalls).toEqual([]);
    // The save was the person's who asked: one edit key for them, at its time.
    const editors = design.db.prepare("SELECT key FROM outbox WHERE kind = 'edit'").all();
    expect(editors.map((r) => String(r.key))).toEqual([expect.stringMatching(/^guest_owner@\d+$/)]);

    await design.room.drain();

    expect(count(design.db, 'outbox')).toBe(0);
    expect(indexCalls.sort()).toEqual([
      'PUT /api/index/app/items/A/collab/t1',
      'PUT /api/index/app/items/A/events',
      'PUT /api/index/app/items/A/summary',
    ]);
  });

  it('runs its daily upkeep from its alarm: old changesets go', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    design.db
      .prepare(
        `INSERT INTO agent_changesets (id, design_id, tab_id, rev, base_rev, author_id, author_name, author_color,
           fingerprints, added, changed, removed, created_at)
         VALUES ('cs_old', 'A', 't1', 1, 0, 'u', 'U', '#000', '{}', 0, 0, 0, 1)`,
      )
      .run();
    vi.setSystemTime(Date.now() + MAINTENANCE_EVERY_MS + 1);
    await design.room.alarm();
    expect(count(design.db, 'agent_changesets')).toBe(0);
  });
});

describe('GET /api/designs/:id/tabs: the tabs alone, for the Share dialog', () => {
  const scopedGrant = (item: string, tab: string) =>
    `G.${btoa(JSON.stringify({ item, sub: 'guest_owner', level: 'view', tab, team: null, exp: 9e9 }))}`;

  it('answers every tab in order as { id, name, kind } from the rows, and a tab link its own tab', async () => {
    const w = world();
    await createDesign(w, 'A', [
      { id: 't1', name: 'Logo', elements: [box('a')] },
      { id: 't2', name: 'Wireframe', elements: [] },
    ]);
    const res = await w.send('GET', '/api/designs/A/tabs');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const { tabs } = await res.json<{
      tabs: { id: string; name: string; kind: string | null }[];
    }>();
    expect(tabs.map((t) => [t.id, t.name])).toEqual([
      ['t1', 'Logo'],
      ['t2', 'Wireframe'],
    ]);
    expect(tabs.every((t) => t.kind === null || t.kind === 'pages')).toBe(true);

    const scoped = await w.send('GET', '/api/designs/A/tabs', undefined, {
      'X-Index-Grant': scopedGrant('A', 't2'),
    });
    expect((await scoped.json<{ tabs: { id: string }[] }>()).tabs.map((t) => t.id)).toEqual(['t2']);
  });

  it('is a 404 with no grant, and for a design never started', async () => {
    const w = world();
    await createDesign(w, 'A');
    // The index gives this caller nothing when asked either.
    levelOf = () => null;
    expect(
      (await w.send('GET', '/api/designs/A/tabs', undefined, { 'X-Index-Grant': 'forged' })).status,
    ).toBe(404);
    expect((await w.send('GET', '/api/designs/B/tabs')).status).toBe(404);
  });

  it('reads 200 tabs within budget, from the rows alone', async () => {
    const w = world();
    const tabs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 20 }, (_, j) => box(`e${i}_${j}`)),
    }));
    await createDesign(w, 'A', tabs);
    const read = async () => {
      const res = await w.send('GET', '/api/designs/A/tabs');
      return (await res.json<{ tabs: unknown[] }>()).tabs.length;
    };
    expect(await read()).toBe(200);
    let count = 0;
    const cpu = await cpuMsOfAsync(async () => {
      count = await read();
    });
    console.info('[perf] 200-tab tabs read', { cpu });
    expect(count).toBe(200);
    expect(cpu).toBeLessThan(cpuBudgetMs(50));
  });
});

describe("an API client's create, made in the index by the worker", () => {
  // The index answers the create (filed by its default folder for the intent) and an `item_exists` re-commit.
  function indexMakes(answer: 'filed' | 'exists') {
    const creates: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      const path = new URL(req.url).pathname;
      if (req.method === 'POST' && path.endsWith('/items')) {
        const body = (await req.json()) as Record<string, unknown>;
        creates.push(body);
        if (answer === 'exists') return Response.json({ error: 'item_exists' }, { status: 409 });
        return Response.json({
          item: { id: body.id, folderId: 'folder_logos', teamId: null },
          grant: { grant: grantOf(String(body.id)), expiresAt: 9e9 },
        });
      }
      if (req.method === 'POST' && path.endsWith('/grant'))
        return Response.json({ grant: grantOf(path.split('/').at(-2)!), expiresAt: 9e9 });
      return Response.json({ ok: true });
    });
    return creates;
  }

  it('leaves the folder out so the index files it by its intent, and answers where it went', async () => {
    const creates = indexMakes('filed');
    const w = world();
    const res = await w.send(
      'POST',
      '/api/designs',
      {
        id: 'C',
        name: 'Logo',
        source: 'mcp',
        tabs: [{ id: 't1', name: 'Board', template: 'blank-logo' }],
      },
      { 'X-Index-Grant': '' },
    );
    expect(creates).toEqual([
      { id: 'C', app: 'livedesign', title: 'Logo', intent: 'pages:diagram', source: 'ai' },
    ]);
    expect(res.status).toBe(201);
    const { design } = await res.json<{ design: { folderId: string | null } }>();
    expect(design.folderId).toBe('folder_logos');
  });

  it('names the folder and team it is given, and a refused intent makes nothing', async () => {
    const creates = indexMakes('filed');
    const w = world();
    await w.send(
      'POST',
      '/api/designs',
      { id: 'D', name: 'D', folderId: null, teamId: 'team_1', intent: { mode: 'pages' } },
      { 'X-Index-Grant': '' },
    );
    expect(creates[0]).toMatchObject({ folderId: null, teamId: 'team_1', intent: 'pages:diagram' });
    const refused = await w.send(
      'POST',
      '/api/designs',
      { id: 'E', name: 'E', intent: { mode: 'nope' } },
      { 'X-Index-Grant': '' },
    );
    expect(refused.status).toBe(400);
    expect(creates).toHaveLength(1);
  });

  it("re-commits the client's own design by the grant it holds", async () => {
    indexMakes('exists');
    const w = world();
    await createDesign(w, 'A');
    const res = await w.send(
      'POST',
      '/api/designs',
      { id: 'A', name: 'A again' },
      { 'X-Index-Grant': '' },
    );
    expect(res.status).toBe(201);
  });
});

describe("the design's owner and team, from the index's grant", () => {
  const grantNaming = (owner: string | undefined, team: string | null) =>
    `G.${btoa(JSON.stringify({ item: 'A', sub: 'user_merged', level: 'edit', tab: null, team, owner, exp: 9e9 }))}`;
  const head = (design: Design) => design.db.prepare('SELECT owner_id, team_id FROM design').get();
  const editsQueued = (design: Design) =>
    design.db.prepare("SELECT 1 FROM outbox WHERE kind = 'edit'").all().length;

  it("takes a guest's merge and a team move from the next request's grant, as no edit", async () => {
    const w = world();
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    design.db.exec('DELETE FROM outbox');

    const merged = await w.send('GET', '/api/designs/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', null),
    });
    expect(merged.status).toBe(200);
    expect(head(design)).toEqual({ owner_id: 'user_merged', team_id: null });

    await w.send('GET', '/api/designs/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', 'team_1'),
    });
    expect(head(design)).toEqual({ owner_id: 'user_merged', team_id: 'team_1' });
    expect(editsQueued(design)).toBe(0);
  });

  it("takes them from a session's renewed grant too", async () => {
    const w = world();
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    let attachment: unknown = null;
    const ws = {
      send: () => {},
      close: () => {},
      serializeAttachment: (value: unknown) => void (attachment = value),
      deserializeAttachment: () => attachment,
    } as unknown as WebSocket;
    design.room.acceptSession(ws, 'edit', null, null, null, null, null, 'A', Date.now() + 60_000);
    await design.room.renewGrant(ws, grantNaming('user_merged', 'team_1'));
    expect(head(design)).toEqual({ owner_id: 'user_merged', team_id: 'team_1' });
    expect((attachment as { grantExp: number }).grantExp).toBe(9e9 * 1000);
  });

  it('leaves the copy alone for a grant that names no owner, or says the same', async () => {
    const w = world();
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    await w.send('GET', '/api/designs/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming(undefined, 'team_1'),
    });
    await w.send('GET', '/api/designs/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('guest_owner', null),
    });
    expect(head(design)).toEqual({ owner_id: 'guest_owner', team_id: null });
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

  it('copies a design, or one tab of it, into a new design', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A', [
      { id: 't1', name: 'One', elements: [box('a')] },
      { id: 't2', name: 'Two', elements: [box('b')] },
    ]);
    const all = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(all.status).toBe(201);
    expect(count(w.designs.get('C')!.db, 'tabs')).toBe(2);

    const one = await w.send('POST', '/api/internal/items/A/copy-to/D', { tabId: 't2' }, auth);
    expect(one.status).toBe(201);
    expect(w.designs.get('D')!.db.prepare('SELECT name FROM tabs').all()).toEqual([
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

  it("keeps other people's comment authors off a copy made by anyone but the owner", async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A');
    const source = w.designs.get('A')!.db;
    const { owner_id: owner } = source.prepare('SELECT owner_id FROM design').get() as {
      owner_id: string;
    };
    const comment = (id: string, authorId: string) => ({
      id,
      text: 'hi',
      createdAt: 0,
      authorName: id,
      authorColor: '#000',
      authorId,
    });
    const thread = { comments: [comment('c1', owner), comment('c2', 'user_visitor')] };
    source
      .prepare('UPDATE tabs SET data = ?, rev = rev + 1')
      .run(JSON.stringify({ elements: [{ ...box('a'), commentThread: thread }] }));
    const authorsIn = (id: string) =>
      (
        JSON.parse(
          (w.designs.get(id)!.db.prepare('SELECT data FROM tabs').get() as { data: string }).data,
        ) as { elements: { commentThread: { comments: { authorId?: string }[] } }[] }
      ).elements[0]!.commentThread.comments.map((c) => c.authorId ?? null);

    const visitor = await w.send(
      'POST',
      '/api/internal/items/A/copy-to/V',
      { by: 'user_visitor' },
      auth,
    );
    expect(visitor.status).toBe(201);
    expect(authorsIn('V')).toEqual([null, 'user_visitor']);

    const own = await w.send('POST', '/api/internal/items/A/copy-to/O', { by: owner }, auth);
    expect(own.status).toBe(201);
    expect(authorsIn('O')).toEqual([owner, 'user_visitor']);
  });

  // A workbench ticket or session on the design stays in its person's workbench store (src/workbench-store.ts)
  // until it expires or is swept, reaching nothing: the index grants nothing on a design that is gone.
  it('purges a design: every row and every session', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
    const res = await w.send('DELETE', '/api/internal/items/A', undefined, auth);
    expect(res.status).toBe(200);
    expect(
      design.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n,
    ).toBe(0);
  });

  it("takes a closed account's name off the designs that name them, and starts none", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A');
    const design = w.designs.get('A')!;
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
    design.db.prepare('UPDATE tabs SET data = ?, rev = rev + 1').run(data);
    design.db.prepare(`UPDATE design SET owner_id = 'user_ada'`).run();
    const res = await w.send(
      'POST',
      '/api/internal/people/user_ada/purge',
      { items: ['A', 'Z'] },
      auth,
    );
    expect(await res.json()).toEqual({ ok: true, anonymised: 2, unreached: [] });
    const stored = JSON.parse(String(design.db.prepare('SELECT data FROM tabs').get()!.data)) as {
      elements: { comments: { authorId: string; authorName: string }[] }[];
    };
    expect(stored.elements[0]!.comments.map((c) => [c.authorId, c.authorName])).toEqual([
      ['deleted', 'Deleted account'],
      ['user_bea', 'Bea'],
    ]);
    expect(design.db.prepare('SELECT owner_id FROM design').get()).toEqual({ owner_id: 'deleted' });
    // Z was never started: its storage stays empty.
    const z = w.designs.get('Z');
    expect(
      z ? z.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n : 0,
    ).toBe(0);
  });

  it('ends the sessions of revoked codes, refusing a body that is not codes', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A');
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
    await createDesign(w, 'A');
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    const body = { id: 't1', name: 'Board', elements };
    expect(JSON.stringify(body).length).toBeGreaterThan(1_000_000);
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/designs/A/tabs/t1', body)).status;
    });
    expect(status).toBe(200);
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/designs/A/tabs/t1');
      status = res.status;
      await res.text();
    });
    expect(status).toBe(200);
    const drainMs = await cpuMsOfAsync(() => w.designs.get('A')!.room.drain());
    console.info('[perf] 1 MB tab', { saveMs, readMs, drainMs });
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(readMs).toBeLessThan(cpuBudgetMs(100));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });

  it('reads a 200-tab design in one call within budget', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    const tabs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 20 }, (_, j) => box(`e${i}-${j}`)),
    }));
    await createDesign(w, 'A', tabs);
    w.calls.length = 0;
    let status = 0;
    let listed = 0;
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/designs/A');
      status = res.status;
      listed = (await res.json<{ design: { tabs: unknown[] } }>()).design.tabs.length;
    });
    expect(status).toBe(200);
    expect(listed).toBe(200);
    expect(w.calls).toEqual(['route']);
    // The push to the index goes DRAIN_TABS tabs a drain, so each drain's requests are bounded whatever the
    // design's size.
    const design = w.designs.get('A')!;
    const sizes: number[] = [];
    const drainMs = await cpuMsOfAsync(async () => {
      while (count(design.db, 'outbox') > 0) {
        indexCalls.length = 0;
        await design.room.drain();
        sizes.push(indexCalls.length);
      }
    });
    console.info('[perf] 200-tab design', { readMs, drainMs, requestsPerDrain: sizes });
    expect(sizes).toHaveLength(Math.ceil(200 / DRAIN_TABS));
    // DRAIN_TABS tabs, the summary and who edited.
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DRAIN_TABS + 2);
    expect(readMs).toBeLessThan(cpuBudgetMs(50));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });
});

// A tab shared between designs (docs/specs/006-design/tab-design-many-to-many.md): each holder keeps a copy under the same tab id,
// and a write in one reaches the others when its room drains (design-room/tab-shares.ts).
describe('a tab shared between designs', () => {
  const link = (w: World, target: string, tabId: string, from: unknown, person = OWNER) =>
    w.send('POST', `/api/designs/${target}/tabs/${tabId}/link`, { from }, as(person));
  const labels = (w: World, id: string, tabId = 't1') => {
    const row = w.designs.get(id)!.db.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId);
    if (!row) return null;
    return (JSON.parse(String(row.data)) as { elements: { label?: string }[] }).elements.map(
      (e) => e.label,
    );
  };
  const holders = (w: World, id: string, tabId = 't1') =>
    w.designs
      .get(id)!
      .db.prepare('SELECT item_id FROM tab_shares WHERE tab_id = ? ORDER BY item_id')
      .all(tabId)
      .map((r) => r.item_id);
  const save = async (w: World, id: string, label: string, tabId = 't1') => {
    await new Promise((r) => setTimeout(r, 2));
    const res = await w.send('PUT', `/api/designs/${id}/tabs/${tabId}`, {
      id: tabId,
      name: 'Board',
      elements: [box('a', label)],
    });
    expect(res.status).toBe(200);
  };
  const drain = async (w: World, ...ids: string[]) => {
    for (const id of ids) await w.designs.get(id)!.room.drain();
  };
  const sharedTabs = async (w: World, id: string) => {
    const res = await w.send('GET', `/api/designs/${id}/shared-tabs`);
    expect(res.status).toBe(200);
    return (await res.json<{ sharedTabs: unknown }>()).sharedTabs;
  };

  async function two() {
    const w = world({ INDEX_KEY: 'index-key' });
    await createDesign(w, 'A', [{ id: 't1', name: 'Board', elements: [box('a', 'From A')] }]);
    await createDesign(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    return w;
  }

  it('adds the tab to the other design, the same tab in both', async () => {
    const w = await two();
    const res = await link(w, 'B', 't1', 'A');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tab: { id: 't1', name: 'Board' } });
    expect(labels(w, 'B')).toEqual(['From A']);
    expect(holders(w, 'A')).toEqual(['B']);
    expect(holders(w, 'B')).toEqual(['A']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, designs: 1 });
    expect(await sharedTabs(w, 'B')).toEqual({ tabs: 1, designs: 1 });
    // A repeat is answered as it is.
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    expect(count(w.designs.get('B')!.db, 'tabs')).toBe(2);
  });

  it('carries an edit in either design to the other, without sending it back', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await drain(w, 'A', 'B');
    await save(w, 'A', 'Edited in A');
    expect(labels(w, 'B')).toEqual(['From A']);
    await drain(w, 'A');
    expect(labels(w, 'B')).toEqual(['Edited in A']);
    expect(count(w.designs.get('B')!.db, 'share_outbox')).toBe(0);
    await save(w, 'B', 'Edited in B');
    await drain(w, 'B');
    expect(labels(w, 'A')).toEqual(['Edited in B']);
    expect(count(w.designs.get('A')!.db, 'share_outbox')).toBe(0);
    // The Inbox and listing pushes still follow the copy taken in.
    expect(count(w.designs.get('A')!.db, 'outbox')).toBeGreaterThan(0);
  });

  it('keeps the later of two writes in every design', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await save(w, 'B', 'Earlier');
    await save(w, 'A', 'Later');
    await drain(w, 'B', 'A');
    expect(labels(w, 'A')).toEqual(['Later']);
    expect(labels(w, 'B')).toEqual(['Later']);
  });

  it('shares on through a third design, which every holder then hears of', async () => {
    const w = await two();
    await createDesign(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    expect((await link(w, 'C', 't1', 'B')).status).toBe(200);
    expect(holders(w, 'C')).toEqual(['A', 'B']);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['B', 'C']);
    await save(w, 'C', 'Edited in C');
    await drain(w, 'C');
    expect(labels(w, 'A')).toEqual(['Edited in C']);
    expect(labels(w, 'B')).toEqual(['Edited in C']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, designs: 2 });
  });

  it('leaves the others their copy when one design drops the tab, or goes for good', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = await two();
    await createDesign(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    await link(w, 'C', 't1', 'A');
    await drain(w, 'A');
    expect((await w.send('DELETE', '/api/designs/B/tabs/t1')).status).toBe(204);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['C']);
    expect(holders(w, 'C')).toEqual(['A']);
    expect(labels(w, 'A')).toEqual(['From A']);

    const purged = await w.send('DELETE', '/api/internal/items/C', undefined, {
      Authorization: 'Bearer index-key',
    });
    expect(purged.status).toBe(200);
    expect(holders(w, 'A')).toEqual([]);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 0, designs: 0 });
    expect(labels(w, 'A')).toEqual(['From A']);
  });

  it('grants the holder taking it in the images its sender may serve, and no others', async () => {
    const w = world();
    const media = mediaServiceFor(w.env);
    mediaImages(media, await mediaOwner(OWNER), ['img-1']);
    mediaImages(media, 'user_mallory', ['img-3']);
    const picture = (id: string, imageId: string) =>
      ({ id, type: 'image', x: 0, y: 0, width: 10, height: 10, imageId }) as unknown as Element;
    await createDesign(w, 'A', [
      { id: 't1', name: 'Board', elements: [picture('p1', 'img-1'), picture('p3', 'img-3')] },
    ]);
    await createDesign(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    const b = w.designs.get('B')!;
    expect(b.db.prepare('SELECT image_id FROM image_grants').all()).toEqual([
      { image_id: 'img-1' },
    ]);
    expect(await b.room.servesImage('B', 'img-1', 't1')).toBe(true);
    expect(await b.room.servesImage('B', 'img-3', 't1')).toBe(false);
  });

  it('carries the photo blobs the tab names and its sender holds, and those an edit adds', async () => {
    const w = await two();
    const held = 'h'.repeat(22);
    const later = 'l'.repeat(22);
    const strange = 's'.repeat(22);
    const a = w.designs.get('A')!;
    const ref = (blob: string) =>
      a.db
        .prepare(
          "INSERT INTO photo_blob_refs (tab_id, blob_id, created_at, content_type, byte_size) VALUES ('t1', ?, 1, 'image/webp', 10)",
        )
        .run(blob);
    const withPhoto = (preview: string) => ({
      id: 't1',
      name: 'Board',
      elements: [box('a', 'From A')],
      photos: { pg1: { width: 10, height: 10, layers: [], preview } },
    });
    // A's tab names a blob it holds; it also holds one the tab no longer names.
    ref(held);
    ref(strange);
    expect((await w.send('PUT', '/api/designs/A/tabs/t1', withPhoto(held))).status).toBe(200);
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    const blobsOfB = () =>
      w.designs
        .get('B')!
        .db.prepare("SELECT blob_id FROM photo_blob_refs WHERE tab_id = 't1' ORDER BY blob_id")
        .all()
        .map((r) => r.blob_id);
    expect(blobsOfB()).toEqual([held]);
    // An edit in A naming a blob A was just sent reaches B with its ref.
    ref(later);
    await drain(w, 'A', 'B');
    await new Promise((r) => setTimeout(r, 2));
    expect((await w.send('PUT', '/api/designs/A/tabs/t1', withPhoto(later))).status).toBe(200);
    await drain(w, 'A');
    expect(blobsOfB()).toEqual([held, later]);
  });

  it('drops a holder that no longer has the tab when it says so', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    w.designs.get('B')!.db.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    await save(w, 'A', 'Edited in A');
    await drain(w, 'A');
    expect(holders(w, 'A')).toEqual([]);
    expect(count(w.designs.get('A')!.db, 'share_outbox')).toBe(0);
  });

  it('refuses a tab the caller cannot edit, or into a design they cannot edit', async () => {
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
      '/api/designs/B/tabs/t1/link',
      { from: 'A' },
      { ...as('viaLink'), 'X-Share-Code': 'code' },
    );
    expect(viaLink.status).toBe(403);
    expect(holders(w, 'A')).toEqual([]);
    // Edits both as their own: a teammate, say.
    expect((await link(w, 'B', 't1', 'A', 'teammate')).status).toBe(200);
    expect((await link(w, 'B', 'nope', 'A')).status).toBe(404);
    expect((await link(w, 'B', 't1', 'missing')).status).toBe(404);
    expect((await w.send('POST', '/api/designs/B/tabs/t1/link', {})).status).toBe(400);
    expect((await link(w, 'A', 't1', 'A')).status).toBe(400);
  });

  it('answers the shared-tabs count only to those who may delete the design', async () => {
    const w = await two();
    expect(
      (await w.send('GET', '/api/designs/A/shared-tabs', undefined, as('stranger'))).status,
    ).toBe(403);
  });
});

describe('shared tab speed', () => {
  it(`sends an edit of a 1 MB tab held by ${MAX_TAB_HOLDERS} designs within budget, and refuses one more`, async () => {
    const w = world();
    await createDesign(w, 'A');
    for (let i = 0; i < MAX_TAB_HOLDERS; i++) {
      await createDesign(w, `S${i}`, [{ id: `own${i}`, name: 'Own', elements: [] }]);
      const res = await w.send('POST', `/api/designs/S${i}/tabs/t1/link`, { from: 'A' });
      expect(res.status).toBe(i < MAX_TAB_HOLDERS - 1 ? 200 : 409);
    }
    const a = w.designs.get('A')!;
    while (count(a.db, 'share_outbox') > 0) await a.room.drain();
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    await new Promise((r) => setTimeout(r, 2));
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (
        await w.send('PUT', '/api/designs/A/tabs/t1', { id: 't1', name: 'Board', elements })
      ).status;
    });
    expect(status).toBe(200);
    const fanOutMs = await cpuMsOfAsync(() => a.room.drain());
    // Opening a design holding shared tabs reads its own copies: no call to any other holder.
    const holder = w.designs.get(`S${MAX_TAB_HOLDERS - 2}`)!;
    let openStatus = 0;
    const openMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', `/api/designs/S${MAX_TAB_HOLDERS - 2}/tabs/t1`);
      openStatus = res.status;
      await res.text();
    });
    expect(openStatus).toBe(200);
    console.info('[perf] 1 MB tab held by designs', {
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
