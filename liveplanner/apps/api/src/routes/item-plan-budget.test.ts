import { getHeapStatistics, setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemsResponse } from '@liveplanner/api-schema';
import { ITEMS_MAX, PLAN_FIELDS_BYTES, newItemId, presetSetup } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/items.md "Limits": a plan's cards together hold up to PLAN_FIELDS_BYTES of fields. Every door
// that grows a plan refuses past it (`413 plan_full`), a plan already past it still loads and can be trimmed, and a
// plan filled to it still answers GET /items well inside a Worker's 128 MB (Work Tracker 944).

let sql: SqliteD1;

// The answer's text alone, as the Worker sends it (no parse, so a read's heap is the server's).
async function raw(opts: { path: string; body?: unknown; method?: string }) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'POST', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: 'owner',
    ...(opts.body === undefined ? {} : { body: opts.body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  return { status: res.status, text: await res.text() };
}

async function call<T = unknown>(opts: { path: string; body?: unknown; method?: string }) {
  const { status, text } = await raw(opts);
  return { status, body: (text ? JSON.parse(text) : null) as T };
}

type Answer = { error?: string; item?: { id: string }; items?: { id: string }[] };
const PLAN_FULL = { status: 413, body: { error: 'plan_full' } };

const kept = () =>
  (sql.sql.prepare(`SELECT items_bytes AS b FROM plan WHERE id = 'd1'`).get() as { b: number }).b;

let nextKey = 1;
// `count` cards straight into the store, their fields `each` bytes apiece (as a plan from before, or one filled to the
// budget): a title and a description of plain letters.
function fill(count: number, each: number) {
  const pad = each - JSON.stringify({ title: 'Card', description: '' }).length;
  const fields = JSON.stringify({ title: 'Card', description: 'd'.repeat(pad) });
  const insert = sql.sql.prepare(
    `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
     VALUES ('d1', ?, 'task', ?, ?, ?, 1, 1, 1, ?, ?)`,
  );
  const person = JSON.stringify({ id: 'p-owner', name: 'Webber', color: '#3b82f6' });
  // After any card the doors made.
  nextKey = (
    sql.sql.prepare(`SELECT COALESCE(MAX(item_key), 0) + 1 AS k FROM items`).get() as { k: number }
  ).k;
  sql.sql.exec('BEGIN');
  for (let i = 0; i < count; i += 1) {
    const key = nextKey++;
    insert.run(newItemId(), key, `a${key.toString(36).padStart(6, '0')}x`, fields, person, person);
  }
  sql.sql.exec(`UPDATE plan SET items_next_key = ${nextKey} WHERE id = 'd1'`);
  sql.sql.exec('COMMIT');
}

const make = (description: string) =>
  call<Answer>({
    path: '/items',
    body: { type: 'task', fields: { title: 'New', description }, place: { status: 'todo' } },
  });

beforeEach(() => {
  nextKey = 1;
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('kanban'),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(
    `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);`,
  );
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
});

describe('the plan fields budget', () => {
  it('refuses a create, many creates and an import past it, and takes one that fits', async () => {
    // 256 cards of 64 KB: the budget exactly.
    fill(256, PLAN_FIELDS_BYTES / 256);
    expect(kept()).toBe(PLAN_FIELDS_BYTES);
    expect(await make('one more')).toMatchObject(PLAN_FULL);
    expect(
      await call({
        path: '/items/bulk',
        body: { items: [{ type: 'task', fields: { title: 'A' } }] },
      }),
    ).toMatchObject(PLAN_FULL);
    expect(
      await call({
        path: '/items/import',
        body: {
          importId: 'import-0001',
          part: 0,
          parts: 1,
          items: [{ type: 'task', fields: { title: 'Imported' } }],
        },
      }),
    ).toMatchObject(PLAN_FULL);
    // Trimmed by one card, the plan takes a card that fits again.
    const id = (sql.sql.prepare(`SELECT id FROM items LIMIT 1`).get() as { id: string }).id;
    expect((await call({ path: `/items/${id}`, method: 'DELETE' })).status).toBe(204);
    expect((await make('fits now')).status).toBe(201);
    expect(kept()).toBeLessThanOrEqual(PLAN_FIELDS_BYTES);
  });

  it('refuses an edit that grows a full plan, one card or many, and lands one that shrinks it', async () => {
    fill(255, PLAN_FIELDS_BYTES / 256);
    const made = await make('');
    expect(made.status).toBe(201);
    const id = made.body.item!.id;
    fill(1, PLAN_FIELDS_BYTES / 256 - 2048);
    const room = PLAN_FIELDS_BYTES - kept();
    expect(room).toBeGreaterThan(0);
    const longer = 'x'.repeat(room + 1);
    expect(
      await call({ path: `/items/${id}`, body: { set: { description: longer } } }),
    ).toMatchObject(PLAN_FULL);
    expect(
      await call({
        path: '/items/patches',
        body: { items: [{ id, set: { description: longer } }] },
      }),
    ).toMatchObject(PLAN_FULL);
    expect(
      await call({
        path: `/items/${id}/move`,
        body: { status: 'doing', set: { 'f-notes': longer } },
      }),
    ).toMatchObject(PLAN_FULL);
    // Up to the budget exactly lands; nothing was half written.
    const fits = await call({
      path: `/items/${id}`,
      body: { set: { description: 'x'.repeat(room) } },
    });
    expect(fits.status).toBe(200);
    expect(kept()).toBe(PLAN_FIELDS_BYTES);
  });

  it('still loads a plan already past it, moves its cards, and lets it shrink', async () => {
    const made = await make('a long description');
    const id = made.body.item!.id;
    // Past the budget, as a plan could have been before it.
    fill(300, PLAN_FIELDS_BYTES / 256);
    expect(kept()).toBeGreaterThan(PLAN_FIELDS_BYTES);
    const read = await call<ItemsResponse>({ path: '/items', method: 'GET' });
    expect(read.status).toBe(200);
    expect(read.body.items).toHaveLength(301);
    // A move between columns, a shrinking edit and a delete all land; a growing one does not.
    expect(
      (await call({ path: '/items/moves', body: { items: [{ id, status: 'doing' }] } })).status,
    ).toBe(200);
    expect((await call({ path: `/items/${id}/move`, body: { status: 'done' } })).status).toBe(200);
    expect(
      (await call({ path: `/items/${id}`, body: { set: { description: 'short' } } })).status,
    ).toBe(200);
    expect(
      await call({ path: `/items/${id}`, body: { set: { description: 'longer than short' } } }),
    ).toMatchObject(PLAN_FULL);
    const before = kept();
    const other = read.body.items.find((i) => i.id !== id)!.id;
    expect(
      (
        await call({
          path: '/items/patches',
          body: { items: [{ id: other, set: { description: '' } }] },
        })
      ).status,
    ).toBe(200);
    expect(kept()).toBeLessThan(before);
  });

  // The proof a plan can't reach a GET it cannot answer: filled to the budget in the shape that answers most for its
  // bytes (ITEMS_MAX cards sharing it, so every card's id, key, rank, people and dates ride along), the doors refuse one
  // more byte, and the read answers inside its budget. A Worker or Durable Object has 128 MB, and the live heap a read
  // raises is 3.3 to 5 times its answer (blueprint item-store.md "Performance and limits"): 24 MB of answer is the
  // most that stays safely inside it.
  it(
    'answers GET /items well inside a Worker’s memory for a plan filled to it',
    { timeout: 30_000 },
    async () => {
      const each = Math.floor((PLAN_FIELDS_BYTES - 4096) / (ITEMS_MAX - 1));
      fill(ITEMS_MAX - 1, each);
      expect(await make('x'.repeat(PLAN_FIELDS_BYTES - kept()))).toMatchObject(PLAN_FULL);
      expect((await make('fits')).status).toBe(201);
      expect(kept()).toBeLessThanOrEqual(PLAN_FIELDS_BYTES);
      // The live heap the read raises: a forced collection first, then the heap once it has answered (a collection
      // during the read can only lower it, so the budget below is never met by luck the other way).
      setFlagsFromString('--expose-gc');
      const gc = runInNewContext('gc') as () => void;
      gc();
      const heap0 = getHeapStatistics().used_heap_size;
      let got = { status: 0, text: '' };
      const cpu = await cpuMsOfAsync(async () => {
        got = await raw({ path: '/items', method: 'GET' });
      });
      const heap = getHeapStatistics().used_heap_size - heap0;
      const answer = new TextEncoder().encode(got.text).length;
      const read = { status: got.status, body: JSON.parse(got.text) as ItemsResponse };
      console.info('[items-bytes] full plan read', {
        cards: read.body.items.length,
        answerMb: +(answer / 1024 / 1024).toFixed(1),
        heapMb: +(heap / 1024 / 1024).toFixed(1),
        cpuMs: Math.round(cpu),
      });
      expect(read.status).toBe(200);
      expect(read.body.items).toHaveLength(ITEMS_MAX);
      expect(answer).toBeLessThan(24 * 1024 * 1024);
      // Measured 72 MB (17.1 MB answered); a Worker or Durable Object has 128 MB.
      expect(heap).toBeLessThan(100 * 1024 * 1024);
      expect(cpu).toBeLessThan(cpuBudgetMs(1500));
    },
  );
});
