import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
// Another plan's grant, as the index would give it (test-sqlite-d1.ts testGrantFor): the caller's own access, or a
// link's when the test names one for the target.
vi.mock('./plan-grant', async () => {
  const { TEST_GRANT_HOOK } = await import('../test-sqlite-d1');
  return {
    resolvePlanGrant: async (
      ctx: { env: Record<string, unknown>; resolveOwner: () => string | null; request: Request },
      planId: string,
    ) =>
      (
        ctx.env[TEST_GRANT_HOOK] as (
          id: string,
          who: { person: string | null; teams: string[]; code: string | null; create: boolean },
        ) => unknown
      )(planId, {
        person: ctx.resolveOwner(),
        teams: [],
        code: ctx.request.headers.get('X-Target-Code'),
        create: false,
      }),
  };
});
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type {
  CardThreadWriteResponse,
  CardThreadsResponse,
  ItemResponse,
} from '@liveplanner/api-schema';
import { CARD_THREADS_MAX, type CardThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import { sqliteD1, testCopyPlan, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A card's comment threads (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "REST"): starting,
// replying, editing and deleting comments, resolving, renaming, Add Thread to Card in this plan and another, deleting a
// thread, who may do each (Editor, Participant, Viewer, an agent), what reaches the room, cards coming and going, and
// copies.

let sql: SqliteD1;
type Relayed = { op?: { kind?: string; upserts?: CardThread[]; removed?: string[] } };
let relayed: { room: string; body: Relayed }[];

type Who = { owner?: string | null; code?: string; agent?: boolean; targetCode?: string };

async function call<T = unknown>(
  plan: string,
  method: string,
  path: string,
  body?: unknown,
  who: Who = {},
) {
  const pending: Promise<unknown>[] = [];
  const headers: Record<string, string> = {};
  if (who.code) headers['X-Share-Code'] = who.code;
  if (who.targetCode) headers['X-Target-Code'] = who.targetCode;
  const ctx = makeTestRouteContext(method, `/api/projects/${plan}${path}`, {
    env: sql.env,
    owner: who.owner === undefined ? 'owner' : who.owner,
    headers,
    ...(who.agent ? { token: { id: 'tok-1' } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const card = async (plan: string, title: string, who: Who = {}) =>
  (await call<ItemResponse>(plan, 'POST', '/items', { type: 'task', fields: { title } }, who)).body
    .item;

const start = (plan: string, itemId: string, text: string, who: Who = {}, extra = {}) =>
  call<CardThreadWriteResponse>(plan, 'POST', `/items/${itemId}/threads`, { text, ...extra }, who);

const threads = async (plan: string, who: Who = {}, query = '') =>
  (await call<CardThreadsResponse>(plan, 'GET', `/threads${query}`, undefined, who)).body.threads;

let a: Item;
let b: Item;

beforeEach(async () => {
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: (room: string) => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push({ room, body: sentJson(init) as Relayed });
        return new Response(null, { status: 204 });
      },
    }),
  };
  clearTestProfiles();
  setTestProfile('owner', 'Gentle Falcon', '#3b82f6');
  setTestProfile('visitor', 'Vee', '#16a34a');
  setTestProfile('other', 'Otto', '#f97316');
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, saved_at, created_at) VALUES ('p1', 'owner', 'Plan', 1, 1);
    INSERT INTO test_plans (id, owner_id, name, saved_at, created_at) VALUES ('p2', 'other', 'Sprint 12', 1, 1);
  `);
  testShareLink(sql, 'p1', 'PART', 'participate');
  testShareLink(sql, 'p1', 'LOOK', 'view');
  testShareLink(sql, 'p1', 'EDIT', 'edit');
  testShareLink(sql, 'p2', 'P2PART', 'participate');
  testShareLink(sql, 'p2', 'P2LOOK', 'view');
  a = await card('p1', 'Basket');
  b = await card('p1', 'Checkout');
  relayed = [];
});

const threadRelays = () => relayed.filter((r) => r.body.op?.kind === 'threads');

describe('starting a thread', () => {
  it('starts one on a card with its first comment and an automatic title, and tells the room', async () => {
    const res = await start('p1', a.id, 'Basket empties after switching restaurants\nmore');
    expect(res.status).toBe(201);
    const t = res.body.thread!;
    expect(t.title).toBe('Gentle Falcon: Basket empties after switching restaurants');
    expect(t.id).toMatch(/^th-[a-z0-9]{16}$/);
    expect(t.cards).toEqual([{ projectId: 'p1', itemId: a.id, key: a.key }]);
    expect(t.home).toBe('p1');
    expect(t.comments[0]).toMatchObject({ authorName: 'Gentle Falcon', authorId: 'owner' });
    expect(t.comments[0]?.ai).toBeUndefined();
    expect(res.body.commentId).toBe(t.comments[0]!.id);
    const [op] = threadRelays();
    expect(op?.room).toBe('p1');
    expect(op?.body.op?.upserts?.[0]?.comments[0]?.authorId).toBeUndefined();
    expect(op?.body.op?.upserts?.[0]?.createdBy.authorId).toBeUndefined();
  });

  it('takes a given title, and refuses one too long, no text, a missing card and a full card', async () => {
    expect((await start('p1', a.id, 'Hi', {}, { title: 'Basket bug' })).body.thread?.title).toBe(
      'Basket bug',
    );
    expect((await start('p1', a.id, 'Hi', {}, { title: 'x'.repeat(121) })).status).toBe(400);
    expect((await start('p1', a.id, '  ')).status).toBe(400);
    expect((await start('p1', 'nope', 'Hi')).status).toBe(404);
    for (let i = 1; i < CARD_THREADS_MAX; i += 1) await start('p1', b.id, `T${i}`);
    expect((await start('p1', b.id, 'one more')).status).toBe(201);
    const full = await start('p1', b.id, 'too many');
    expect(full.status).toBe(413);
    expect(full.body).toEqual({ error: 'threads_full' });
  });

  it('marks an agent’s comment Generated by AI', async () => {
    const t = (await start('p1', a.id, 'From the agent', { agent: true })).body.thread!;
    expect(t.comments[0]).toMatchObject({ ai: true, tokenId: 'tok-1' });
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields".
  it('starts one in a Comments field of the card’s type, and refuses any other field', async () => {
    const itemTypes = {
      version: 1,
      types: [
        {
          id: 'task',
          label: 'Task',
          color: '#71717a',
          glyph: 'task',
          fields: ['comments', 'f-review', 'f-notes'],
          custom: [
            { id: 'f-review', label: 'Design Review', kind: 'comments' },
            { id: 'f-notes', label: 'Notes', kind: 'text' },
          ],
        },
        { id: 'bug', label: 'Bug', color: '#dc2626', glyph: 'bug', fields: ['title'] },
      ],
    };
    expect((await call('p1', 'PUT', '/item-types', { itemTypes })).status).toBe(200);
    const inReview = await start('p1', a.id, 'Looks off', {}, { field: 'f-review' });
    expect(inReview.status).toBe(201);
    expect(inReview.body.thread?.field).toBe('f-review');
    expect((await threads('p1')).map((t) => t.field)).toEqual(['f-review']);
    // The built-in, named or not, is stored as no field.
    const builtIn = await start('p1', a.id, 'Plain', {}, { field: 'comments' });
    expect(builtIn.body.thread).not.toHaveProperty('field');
    for (const field of ['f-notes', 'f-gone', 'not a field', 7]) {
      const res = await start('p1', a.id, 'Hi', {}, { field });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'field_invalid',
        message:
          "field names a Comments field of the card's type Task: comments (Comments), f-review (Design Review)",
      });
    }
    const bug = (
      await call<ItemResponse>('p1', 'POST', '/items', { type: 'bug', fields: { title: 'B' } })
    ).body.item;
    expect((await start('p1', bug.id, 'Hi', {}, { field: 'comments' })).body).toEqual({
      error: 'field_invalid',
      message: 'a Bug card has no Comments field to start a thread in',
    });
    expect((await start('p1', bug.id, 'Hi')).status).toBe(201);
  });

  it('is a Participant’s and an Editor’s, never a Viewer’s', async () => {
    expect((await start('p1', a.id, 'Hi', { owner: 'visitor', code: 'PART' })).status).toBe(201);
    expect((await start('p1', a.id, 'Hi', { owner: 'visitor', code: 'EDIT' })).status).toBe(201);
    expect((await start('p1', a.id, 'Hi', { owner: 'visitor', code: 'LOOK' })).status).toBe(403);
  });
});

describe('reading', () => {
  it('lists every thread on the plan’s cards, or one card’s, with author ids on the caller’s own only', async () => {
    const t1 = (await start('p1', a.id, 'Mine')).body.thread!;
    await start('p1', b.id, 'Theirs', { owner: 'visitor', code: 'PART' });
    const mine = await threads('p1');
    expect(mine.map((t) => t.comments[0]!.text).sort()).toEqual(['Mine', 'Theirs']);
    const theirs = mine.find((t) => t.comments[0]!.text === 'Theirs')!;
    expect(theirs.comments[0]!.authorId).toBeUndefined();
    expect(theirs.createdBy.authorId).toBeUndefined();
    expect(mine.find((t) => t.id === t1.id)!.createdBy.authorId).toBe('owner');
    expect((await threads('p1', {}, `?item=${a.id}`)).map((t) => t.id)).toEqual([t1.id]);
    // A Viewer reads.
    expect(await threads('p1', { owner: 'visitor', code: 'LOOK' })).toHaveLength(2);
  });

  it('refuses a caller with no access', async () => {
    const res = await call('p1', 'GET', '/threads', undefined, { owner: 'stranger' });
    expect(res.status).toBe(403);
  });
});

describe('the writes on a thread', () => {
  let t: CardThread;
  beforeEach(async () => {
    t = (await start('p1', a.id, 'First')).body.thread!;
    relayed = [];
  });
  const reply = (text: string, who: Who = {}) =>
    call<CardThreadWriteResponse>('p1', 'POST', `/threads/${t.id}/comments`, { text }, who);

  it('replies, reopening a resolved thread, and relays it', async () => {
    await call('p1', 'POST', `/threads/${t.id}/resolve`);
    const res = await reply('Second', { owner: 'visitor', code: 'PART' });
    expect(res.status).toBe(200);
    expect(res.body.thread).toMatchObject({ resolved: false });
    expect(res.body.thread?.comments.map((c) => c.text)).toEqual(['First', 'Second']);
    // The caller's own comment keeps its author id; the starter's does not reach them.
    expect(res.body.thread?.comments[1]?.authorId).toBe('visitor');
    expect(res.body.thread?.comments[0]?.authorId).toBeUndefined();
    expect(threadRelays()).toHaveLength(2);
    expect((await reply('Nope', { owner: 'visitor', code: 'LOOK' })).status).toBe(403);
    expect(
      (await call('p1', 'POST', `/threads/th-zzzzzzzzzzzzzzzz/comments`, { text: 'x' })).status,
    ).toBe(404);
    expect((await call('p1', 'POST', `/threads/not-an-id/comments`, { text: 'x' })).status).toBe(
      404,
    );
  });

  it('edits only the author’s own comment', async () => {
    const id = t.comments[0]!.id;
    const edited = await call<CardThreadWriteResponse>(
      'p1',
      'PUT',
      `/threads/${t.id}/comments/${id}`,
      {
        text: 'First, fixed',
      },
    );
    expect(edited.body.thread?.comments[0]).toMatchObject({ text: 'First, fixed' });
    expect(edited.body.thread?.comments[0]?.editedAt).toEqual(expect.any(Number));
    const theirs = await call(
      'p1',
      'PUT',
      `/threads/${t.id}/comments/${id}`,
      { text: 'Hijack' },
      {
        owner: 'visitor',
        code: 'EDIT',
      },
    );
    expect(theirs.status).toBe(403);
    expect((await call('p1', 'PUT', `/threads/${t.id}/comments/${id}`, { text: '' })).status).toBe(
      400,
    );
    expect((await call('p1', 'PUT', `/threads/${t.id}/comments/nope`, { text: 'x' })).status).toBe(
      404,
    );
    // Unchanged: nothing written.
    expect(
      (await call('p1', 'PUT', `/threads/${t.id}/comments/${id}`, { text: 'First, fixed' })).status,
    ).toBe(204);
  });

  it('lets an agent edit and delete only comments an agent wrote for its person', async () => {
    const own = t.comments[0]!.id;
    expect(
      (await call('p1', 'PUT', `/threads/${t.id}/comments/${own}`, { text: 'x' }, { agent: true }))
        .status,
    ).toBe(403);
    expect(
      (await call('p1', 'DELETE', `/threads/${t.id}/comments/${own}`, undefined, { agent: true }))
        .status,
    ).toBe(403);
    const ai = (await reply('By the agent', { agent: true })).body.commentId!;
    const edited = await call<CardThreadWriteResponse>(
      'p1',
      'PUT',
      `/threads/${t.id}/comments/${ai}`,
      { text: 'By the agent, again' },
      { agent: true },
    );
    expect(edited.body.thread?.comments[1]).toMatchObject({
      text: 'By the agent, again',
      ai: true,
    });
    expect(
      (await call('p1', 'DELETE', `/threads/${t.id}/comments/${ai}`, undefined, { agent: true }))
        .status,
    ).toBe(200);
  });

  it('deletes a comment: one’s own, or any for an Editor; the last one takes the thread', async () => {
    const theirs = (await reply('Theirs', { owner: 'visitor', code: 'PART' })).body.commentId!;
    const own = t.comments[0]!.id;
    expect(
      (
        await call('p1', 'DELETE', `/threads/${t.id}/comments/${own}`, undefined, {
          owner: 'visitor',
          code: 'PART',
        })
      ).status,
    ).toBe(403);
    expect((await call('p1', 'DELETE', `/threads/${t.id}/comments/${theirs}`)).status).toBe(200);
    const last = await call<CardThreadWriteResponse>(
      'p1',
      'DELETE',
      `/threads/${t.id}/comments/${own}`,
    );
    expect(last.body.thread).toBeNull();
    expect(await threads('p1')).toEqual([]);
    expect(threadRelays().at(-1)?.body.op?.removed).toEqual([t.id]);
  });

  it('resolves and reopens, saying who; already so answers nothing', async () => {
    const r = await call<CardThreadWriteResponse>(
      'p1',
      'POST',
      `/threads/${t.id}/resolve`,
      undefined,
      {
        owner: 'visitor',
        code: 'PART',
      },
    );
    expect(r.body.thread).toMatchObject({ resolved: true, resolvedBy: 'Vee' });
    expect((await call('p1', 'POST', `/threads/${t.id}/resolve`)).status).toBe(204);
    const o = await call<CardThreadWriteResponse>('p1', 'POST', `/threads/${t.id}/reopen`);
    expect(o.body.thread?.resolved).toBe(false);
    expect(
      (
        await call('p1', 'POST', `/threads/${t.id}/resolve`, undefined, {
          owner: 'visitor',
          code: 'LOOK',
        })
      ).status,
    ).toBe(403);
  });

  it('renames, goes back to the automatic title, and refuses too long, and an agent', async () => {
    const r = await call<CardThreadWriteResponse>('p1', 'PUT', `/threads/${t.id}/title`, {
      title: ' Basket  bug ',
    });
    expect(r.body.thread?.title).toBe('Basket bug');
    const back = await call<CardThreadWriteResponse>('p1', 'PUT', `/threads/${t.id}/title`, {
      title: '',
    });
    expect(back.body.thread?.title).toBe('Gentle Falcon: First');
    expect(
      (await call('p1', 'PUT', `/threads/${t.id}/title`, { title: 'x'.repeat(121) })).status,
    ).toBe(400);
    expect(
      (await call('p1', 'PUT', `/threads/${t.id}/title`, { title: 'AI' }, { agent: true })).status,
    ).toBe(403);
  });

  // items.md "Deleting a thread": only when every comment is the caller's own, Editors included; never an agent.
  it('deletes a thread only when every comment in it is the caller’s own, Editors included; never an agent', async () => {
    const del = (id: string, who: Who = {}) =>
      call<{ error?: string }>('p1', 'DELETE', `/threads/${id}`, undefined, who);
    // The owner's thread: a Participant and an Editor who wrote none of it are refused; so is an agent.
    expect(await del(t.id, { owner: 'visitor', code: 'PART' })).toEqual({
      status: 409,
      body: { error: 'thread_has_others' },
    });
    expect((await del(t.id, { owner: 'visitor', code: 'EDIT' })).body).toEqual({
      error: 'thread_has_others',
    });
    expect((await del(t.id, { agent: true })).status).toBe(403);
    // A Participant deletes a thread made only of their own comments.
    const theirs = (await start('p1', b.id, 'Mine', { owner: 'visitor', code: 'PART' })).body
      .thread!;
    expect((await del(theirs.id, { owner: 'visitor', code: 'PART' })).status).toBe(204);
    // Its starter, an Editor too, may not once someone else has replied; resolving is the way on.
    await reply('Me too', { owner: 'visitor', code: 'PART' });
    expect(await del(t.id)).toEqual({ status: 409, body: { error: 'thread_has_others' } });
    expect((await call('p1', 'POST', `/threads/${t.id}/resolve`)).status).toBe(200);
    // With the other comment gone, every comment is theirs again.
    const other = (await threads('p1'))[0]!.comments[1]!.id;
    expect(
      (
        await call('p1', 'DELETE', `/threads/${t.id}/comments/${other}`, undefined, {
          owner: 'visitor',
          code: 'PART',
        })
      ).status,
    ).toBe(200);
    expect((await del(t.id)).status).toBe(204);
    expect(await threads('p1')).toEqual([]);
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM card_thread_links').get()!.n).toBe(0);
  });

  it('counts a comment an agent posted with the person’s own token as theirs', async () => {
    const own = (await start('p1', b.id, 'Mine')).body.thread!;
    await call(
      'p1',
      'POST',
      `/threads/${own.id}/comments`,
      { text: 'From my agent' },
      { agent: true },
    );
    expect((await call('p1', 'DELETE', `/threads/${own.id}`)).status).toBe(204);
  });

  it('rejects verbs it does not take', async () => {
    expect((await call('p1', 'POST', '/threads')).status).toBe(405);
    expect((await call('p1', 'GET', `/threads/${t.id}`)).status).toBe(405);
    expect((await call('p1', 'GET', `/threads/${t.id}/resolve`)).status).toBe(405);
    expect((await call('p1', 'GET', `/threads/${t.id}/title`)).status).toBe(405);
    expect((await call('p1', 'GET', `/threads/${t.id}/cards`)).status).toBe(405);
    expect((await call('p1', 'GET', `/threads/${t.id}/comments`)).status).toBe(405);
    expect((await call('p1', 'POST', `/threads/${t.id}/comments/x`)).status).toBe(405);
    expect((await call('p1', 'GET', `/items/${a.id}/threads`)).status).toBe(405);
  });
});

describe('Add Thread to Card', () => {
  let t: CardThread;
  beforeEach(async () => {
    t = (await start('p1', a.id, 'Shared one')).body.thread!;
    relayed = [];
  });
  const add = (body: unknown, who: Who = {}) =>
    call<CardThreadWriteResponse>('p1', 'POST', `/threads/${t.id}/cards`, body, who);

  it('puts it on another card of the plan: one thread, on both, with every write on both', async () => {
    const res = await add({ itemId: b.id });
    expect(res.body.thread?.cards.map((c) => c.itemId)).toEqual([a.id, b.id]);
    expect((await threads('p1', {}, `?item=${b.id}`)).map((x) => x.id)).toEqual([t.id]);
    await call('p1', 'POST', `/threads/${t.id}/comments`, { text: 'From b' });
    const [one] = await threads('p1');
    expect(one!.comments).toHaveLength(2);
    expect((await add({ itemId: b.id })).status).toBe(409);
    expect((await add({ itemId: 'nope' })).status).toBe(404);
    expect((await add({})).status).toBe(400);
    expect((await add({ itemId: b.id }, { agent: true })).status).toBe(403);
  });

  it('refuses a card in another plan, whatever the caller may do there, and links nothing', async () => {
    const other = await card('p2', 'Over there', { owner: 'other' });
    for (const who of [{ targetCode: 'P2PART' }, { targetCode: 'P2LOOK' }, {}] as Who[]) {
      const res = await add({ projectId: 'p2', itemId: other.id }, who);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'thread_other_plan' });
    }
    // Naming this plan is the same as naming none.
    expect((await add({ projectId: 'p1', itemId: b.id })).status).toBe(200);
    expect(
      sql.sql.prepare(`SELECT COUNT(*) AS n FROM card_thread_links WHERE plan_id = 'p2'`).get()!.n,
    ).toBe(0);
  });

  it('keeps a thread shared into another plan before the rule: read and written from there by role', async () => {
    const other = await card('p2', 'Over there', { owner: 'other' });
    // As the first release left it: p2's card holds a link to p1's thread, and the thread lists that card.
    sql.sql
      .prepare(
        `INSERT INTO card_thread_links (plan_id, item_id, thread_id, home, added_at, open_comments)
         VALUES ('p2', ?, ?, 'p1', 1, 1)`,
      )
      .run(other.id, t.id);
    const cards = [
      ...t.cards,
      { projectId: 'p2', itemId: other.id, key: other.key, projectName: 'Sprint 12' },
    ];
    sql.sql
      .prepare(`UPDATE card_threads SET cards = ? WHERE plan_id = 'p1' AND id = ?`)
      .run(JSON.stringify(cards), t.id);
    // p2's owner reads it through their own card, and replies from there; p1 holds it once.
    const seen = await threads('p2', { owner: 'other' });
    expect(seen.map((x) => x.id)).toEqual([t.id]);
    const r = await call<CardThreadWriteResponse>(
      'p2',
      'POST',
      `/threads/${t.id}/comments`,
      { text: 'From p2' },
      { owner: 'other' },
    );
    expect(r.status).toBe(200);
    expect((await threads('p1'))[0]!.comments.map((c) => c.text)).toEqual([
      'Shared one',
      'From p2',
    ]);
    // A Viewer on p2 reads it there, and may not reply.
    expect(await threads('p2', { owner: 'visitor', code: 'P2LOOK' })).toHaveLength(1);
    expect(
      (
        await call(
          'p2',
          'POST',
          `/threads/${t.id}/comments`,
          { text: 'x' },
          { owner: 'visitor', code: 'P2LOOK' },
        )
      ).status,
    ).toBe(403);
    // Another plan's reply is someone else's comment: the thread is not deleted, through p2 or through its home.
    expect(await call('p2', 'DELETE', `/threads/${t.id}`, undefined, { owner: 'other' })).toEqual({
      status: 409,
      body: { error: 'thread_has_others' },
    });
    expect((await call('p1', 'DELETE', `/threads/${t.id}`)).status).toBe(409);
    // Once it is all theirs again, deleting it from p1 takes it off p2's card too.
    const fromP2 = r.body.thread!.comments[1]!.id;
    expect(
      (
        await call('p2', 'DELETE', `/threads/${t.id}/comments/${fromP2}`, undefined, {
          owner: 'other',
        })
      ).status,
    ).toBe(200);
    expect((await call('p1', 'DELETE', `/threads/${t.id}`)).status).toBe(204);
    expect(await threads('p2', { owner: 'other' })).toEqual([]);
  });

  it('takes the link back when the thread is on as many cards as it may be', async () => {
    sql.sql.prepare(`UPDATE card_threads SET cards = ? WHERE id = ?`).run(
      JSON.stringify(
        Array.from({ length: 20 }, (_, i) => ({
          projectId: 'p1',
          itemId: i ? `x${i}` : a.id,
          key: i,
        })),
      ),
      t.id,
    );
    const res = await add({ itemId: b.id });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'thread_cards_full' });
    expect(
      sql.sql.prepare(`SELECT COUNT(*) AS n FROM card_thread_links WHERE item_id = ?`).get(b.id)!.n,
    ).toBe(0);
  });
});

describe('cards coming and going', () => {
  it('a card deleted for good leaves its threads; a thread on it alone goes with it', async () => {
    const shared = (await start('p1', a.id, 'Shared')).body.thread!;
    await call('p1', 'POST', `/threads/${shared.id}/cards`, { itemId: b.id });
    const lone = (await start('p1', a.id, 'Alone')).body.thread!;
    expect((await call('p1', 'DELETE', `/items/${a.id}`)).status).toBe(204);
    const left = await threads('p1');
    expect(left.map((t) => t.id)).toEqual([shared.id]);
    expect(left[0]!.cards.map((c) => c.itemId)).toEqual([b.id]);
    expect(
      sql.sql
        .prepare('SELECT id FROM card_threads')
        .all()
        .map((r) => r.id),
    ).toEqual([shared.id]);
    void lone;
  });

  it('an undo of that delete puts the card back on its threads, a lone one whole', async () => {
    const shared = (await start('p1', a.id, 'Shared')).body.thread!;
    await call('p1', 'POST', `/threads/${shared.id}/cards`, { itemId: b.id });
    const lone = (await start('p1', a.id, 'Alone')).body.thread!;
    const before = await threads('p1', {}, `?item=${a.id}`);
    await call('p1', 'DELETE', `/items/${a.id}`);
    const back = await call<ItemResponse>('p1', 'POST', '/items', {
      id: a.id,
      key: a.key,
      type: 'task',
      fields: { title: 'Basket' },
      threads: before,
    });
    expect(back.status).toBe(201);
    const now = await threads('p1', {}, `?item=${a.id}`);
    expect(now.map((t) => t.id).sort()).toEqual([shared.id, lone.id].sort());
    expect(
      now
        .find((t) => t.id === shared.id)!
        .cards.map((c) => c.itemId)
        .sort(),
    ).toEqual([a.id, b.id].sort());
    // A Participant puts no card back with its threads.
    expect(
      (
        await call(
          'p1',
          'POST',
          '/items',
          { type: 'task', fields: { title: 'X' }, threads: before },
          { owner: 'visitor', code: 'PART' },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call('p1', 'POST', '/items', {
          type: 'task',
          fields: { title: 'X' },
          threads: [{ nope: 1 }],
        })
      ).status,
    ).toBe(400);
  });

  it('reads a card’s old single thread, from a client before threads, as its first thread', async () => {
    const res = await call<ItemResponse>('p1', 'POST', '/items', {
      type: 'task',
      fields: { title: 'Old' },
      comments: {
        resolved: true,
        comments: [
          { id: 'c1', text: 'Old words', createdAt: 5, authorName: 'Ada', authorColor: '#2563eb' },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.item.fields.comments).toBeUndefined();
    const [t] = await threads('p1', {}, `?item=${res.body.item.id}`);
    expect(t).toMatchObject({
      id: `c-${res.body.item.id}`,
      resolved: true,
      title: 'Ada: Old words',
    });
  });

  it('a copy takes the threads the plan stores on its cards, re-homed', async () => {
    const t = (await start('p1', a.id, 'Copied')).body.thread!;
    await testCopyPlan(sql.env, 'p1', 'p3', 'owner', 'Copy');
    const copied = sql.sql
      .prepare(`SELECT id, plan_id, cards FROM card_threads WHERE plan_id = 'p3'`)
      .all() as { id: string; cards: string }[];
    expect(copied.map((r) => r.id)).toEqual([t.id]);
    expect(JSON.parse(copied[0]!.cards)).toEqual([{ projectId: 'p3', itemId: a.id, key: a.key }]);
    expect(
      sql.sql
        .prepare(`SELECT item_id FROM card_thread_links WHERE plan_id = 'p3'`)
        .all()
        .map((r) => r.item_id),
    ).toEqual([a.id]);
  });
});
