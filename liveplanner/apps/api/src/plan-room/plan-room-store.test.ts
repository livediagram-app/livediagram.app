import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveplanner/vitest-config/cpu-time';
import type { Element } from '@liveplanner/project';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { nodePlanSql, nodeTransaction } from '../test-plan-sql';
import type { Env } from '../types';
import { DRAIN_TABS } from './plan-outbox';
import { MAINTENANCE_EVERY_MS, PlanRoom } from './plan-room';

// Each plan's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the plan's object, which answers from its own SQLite and
// pushes what D1's cross-plan reads need through its outbox. Every plan here gets its OWN in-memory database (the
// object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between plans but
// D1, as in production.

vi.mock('../auth/accounts', () => ({
  getPersonIdentity: async () => ({ kind: 'guest', guestId: 'guest_owner' }),
  accountCredentials: () => null,
}));

// The index's grants, signed by a stand-in (`G.<claims>`): the owner edits every plan it names.
const grantOf = (item: string) =>
  `G.${btoa(JSON.stringify({ item, sub: 'guest_owner', level: 'edit', tab: null, team: null, exp: 9e9 }))}`;
beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});

// What reached the index: every push the plans made, answered as stored.
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
        sql: nodePlanSql(db),
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
          'X-Index-Grant': grantOf(planId),
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
