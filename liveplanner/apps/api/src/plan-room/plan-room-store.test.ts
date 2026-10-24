import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveplanner/vitest-config/cpu-time';
import type { Element } from '@liveplanner/project';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { MAX_TAB_HOLDERS } from '@liveworkspace/index-app';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { Env } from '../types';
import { DRAIN_TABS } from './plan-outbox';
import { MAINTENANCE_EVERY_MS, PlanRoom } from './plan-room';

// Each plan's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the plan's object, which answers from its own SQLite and
// pushes what D1's cross-plan reads need through its outbox. Every plan here gets its OWN in-memory database (the
// object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between plans but
// D1, as in production.

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

// The index's grants, signed by a stand-in (`G.<claims>`): `person` holds `level` on the plan it names.
const grantOf = (item: string, person = OWNER, level = 'edit') =>
  `G.${btoa(JSON.stringify({ item, sub: person, level, tab: null, team: null, exp: 9e9 }))}`;
beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});

// What reached the index: every push the plans made, answered as stored. A grant a plan asks for (a tab
// linked in from another of the caller's plans) is given at `levelOf(plan, person)`, as the index would:
// the owner edits their own, anyone else gets nothing unless a test says otherwise.
const indexCalls: string[] = [];
let ownerOf: (planId: string) => string | null = () => OWNER;
let levelOf: (planId: string, person: string) => string | null = (id, person) =>
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

type Plan = { room: PlanRoom; db: DatabaseSync; transactions: number };

// The PLAN_ROOM namespace: one PlanRoom per name, each on its own database, with the calls the worker made.
function planNamespace(envOf: () => Env) {
  const plans = new Map<string, Plan>();
  const calls: string[] = [];
  const open = (name: string): Plan => {
    const existing = plans.get(name);
    if (existing) return existing;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const store = new Map<string, unknown>();
    const transaction = nodeTransaction(db);
    const plan = { db, transactions: 0 } as Plan;
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
          plan.transactions += 1;
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
    plan.room = new PlanRoom(state as unknown as DurableObjectState, envOf());
    plans.set(name, plan);
    return plan;
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
  return { ns, plans, calls, open };
}

type World = {
  d1: SqliteD1;
  env: Env;
  plans: Map<string, Plan>;
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
  const { ns, plans, calls } = planNamespace(() => env);
  Reflect.set(env, 'PLAN_ROOM', ns);
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
    const planId = path.split('/')[3] ?? (body as { id?: string } | undefined)?.id ?? '';
    return worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: {
          Authorization: 'Bearer guest-token',
          'X-Index-Grant': grantOf(
            planId,
            personOf(headers),
            levelOf(planId, personOf(headers)) ?? 'view',
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
  return { d1, env, plans, calls, send };
}

async function createPlan(
  w: World,
  id: string,
  tabs = [{ id: 't1', name: 'Board', elements: [box('a')] }],
) {
  const res = await w.send('POST', '/api/projects', { id, name: id, tabs });
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

describe("a plan's content lives in its own Durable Object", () => {
  it('keeps each plan in its own SQLite, D1 holding none of it', async () => {
    const w = world();
    await createPlan(w, 'A');
    await createPlan(w, 'B', [{ id: 't1', name: 'Same id, other plan', elements: [box('b')] }]);
    expect(count(w.plans.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.plans.get('B')!.db, 'tabs')).toBe(1);
    // Each plan knows itself (its own `plan` row); D1 has none of the content.
    expect(w.plans.get('A')!.db.prepare('SELECT owner_id FROM plan').all()).toEqual([
      { owner_id: 'guest_owner' },
    ]);
    expect(count(w.d1.sql, 'tabs')).toBe(0);
  });

  it('saves a tab in one call to the plan and one transaction, and reads it back in one call', async () => {
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    w.calls.length = 0;
    const before = plan.transactions;
    const saved = await w.send('PUT', '/api/projects/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a', 'Edited'), box('c')],
    });
    expect(saved.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    expect(plan.transactions - before).toBe(1);

    w.calls.length = 0;
    const read = await w.send('GET', '/api/projects/A/tabs/t1');
    expect(read.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    const tab = await read.json<{ tab: { elements: { label?: string }[] } }>();
    expect(tab.tab.elements.map((e) => e.label)).toEqual(['Edited', 'c']);
  });

  it('pushes its summary and Inbox rows to the index from its outbox, never on the save itself', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A', [{ id: 't1', name: 'Board', elements: [] }]);
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
    await w.send('PUT', '/api/projects/A/tabs/t1', { id: 't1', name: 'Board', elements: [action] });
    const plan = w.plans.get('A')!;
    expect(count(plan.db, 'outbox')).toBeGreaterThan(0);
    expect(indexCalls).toEqual([]);
    // The save was the person's who asked: one edit key for them, at its time.
    const editors = plan.db.prepare("SELECT key FROM outbox WHERE kind = 'edit'").all();
    expect(editors.map((r) => String(r.key))).toEqual([expect.stringMatching(/^guest_owner@\d+$/)]);

    await plan.room.drain();

    expect(count(plan.db, 'outbox')).toBe(0);
    // The tab holds a board, so the plan's cards (none yet) are pushed too.
    expect(indexCalls.sort()).toEqual([
      'PUT /api/index/app/items/A/collab/t1',
      'PUT /api/index/app/items/A/collab/~cards',
      'PUT /api/index/app/items/A/events',
      'PUT /api/index/app/items/A/summary',
    ]);
  });

  it('records nothing for a read: no edit key, no outbox row, no push scheduled', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    await plan.room.drain();
    expect(count(plan.db, 'outbox')).toBe(0);
    indexCalls.length = 0;

    for (const path of [
      '/api/projects/A',
      '/api/projects/A/tabs',
      '/api/projects/A/tabs/t1',
      '/api/projects/A/thumbnail',
    ]) {
      const res = await w.send('GET', path);
      expect(res.status, path).toBeLessThan(500);
      expect(
        plan.db.prepare('SELECT kind, key FROM outbox').all(),
        `${path} queued an outbox row`,
      ).toEqual([]);
    }
    await plan.room.drain();
    expect(indexCalls).toEqual([]);
  });

  it('runs its daily upkeep from its alarm: old changesets go', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    plan.db
      .prepare(
        `INSERT INTO agent_changesets (id, plan_id, tab_id, rev, base_rev, author_id, author_name, author_color,
           fingerprints, added, changed, removed, created_at)
         VALUES ('cs_old', 'A', 't1', 1, 0, 'u', 'U', '#000', '{}', 0, 0, 0, 1)`,
      )
      .run();
    vi.setSystemTime(Date.now() + MAINTENANCE_EVERY_MS + 1);
    await plan.room.alarm();
    expect(count(plan.db, 'agent_changesets')).toBe(0);
  });
});

describe("the plan's owner and team, from the index's grant", () => {
  const grantNaming = (owner: string | undefined, team: string | null) =>
    `G.${btoa(JSON.stringify({ item: 'A', sub: 'user_merged', level: 'edit', tab: null, team, owner, exp: 9e9 }))}`;
  const head = (plan: Plan) => plan.db.prepare('SELECT owner_id, team_id FROM plan').get();
  const cardsQueued = (plan: Plan) =>
    plan.db.prepare("SELECT 1 FROM outbox WHERE kind = 'tab' AND key = '~cards'").all().length;

  it("takes a guest's merge and a team move from the next request's grant, and re-pushes the cards", async () => {
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    plan.db.exec('DELETE FROM outbox');

    const merged = await w.send('GET', '/api/projects/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', null),
    });
    expect(merged.status).toBe(200);
    expect(head(plan)).toEqual({ owner_id: 'user_merged', team_id: null });
    expect(cardsQueued(plan)).toBe(1);

    await w.send('GET', '/api/projects/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('user_merged', 'team_1'),
    });
    expect(head(plan)).toEqual({ owner_id: 'user_merged', team_id: 'team_1' });
  });

  it('leaves the copy alone for a grant that names no owner, or says the same', async () => {
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    plan.db.exec('DELETE FROM outbox');
    await w.send('GET', '/api/projects/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming(undefined, 'team_1'),
    });
    await w.send('GET', '/api/projects/A/tabs/t1', undefined, {
      'X-Index-Grant': grantNaming('guest_owner', null),
    });
    expect(head(plan)).toEqual({ owner_id: 'guest_owner', team_id: null });
    expect(cardsQueued(plan)).toBe(0);
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

  it('copies a plan, or one tab of it, into a new plan', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A', [
      { id: 't1', name: 'One', elements: [box('a')] },
      { id: 't2', name: 'Two', elements: [box('b')] },
    ]);
    const all = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(all.status).toBe(201);
    expect(count(w.plans.get('C')!.db, 'tabs')).toBe(2);

    const one = await w.send('POST', '/api/internal/items/A/copy-to/D', { tabId: 't2' }, auth);
    expect(one.status).toBe(201);
    expect(w.plans.get('D')!.db.prepare('SELECT name FROM tabs').all()).toEqual([{ name: 'Two' }]);

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

  it('purges a plan: every row, its form links with it, and every session', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    plan.db.exec(
      `INSERT INTO form_links (code, project_id, tab_id, created_at) VALUES ('f1', 'A', 't1', 1)`,
    );
    const res = await w.send('DELETE', '/api/internal/items/A', undefined, auth);
    expect(res.status).toBe(200);
    expect(
      plan.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n,
    ).toBe(0);
  });

  it("takes a closed account's name off the plans that name them, and starts none", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
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
    plan.db.prepare('UPDATE tabs SET data = ?, rev = rev + 1').run(data);
    plan.db.prepare(`UPDATE plan SET owner_id = 'user_ada'`).run();
    const res = await w.send(
      'POST',
      '/api/internal/people/user_ada/purge',
      { items: ['A', 'Z'] },
      auth,
    );
    expect(await res.json()).toEqual({ ok: true, anonymised: 2, unreached: [] });
    const stored = JSON.parse(String(plan.db.prepare('SELECT data FROM tabs').get()!.data)) as {
      elements: { comments: { authorId: string; authorName: string }[] }[];
    };
    expect(stored.elements[0]!.comments.map((c) => [c.authorId, c.authorName])).toEqual([
      ['deleted', 'Deleted account'],
      ['user_bea', 'Bea'],
    ]);
    expect(plan.db.prepare('SELECT owner_id FROM plan').get()).toEqual({ owner_id: 'deleted' });
    // Z was never started: its storage stays empty.
    const z = w.plans.get('Z');
    expect(
      z ? z.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n : 0,
    ).toBe(0);
  });

  it('ends the sessions of revoked codes, refusing a body that is not codes', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
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
    await createPlan(w, 'A');
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    const body = { id: 't1', name: 'Board', elements };
    expect(JSON.stringify(body).length).toBeGreaterThan(1_000_000);
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/projects/A/tabs/t1', body)).status;
    });
    expect(status).toBe(200);
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/projects/A/tabs/t1');
      status = res.status;
      await res.text();
    });
    expect(status).toBe(200);
    const drainMs = await cpuMsOfAsync(() => w.plans.get('A')!.room.drain());
    console.info('[perf] 1 MB tab', { saveMs, readMs, drainMs });
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(readMs).toBeLessThan(cpuBudgetMs(100));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });

  it('reads a 200-tab plan in one call within budget', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    const tabs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 20 }, (_, j) => box(`e${i}-${j}`)),
    }));
    await createPlan(w, 'A', tabs);
    w.calls.length = 0;
    let status = 0;
    let listed = 0;
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/projects/A');
      status = res.status;
      listed = (await res.json<{ project: { tabs: unknown[] } }>()).project.tabs.length;
    });
    expect(status).toBe(200);
    expect(listed).toBe(200);
    expect(w.calls).toEqual(['route']);
    // The push to the index goes DRAIN_TABS tabs a drain, so each drain's requests are bounded whatever the
    // plan's size.
    const plan = w.plans.get('A')!;
    const sizes: number[] = [];
    const drainMs = await cpuMsOfAsync(async () => {
      while (count(plan.db, 'outbox') > 0) {
        indexCalls.length = 0;
        await plan.room.drain();
        sizes.push(indexCalls.length);
      }
    });
    console.info('[perf] 200-tab plan', { readMs, drainMs, requestsPerDrain: sizes });
    // 200 tabs and the plan's cards (its tabs hold boards).
    expect(sizes).toHaveLength(Math.ceil(201 / DRAIN_TABS));
    // DRAIN_TABS tabs, the summary and who edited.
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DRAIN_TABS + 2);
    expect(readMs).toBeLessThan(cpuBudgetMs(50));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });
});

// A tab shared between plans (docs/specs/006-project/tab-project-many-to-many.md): each holder keeps a copy under the same tab id,
// and a write in one reaches the others when its room drains (plan-room/tab-shares.ts).
describe('a tab shared between plans', () => {
  const link = (w: World, target: string, tabId: string, from: unknown, person = OWNER) =>
    w.send('POST', `/api/projects/${target}/tabs/${tabId}/link`, { from }, as(person));
  const labels = (w: World, id: string, tabId = 't1') => {
    const row = w.plans.get(id)!.db.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId);
    if (!row) return null;
    return (JSON.parse(String(row.data)) as { elements: { label?: string }[] }).elements.map(
      (e) => e.label,
    );
  };
  const holders = (w: World, id: string, tabId = 't1') =>
    w.plans
      .get(id)!
      .db.prepare('SELECT item_id FROM tab_shares WHERE tab_id = ? ORDER BY item_id')
      .all(tabId)
      .map((r) => r.item_id);
  const save = async (w: World, id: string, label: string, tabId = 't1') => {
    await new Promise((r) => setTimeout(r, 2));
    const res = await w.send('PUT', `/api/projects/${id}/tabs/${tabId}`, {
      id: tabId,
      name: 'Board',
      elements: [box('a', label)],
    });
    expect(res.status).toBe(200);
  };
  const drain = async (w: World, ...ids: string[]) => {
    for (const id of ids) await w.plans.get(id)!.room.drain();
  };
  const sharedTabs = async (w: World, id: string) => {
    const res = await w.send('GET', `/api/projects/${id}/shared-tabs`);
    expect(res.status).toBe(200);
    return ((await res.json()) as { sharedTabs: unknown }).sharedTabs;
  };

  async function two() {
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A', [{ id: 't1', name: 'Board', elements: [box('a', 'From A')] }]);
    await createPlan(w, 'B', [{ id: 'tb', name: 'Own', elements: [] }]);
    return w;
  }

  it('adds the tab to the other plan, the same tab in both', async () => {
    const w = await two();
    const res = await link(w, 'B', 't1', 'A');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tab: { id: 't1', name: 'Board' } });
    expect(labels(w, 'B')).toEqual(['From A']);
    expect(holders(w, 'A')).toEqual(['B']);
    expect(holders(w, 'B')).toEqual(['A']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, projects: 1 });
    expect(await sharedTabs(w, 'B')).toEqual({ tabs: 1, projects: 1 });
    // A repeat is answered as it is.
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    expect(count(w.plans.get('B')!.db, 'tabs')).toBe(2);
  });

  it('carries an edit in either plan to the other, without sending it back', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await drain(w, 'A', 'B');
    await save(w, 'A', 'Edited in A');
    expect(labels(w, 'B')).toEqual(['From A']);
    await drain(w, 'A');
    expect(labels(w, 'B')).toEqual(['Edited in A']);
    expect(count(w.plans.get('B')!.db, 'share_outbox')).toBe(0);
    await save(w, 'B', 'Edited in B');
    await drain(w, 'B');
    expect(labels(w, 'A')).toEqual(['Edited in B']);
    expect(count(w.plans.get('A')!.db, 'share_outbox')).toBe(0);
    // The Inbox and listing pushes still follow the copy taken in.
    expect(count(w.plans.get('A')!.db, 'outbox')).toBeGreaterThan(0);
  });

  it('keeps the later of two writes in every plan', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    await save(w, 'B', 'Earlier');
    await save(w, 'A', 'Later');
    await drain(w, 'B', 'A');
    expect(labels(w, 'A')).toEqual(['Later']);
    expect(labels(w, 'B')).toEqual(['Later']);
  });

  it('shares on through a third plan, which every holder then hears of', async () => {
    const w = await two();
    await createPlan(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    expect((await link(w, 'C', 't1', 'B')).status).toBe(200);
    expect(holders(w, 'C')).toEqual(['A', 'B']);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['B', 'C']);
    await save(w, 'C', 'Edited in C');
    await drain(w, 'C');
    expect(labels(w, 'A')).toEqual(['Edited in C']);
    expect(labels(w, 'B')).toEqual(['Edited in C']);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 1, projects: 2 });
  });

  it('leaves the others their copy when one plan drops the tab, or goes for good', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = await two();
    await createPlan(w, 'C', [{ id: 'tc', name: 'Own', elements: [] }]);
    await link(w, 'B', 't1', 'A');
    await link(w, 'C', 't1', 'A');
    await drain(w, 'A');
    expect((await w.send('DELETE', '/api/projects/B/tabs/t1')).status).toBe(204);
    await drain(w, 'B');
    expect(holders(w, 'A')).toEqual(['C']);
    expect(holders(w, 'C')).toEqual(['A']);
    expect(labels(w, 'A')).toEqual(['From A']);

    const purged = await w.send('DELETE', '/api/internal/items/C', undefined, {
      Authorization: 'Bearer index-key',
    });
    expect(purged.status).toBe(200);
    expect(holders(w, 'A')).toEqual([]);
    expect(await sharedTabs(w, 'A')).toEqual({ tabs: 0, projects: 0 });
    expect(labels(w, 'A')).toEqual(['From A']);
  });

  it('records the sheet references a body makes in each plan holding it', async () => {
    const w = await two();
    const sheet = (id: string, sheetId: string) =>
      ({ ...box(id), shape: 'plan-sheet', planSheet: { sheetId } }) as unknown as Element;
    await new Promise((r) => setTimeout(r, 2));
    const put = (elements: Element[]) =>
      w.send('PUT', '/api/projects/A/tabs/t1', { id: 't1', name: 'Board', elements });
    expect((await put([sheet('s', 'sheet-1')])).status).toBe(200);
    expect((await link(w, 'B', 't1', 'A')).status).toBe(200);
    const refsOfB = () =>
      w.plans
        .get('B')!
        .db.prepare("SELECT sheet_id FROM sheet_refs WHERE tab_id = 't1' ORDER BY sheet_id")
        .all()
        .map((r) => r.sheet_id);
    expect(refsOfB()).toEqual(['sheet-1']);
    await drain(w, 'A', 'B');
    await new Promise((r) => setTimeout(r, 2));
    expect((await put([sheet('s', 'sheet-2')])).status).toBe(200);
    await drain(w, 'A');
    expect(refsOfB()).toEqual(['sheet-2']);
  });

  it('drops a holder that no longer has the tab when it says so', async () => {
    const w = await two();
    await link(w, 'B', 't1', 'A');
    w.plans.get('B')!.db.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    await save(w, 'A', 'Edited in A');
    await drain(w, 'A');
    expect(holders(w, 'A')).toEqual([]);
    expect(count(w.plans.get('A')!.db, 'share_outbox')).toBe(0);
  });

  it('refuses a tab the caller cannot edit, or into a plan they cannot edit', async () => {
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
      '/api/projects/B/tabs/t1/link',
      { from: 'A' },
      { ...as('viaLink'), 'X-Share-Code': 'code' },
    );
    expect(viaLink.status).toBe(403);
    expect(holders(w, 'A')).toEqual([]);
    // Edits both as their own: a teammate, say.
    expect((await link(w, 'B', 't1', 'A', 'teammate')).status).toBe(200);
    expect((await link(w, 'B', 'nope', 'A')).status).toBe(404);
    expect((await link(w, 'B', 't1', 'missing')).status).toBe(404);
    expect((await w.send('POST', '/api/projects/B/tabs/t1/link', {})).status).toBe(400);
    expect((await link(w, 'A', 't1', 'A')).status).toBe(400);
  });

  it('answers the shared-tabs count only to those who may delete the plan', async () => {
    const w = await two();
    expect(
      (await w.send('GET', '/api/projects/A/shared-tabs', undefined, as('stranger'))).status,
    ).toBe(403);
  });
});

describe('shared tab speed', () => {
  it(`sends an edit of a 1 MB tab held by ${MAX_TAB_HOLDERS} plans within budget, and refuses one more`, async () => {
    const w = world();
    await createPlan(w, 'A');
    for (let i = 0; i < MAX_TAB_HOLDERS; i++) {
      await createPlan(w, `S${i}`, [{ id: `own${i}`, name: 'Own', elements: [] }]);
      const res = await w.send('POST', `/api/projects/S${i}/tabs/t1/link`, { from: 'A' });
      expect(res.status).toBe(i < MAX_TAB_HOLDERS - 1 ? 200 : 409);
    }
    const a = w.plans.get('A')!;
    while (count(a.db, 'share_outbox') > 0) await a.room.drain();
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    await new Promise((r) => setTimeout(r, 2));
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (
        await w.send('PUT', '/api/projects/A/tabs/t1', { id: 't1', name: 'Board', elements })
      ).status;
    });
    expect(status).toBe(200);
    const fanOutMs = await cpuMsOfAsync(() => a.room.drain());
    // Opening a plan holding shared tabs reads its own copies: no call to any other holder.
    const holder = w.plans.get(`S${MAX_TAB_HOLDERS - 2}`)!;
    let openStatus = 0;
    const openMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', `/api/projects/S${MAX_TAB_HOLDERS - 2}/tabs/t1`);
      openStatus = res.status;
      await res.text();
    });
    expect(openStatus).toBe(200);
    console.info('[perf] 1 MB tab held by plans', {
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
