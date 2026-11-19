import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse } from '@liveplanner/api-schema';
import {
  ITEM_WRITE_RETRIES,
  REVOKED_PERSON,
  itemAssistantFor,
  itemPersonId,
  presetSetup,
  type Item,
  type ItemPerson,
} from '@liveplanner/items';
import { readItemHistory } from '../db/item-history';
import { listItems } from '../db/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleProjects } from '../routes/projects';
import { handleInternalItems } from '../routes/internal-items';
import type { PlanEnv } from '../types';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { handBackRevoked, REVOKE_WRITE_BATCH } from './assistant-revoked';
import { knownAssistants } from './known-assistants';

// docs/specs/026-plan/items.md "When its token is revoked" (Work Tracker 1294): the plan forgets the tool and hands each
// card it holds back to the person it worked for, noted in the card's history by Access Revoked; a card a person
// already re-assigned, another person's tool and the same person's other tools are left alone; a tool that never
// reached the plan changes nothing; running it twice changes nothing.

let sql: SqliteD1;
const env = () => sql.env;

type As = { owner?: string; code?: string };

async function call<T = unknown>(opts: {
  method?: string;
  path: string;
  body?: unknown;
  token?: { id: string; name: string };
  as?: As;
}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'GET', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: opts.as?.owner ?? 'owner',
    ...(opts.as?.code ? { headers: { 'X-Share-Code': opts.as.code } } : {}),
    ...(opts.body === undefined ? {} : { body: opts.body }),
    ...(opts.token ? { token: opts.token } : {}),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const EDIT: As = { owner: 'e', code: 'EDIT' };
const PART: As = { owner: 'p', code: 'PART' };

let erin: ItemPerson;
let pat: ItemPerson;
let erinsClaude: ReturnType<typeof itemAssistantFor> & object;
let erinsCursor: ReturnType<typeof itemAssistantFor> & object;
let patsClaude: ReturnType<typeof itemAssistantFor> & object;

const make = (title: string, assignee: unknown, as: As = EDIT) =>
  call<ItemResponse>({
    method: 'POST',
    path: '/items',
    as,
    body: { type: 'task', fields: { title, assignee }, place: { status: 'todo' } },
  });
const cardsById = async () => new Map((await listItems(env(), 'd1')).map((i: Item) => [i.id, i]));

beforeEach(async () => {
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
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
  `);
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('e', 'Erin Moss', '#16a34a');
  setTestProfile('p', 'Pat Lee', '#d97706');
  erin = { id: await itemPersonId('e'), name: 'Erin Moss', color: '#16a34a' };
  pat = { id: await itemPersonId('p'), name: 'Pat Lee', color: '#d97706' };
  erinsClaude = itemAssistantFor(erin, 'Claude')!;
  erinsCursor = itemAssistantFor(erin, 'Cursor')!;
  patsClaude = itemAssistantFor(pat, 'Claude')!;
  // Each tool reaches the plan's cards once, so the plan remembers it.
  await call({ path: '/items', as: EDIT, token: { id: 'tok_e1', name: 'Claude' } });
  await call({ path: '/items', as: EDIT, token: { id: 'tok_e2', name: 'Cursor' } });
  await call({ path: '/items', as: PART, token: { id: 'tok_p1', name: 'Claude' } });
});

const relayed: { ids: string[]; rev: number }[] = [];
const relay = (items: Item[], rev: number) =>
  void relayed.push({ ids: items.map((i) => i.id), rev });

describe('a revoked assistant', () => {
  it('is forgotten, and each card it holds goes back to the person it worked for, noted in its history', async () => {
    relayed.length = 0;
    const a = (await make('Fix login', erinsClaude)).body.item;
    const b = (await make('Write docs', erinsClaude, PART)).body.item;
    const cursor = (await make('Tidy', erinsCursor)).body.item;
    const pats = (await make('Pat’s', patsClaude, PART)).body.item;
    const person = (await make('Mine', erin)).body.item;

    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const now = Date.now();
    const out = await handBackRevoked(env(), 'd1', 'e', ' Claude ', relay, now);
    expect(out).toEqual({ forgotten: true, cards: 2 });
    expect(info).toHaveBeenCalledWith('[items] assistant.revoked', {
      cards: 2,
      retries: 0,
      left: 0,
    });
    info.mockRestore();

    const cards = await cardsById();
    // Back to Erin, as the cards held her (her id, name and colour), never anyone else.
    for (const id of [a.id, b.id]) {
      expect(cards.get(id)!.fields['assignee']).toEqual(erin);
      expect(cards.get(id)!.updatedBy).toEqual(REVOKED_PERSON);
      expect(cards.get(id)!.updatedAt).toBe(now);
    }
    // Her other tool, Pat's tool and a card already hers are left as they were.
    expect(cards.get(cursor.id)!.fields['assignee']).toEqual(erinsCursor);
    expect(cards.get(pats.id)!.fields['assignee']).toEqual(patsClaude);
    expect(cards.get(person.id)!.rev).toBe(person.rev);
    // The picker's list: Erin's Claude gone, the others kept.
    expect((await knownAssistants(env())).map((x) => x.id).sort()).toEqual(
      [erinsCursor.id, patsClaude.id].sort(),
    );
    // One relay for the batch, so everyone in the plan sees it at once.
    expect(relayed).toEqual([
      { ids: expect.arrayContaining([a.id, b.id]), rev: expect.any(Number) },
    ]);
    // The card's history: Access Revoked set the Assignee to Erin.
    const [latest] = await readItemHistory(env(), 'd1', a.id, Date.now());
    expect(latest!.by).toEqual(REVOKED_PERSON);
    expect(latest!.changes).toEqual([
      { kind: 'set', field: 'assignee', value: expect.stringContaining('Erin') },
    ]);

    // Told again (the index's retry): nothing more changes.
    relayed.length = 0;
    expect(await handBackRevoked(env(), 'd1', 'e', 'Claude', relay)).toEqual({
      forgotten: false,
      cards: 0,
    });
    expect(relayed).toEqual([]);
  });

  it('leaves a card a person already took back or gave to someone else', async () => {
    const a = (await make('Fix login', erinsClaude)).body.item;
    const moved = await call({
      method: 'POST',
      path: `/items/${a.id}`,
      as: EDIT,
      body: { set: { assignee: pat } },
    });
    expect(moved.status).toBe(200);
    const before = (await cardsById()).get(a.id)!;
    expect(await handBackRevoked(env(), 'd1', 'e', 'Claude', relay)).toEqual({
      forgotten: true,
      cards: 0,
    });
    const after = (await cardsById()).get(a.id)!;
    expect(after.fields['assignee']).toEqual(pat);
    expect(after.rev).toBe(before.rev);
  });

  it('changes nothing for a tool that never reached the plan, or a name no tool can have', async () => {
    const a = (await make('Fix login', erinsClaude)).body.item;
    expect(await handBackRevoked(env(), 'd1', 'user_stranger', 'Claude', relay)).toEqual({
      forgotten: false,
      cards: 0,
    });
    expect(await handBackRevoked(env(), 'd1', 'e', 'Gemini', relay)).toEqual({
      forgotten: false,
      cards: 0,
    });
    expect(await handBackRevoked(env(), 'd1', 'e', 'C'.repeat(41), relay)).toEqual({
      forgotten: false,
      cards: 0,
    });
    expect((await cardsById()).get(a.id)!.fields['assignee']).toEqual(erinsClaude);
    expect(await knownAssistants(env())).toHaveLength(3);
  });

  it('leaves a hand-edited Assignee that only borrows the id, since it does not read as the assistant', async () => {
    const fields = JSON.stringify({ title: 'Odd', assignee: { id: erinsClaude.id, name: 'Odd' } });
    sql.sql
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES ('d1', 'odd', 'task', 99, 'z', ?, 1, 0, 0, '{}', '{}')`,
      )
      .run(fields);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(await handBackRevoked(env(), 'd1', 'e', 'Claude', relay)).toEqual({
      forgotten: true,
      cards: 0,
    });
    expect((await cardsById()).get('odd')!.rev).toBe(1);
  });

  it('hands back a card that moved under it once, and asks to be told again when it never settles', async () => {
    const a = (await make('Fix login', erinsClaude)).body.item;
    const b = (await make('Write docs', erinsClaude)).body.item;
    // Someone else's write lands between the read and the hand-back: the first try of `a` misses, the next lands.
    const racing = (times: number, id: string): PlanEnv => {
      const db = env().PLAN_DB;
      let left = times;
      return {
        ...env(),
        PLAN_DB: new Proxy(db, {
          get(target, key) {
            if (key === 'batch')
              return async (statements: D1PreparedStatement[]) => {
                if (left-- > 0)
                  sql.sql.prepare('UPDATE items SET rev = rev + 1 WHERE id = ?').run(id);
                return target.batch(statements);
              };
            const value = Reflect.get(target, key) as unknown;
            return typeof value === 'function' ? (value.bind(target) as unknown) : value;
          },
        }),
      };
    };
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(await handBackRevoked(racing(1, a.id), 'd1', 'e', 'Claude', relay)).toEqual({
      forgotten: true,
      cards: 2,
    });
    expect(info).toHaveBeenCalledWith('[items] assistant.revoked', {
      cards: 2,
      retries: 1,
      left: 0,
    });

    const c = (await make('Again', erinsClaude)).body.item;
    await expect(
      handBackRevoked(racing(ITEM_WRITE_RETRIES, c.id), 'd1', 'e', 'Claude', relay),
    ).rejects.toThrow('assistant hand-back: 1 cards kept moving');
    expect((await cardsById()).get(c.id)!.fields['assignee']).toEqual(erinsClaude);
    expect((await cardsById()).get(b.id)!.fields['assignee']).toEqual(erin);
    info.mockRestore();
  });

  it('hands back a plan full of its cards in batches, within a CPU budget', async () => {
    const count = REVOKE_WRITE_BATCH * 3 + 7;
    const rows = Array.from({ length: count }, (_, n) => {
      const id = `card-${String(n).padStart(5, '0')}`;
      return [id, JSON.stringify({ title: `Card ${n}`, assignee: erinsClaude, status: 'todo' })];
    });
    const insert = sql.sql.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('d1', ?, 'task', ?, ?, ?, 1, 0, 0, '{}', '{}')`,
    );
    rows.forEach(([id, fields], n) => insert.run(id!, n + 1, `r${n}`, fields!));
    relayed.length = 0;
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const ms = await cpuMsOfAsync(async () => {
      expect((await handBackRevoked(env(), 'd1', 'e', 'Claude', relay)).cards).toBe(count);
    });
    expect(relayed).toHaveLength(Math.ceil(count / REVOKE_WRITE_BATCH));
    expect(ms).toBeLessThan(cpuBudgetMs(1_500));
  });
});

describe('POST /api/internal/people/:id/assistant-revoked', () => {
  it('asks each plan’s room to hand the tool’s cards back', async () => {
    const asked: [string, string, string][] = [];
    const roomEnv = {
      INDEX_KEY: 'index-key',
      PLAN_ROOM: {
        idFromName: (name: string) => name,
        get: (id: string) => ({
          assistantRevoked: async (planId: string, personId: string, client: string) => {
            asked.push([id, `${planId}:${personId}`, client]);
            return 1;
          },
        }),
      },
    } as unknown as Parameters<typeof handleInternalItems>[1];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await handleInternalItems(
      new Request('https://api.test/api/internal/people/user_e/assistant-revoked', {
        method: 'POST',
        headers: { Authorization: 'Bearer index-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: 'Claude', items: ['P1', 'P2'] }),
      }),
      roomEnv,
    );
    expect(res?.status).toBe(200);
    expect(asked.sort()).toEqual([
      ['P1', 'P1:user_e', 'Claude'],
      ['P2', 'P2:user_e', 'Claude'],
    ]);
  });
});
