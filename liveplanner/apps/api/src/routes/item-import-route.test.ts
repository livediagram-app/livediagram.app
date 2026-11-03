import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type { ItemsImportStaged, ItemsResponse } from '@liveplanner/api-schema';
import {
  ITEMS_MAX,
  importParts,
  newItemId,
  presetSetup,
  type TrackerCreate,
} from '@liveplanner/items';
import { withImportedThreads, type ImportedCreate } from '@liveplanner/project';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { ITEM_IMPORT_HOLD_MS, sweepHeldImports } from '../db/item-imports';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A whole import (docs/specs/026-plan/tracker-import.md "The import", blueprint tracker-import.md "A whole import"):
// parts held, then landed in one transaction or not at all; the gates; the room it checks; the hour's sweep; the caps.

let sql: SqliteD1;
let relayed: { op: { kind: string; upserts: unknown[]; rev?: number } }[];

async function call<T = unknown>(body: unknown, opts: { code?: string; path?: string } = {}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext('POST', `/api/projects/d1${opts.path ?? '/items/import'}`, {
    env: sql.env,
    // A link's visitor is someone other than the owner.
    owner: opts.code ? 'visitor' : 'owner',
    ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
    body,
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const count = (table: string) =>
  (sql.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

// `n` imported cards, every `withComments`th one with an Imported comments thread of `comments` comments.
function cards(n: number, opts: { withComments?: number; comments?: number; text?: number } = {}) {
  const creates: TrackerCreate[] = Array.from({ length: n }, (_, i) => ({
    id: newItemId(),
    type: 'task',
    fields: { title: `Card ${i + 1}` },
    place: { status: 'todo' },
    importedComments:
      opts.withComments && i % opts.withComments === 0
        ? Array.from({ length: opts.comments ?? 1 }, (_, c) => ({
            text: `Ada (1 May): comment ${c} ${'x'.repeat(opts.text ?? 10)}`,
            at: 1_000 + c,
          }))
        : [],
  }));
  return withImportedThreads(creates, { projectId: 'd1', sourceName: 'Trello', now: 5_000 });
}

// Every part of an import of `creates`, in order; the answers.
async function send(creates: ImportedCreate[], importId = 'import-0001') {
  const out: { status: number; body: unknown }[] = [];
  for (const part of importParts(importId, creates)) out.push(await call(part));
  return out;
}

beforeEach(() => {
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (url: string, init: RequestInit) => {
        if (!url.endsWith('/purge')) relayed.push(sentJson(init) as (typeof relayed)[number]);
        return new Response(null, { status: 204 });
      },
    }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
  `);
});

describe('a whole import', () => {
  it('holds every part but the last, then lands every card at once', async () => {
    const creates = cards(450, { withComments: 3, comments: 2 });
    const [first, second, last] = await send(creates);
    expect(first).toEqual({ status: 202, body: { staged: 200 } satisfies ItemsImportStaged });
    expect(second).toEqual({ status: 202, body: { staged: 400 } });
    // Held, not written: nothing a read of the store sees, and nothing relayed, until the last part.
    expect(last!.status).toBe(201);
    const landed = last!.body as ItemsResponse;
    expect(landed.items).toHaveLength(450);
    expect(landed.items.map((i) => i.key)).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
    expect(landed.items.map((i) => i.id)).toEqual(creates.map((c) => c.id));
    expect(count('items')).toBe(450);
    expect(count('item_import_parts')).toBe(0);
    // A thread per card with comments, linked to it, homed here, on that card alone.
    expect(count('card_threads')).toBe(150);
    expect(count('card_thread_links')).toBe(150);
    const link = sql.sql
      .prepare('SELECT item_id, open_comments FROM card_thread_links ORDER BY added_at LIMIT 1')
      .get() as { item_id: string; open_comments: number };
    expect(link.open_comments).toBe(2);
    // The room hears it as three bulk writes would have: an items op per 200 cards at its own rev, in order.
    const items = relayed.filter((r) => r.op.kind === 'items');
    expect(items.map((r) => [r.op.upserts.length, r.op.rev])).toEqual([
      [200, 1],
      [200, 2],
      [50, 3],
    ]);
    expect(landed.rev).toBe(3);
    const threads = relayed.filter((r) => r.op.kind === 'threads');
    expect(threads.reduce((n, r) => n + r.op.upserts.length, 0)).toBe(150);
    // Its history: one entry a card, never tagged undo.
    const tags = sql.sql.prepare('SELECT DISTINCT tag FROM item_history').all();
    expect(tags).toEqual([{ tag: null }]);
    expect(count('item_history')).toBe(450);
  });

  it('lands a one-part import straight away', async () => {
    const [only] = await send(cards(3));
    expect(only!.status).toBe(201);
    expect(count('items')).toBe(3);
  });

  it('writes no card when the landing batch fails part way', async () => {
    // A card past the first 200 refuses to insert: the batch has already written the first part's rows.
    sql.sql.exec(`CREATE TEMP TRIGGER fail_mid_import BEFORE INSERT ON items WHEN NEW.item_key = 300
      BEGIN SELECT RAISE(ABORT, 'disk full'); END`);
    const answers = await send(cards(450, { withComments: 2 }));
    expect(answers.map((a) => a.status)).toEqual([202, 202, 409]);
    expect(answers[2]!.body).toMatchObject({ error: 'item_busy' });
    expect(count('items')).toBe(0);
    expect(count('card_threads')).toBe(0);
    expect(count('card_thread_links')).toBe(0);
    expect(relayed).toEqual([]);
    // Its parts stay held for a resend of the last part, which lands it once the store takes it.
    sql.sql.exec('DROP TRIGGER fail_mid_import');
    expect(count('item_import_parts')).toBe(400);
    const parts = importParts('import-0001', cards(450));
    const again = await call<ItemsResponse>({ ...parts[2]!, importId: 'import-0001' });
    expect(again.status).toBe(201);
    expect(count('items')).toBe(450);
  });

  it('writes no card when a part is refused, and refuses the last part then', async () => {
    const creates = cards(450);
    const parts = importParts('import-0001', creates);
    expect((await call(parts[0])).status).toBe(202);
    const bad = await call({ ...parts[1]!, items: [{ type: 'task', fields: {} }] });
    expect(bad.status).toBe(400);
    expect(count('item_import_parts')).toBe(0);
    const last = await call(parts[2]);
    expect(last).toMatchObject({ status: 409, body: { error: 'import_incomplete' } });
    expect(count('items')).toBe(0);
  });

  it('refuses a last part sent before the rest, holding nothing', async () => {
    const parts = importParts('import-0001', cards(450));
    expect((await call(parts[0])).status).toBe(202);
    expect((await call(parts[2])).status).toBe(409);
    expect(count('items')).toBe(0);
    expect(count('item_import_parts')).toBe(0);
  });

  it('replaces a part sent again', async () => {
    const parts = importParts('import-0001', cards(450));
    await call(parts[0]);
    expect((await call(parts[0])).body).toEqual({ staged: 200 });
    await call(parts[1]);
    expect((await call(parts[2])).status).toBe(201);
    expect(count('items')).toBe(450);
  });

  it('refuses a part past the plan’s room, and a last part past it', async () => {
    const seed = sql.sql.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('d1', ?, 'task', ?, ?, '{"title":"x"}', 1, 1, 1, '{}', '{}')`,
    );
    for (let i = 1; i <= ITEMS_MAX - 300; i += 1) seed.run(`seed-${i}`, i, `a${i}`);
    sql.sql.exec(`UPDATE plan SET items_next_key = ${ITEMS_MAX + 1} WHERE id = 'd1'`);
    const parts = importParts('import-0001', cards(450));
    expect((await call(parts[0])).status).toBe(202);
    expect(await call(parts[1])).toMatchObject({ status: 413, body: { error: 'items_full' } });
    expect(count('item_import_parts')).toBe(0);
    // Room taken by another write while an import's parts wait: refused at its landing.
    const fits = importParts('import-0002', cards(250));
    expect((await call(fits[0])).status).toBe(202);
    for (let i = 1; i <= 100; i += 1) seed.run(`late-${i}`, ITEMS_MAX + i, `b${i}`);
    expect(await call(fits[1])).toMatchObject({ status: 413, body: { error: 'items_full' } });
    expect(count('items')).toBe(ITEMS_MAX - 200);
    expect(count('item_import_parts')).toBe(0);
  });

  it('refuses a Blocked By loop across its parts at the landing', async () => {
    const blocked = 'f-blocked-by';
    const catalogue = {
      version: 1,
      types: [
        {
          id: 'task',
          label: 'Task',
          color: '#71717a',
          glyph: 'task',
          fields: ['title', 'status', blocked],
          custom: [
            {
              id: blocked,
              label: 'Blocked By',
              kind: 'card',
              linkType: 'task',
              multiple: true,
              blocks: true,
            },
          ],
        },
      ],
    };
    sql.sql
      .prepare(`UPDATE plan SET item_types = ? WHERE id = 'd1'`)
      .run(JSON.stringify(catalogue));
    const creates = cards(201);
    creates[0]!.fields = { ...creates[0]!.fields, [blocked]: [creates[200]!.id] };
    creates[200]!.fields = { ...creates[200]!.fields, [blocked]: [creates[0]!.id] };
    const answers = await send(creates);
    expect(answers[0]!.status).toBe(202);
    expect(answers[1]).toMatchObject({ status: 400, body: { error: 'blocks_cycle' } });
    expect(count('items')).toBe(0);
    expect(count('item_import_parts')).toBe(0);
  });

  it('takes only new threads of this plan, and an old single thread as one', async () => {
    const [foreign] = cards(1, { withComments: 1 });
    const answer = await call({
      importId: 'import-0001',
      part: 0,
      parts: 1,
      items: [
        { ...foreign, threads: foreign!.threads!.map((t) => ({ ...t, home: 'other-plan' })) },
      ],
    });
    expect(answer).toMatchObject({ status: 400, body: { error: 'field_value_invalid' } });
    // A card's old single thread (a client from before threads) lands as its first thread.
    const id = newItemId();
    const legacy = await call<ItemsResponse>({
      importId: 'import-0002',
      part: 0,
      parts: 1,
      items: [
        {
          id,
          type: 'task',
          fields: { title: 'Old' },
          comments: {
            comments: [
              { id: 'c1', text: 'hi', authorName: 'Ada', authorColor: '#71717a', createdAt: 1 },
            ],
          },
        },
      ],
    });
    expect(legacy.status).toBe(201);
    expect(sql.sql.prepare('SELECT id FROM card_threads').all()).toEqual([{ id: `c-${id}` }]);
  });

  it('answers a bad part’s place and a write it does not take', async () => {
    const [card] = cards(1);
    const part = { importId: 'import-0001', part: 0, parts: 1, items: [card] };
    expect((await call({ ...part, importId: 'bad id' })).status).toBe(400);
    expect((await call({ ...part, importId: 7 })).status).toBe(400);
    expect((await call({ ...part, parts: 0 })).status).toBe(400);
    expect((await call({ ...part, parts: ITEMS_MAX + 1 })).status).toBe(400);
    expect((await call({ ...part, part: 1 })).status).toBe(400);
    expect((await call({ ...part, part: 0.5 })).status).toBe(400);
    expect((await call({ ...part, items: [] })).status).toBe(400);
    expect((await call('not json')).status).toBe(400);
    const get = makeTestRouteContext('GET', '/api/projects/d1/items/import', {
      env: sql.env,
      owner: 'owner',
    });
    expect((await handleProjects(get)).status).toBe(405);
    expect(count('items')).toBe(0);
  });

  it('clears parts left waiting an hour, at the next import and in the upkeep', async () => {
    const parts = importParts('import-0001', cards(450));
    await call(parts[0]);
    sql.sql.exec(
      `UPDATE item_import_parts SET created_at = created_at - ${ITEM_IMPORT_HOLD_MS + 1}`,
    );
    await send(cards(1), 'import-0002');
    expect(count('item_import_parts')).toBe(0);
    await call(parts[1]);
    expect(await sweepHeldImports(sql.env, 'd1', Date.now() + 1)).toBe(200);
    expect(await sweepHeldImports(sql.env, 'd1', Date.now() + 1)).toBe(0);
  });
});

// docs/specs/026-plan/tracker-import.md "Who may": an import is an Editor's, on the whole plan.
describe('who may import', () => {
  it.each([
    ['a Participant', 'PART', 403],
    ['a Viewer', 'VIEW', 403],
    ['a tab-scoped link', 'TAB1', 403],
    ['an Editor by link', 'EDIT', 201],
  ])('%s', async (_who, code, status) => {
    const path = code === 'TAB1' ? '/items/import?tabId=t1' : '/items/import';
    const [part] = importParts('import-0001', cards(2));
    expect((await call(part, { code, path })).status).toBe(status);
    expect(count('items')).toBe(status === 201 ? 2 : 0);
    expect(count('item_import_parts')).toBe(0);
  });
});

describe('an import at the caps', () => {
  it('lands 2,000 cards and 20,000 comments in one batch, under a CPU budget', async () => {
    const creates = cards(ITEMS_MAX, { withComments: 1, comments: 10, text: 200 });
    const parts = importParts('import-caps', creates);
    expect(parts.length).toBeGreaterThan(1);
    const ms = await cpuMsOfAsync(async () => {
      for (const part of parts) await call(part);
    });
    expect(count('items')).toBe(ITEMS_MAX);
    expect(count('card_threads')).toBe(ITEMS_MAX);
    expect(count('item_import_parts')).toBe(0);
    expect(ms).toBeLessThan(cpuBudgetMs(1_500));
  });
});
