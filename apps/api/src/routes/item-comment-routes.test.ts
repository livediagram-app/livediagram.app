import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import type { CommentThread } from '@livediagram/document';
import type { Item } from '@livediagram/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A Plan card's comments (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Comments"): who
// may add, delete, resolve and reopen; author ids only to their author; the relay; restore; Community copies.

let sql: SqliteD1;
let relayed: { op?: { upserts?: Item[] } }[];

async function call<T = unknown>({
  method = 'POST',
  path,
  body,
  owner = 'owner',
  code,
}: {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string | null;
  code?: string;
}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/documents/d1${path}`, {
    env: sql.env,
    owner,
    ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleDocuments(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const thread = (item: Item) => item.fields['comments'] as unknown as CommentThread | undefined;

let item: Item;
const post = (text: string, who: { owner?: string; code?: string } = {}) =>
  call<ItemResponse>({ path: `/items/${item.id}/comments`, body: { text }, ...who });

beforeEach(async () => {
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      },
    }),
  };
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO participants (id, name, color, created_at) VALUES ('owner', 'Webber', '#3b82f6', 1);
    INSERT INTO participants (id, name, color, created_at) VALUES ('visitor', 'Vee', '#16a34a', 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
  item = (
    await call<ItemResponse>({ path: '/items', body: { type: 'task', fields: { title: 'A' } } })
  ).body.item;
  relayed = [];
});

describe('adding', () => {
  it('stamps the author from the server, answers the item, and relays it without author ids', async () => {
    const res = await call<ItemResponse>({
      path: `/items/${item.id}/comments`,
      body: { text: '  Looks good  ', authorName: 'Mallory', authorId: 'owner' },
      owner: 'visitor',
      code: 'VIEW',
    });
    expect(res.status).toBe(200);
    const [c] = thread(res.body.item)!.comments;
    expect(c).toMatchObject({ text: 'Looks good', authorName: 'Vee', authorId: 'visitor' });
    expect(res.body.item.rev).toBe(item.rev + 1);
    const out = relayed.find((r) => r.op?.upserts)!.op!.upserts![0]!;
    expect(thread(out)!.comments[0]!.authorId).toBeUndefined();
    expect(thread(out)!.comments[0]!.text).toBe('Looks good');
  });

  it('refuses empty or overlong text, and a patch that tries to write comments', async () => {
    expect((await post('   ')).status).toBe(400);
    expect((await post('x'.repeat(2001))).status).toBe(400);
    const patch = await call({
      path: `/items/${item.id}`,
      body: { set: { comments: { comments: [], resolved: false } } },
    });
    expect(patch).toMatchObject({ status: 400, body: { error: 'comments_read_only' } });
  });

  it('refuses a comment past a full thread', async () => {
    for (let i = 0; i < 200; i++) await post(`c${i}`);
    expect((await post('one more')).body).toMatchObject({ error: 'comments_full' });
  });

  it('answers 404 for a missing item', async () => {
    expect((await call({ path: '/items/nosuchitem1/comments', body: { text: 'hi' } })).status).toBe(
      404,
    );
  });
});

describe('author ids', () => {
  it('reach their author alone, in a list and in answers', async () => {
    await post('mine', { owner: 'visitor', code: 'VIEW' });
    await post('owner says');
    const asVisitor = await call<ItemsResponse>({
      method: 'GET',
      path: '/items',
      owner: 'visitor',
      code: 'VIEW',
    });
    const seen = thread(asVisitor.body.items[0]!)!.comments;
    expect(seen.map((c) => c.authorId)).toEqual(['visitor', undefined]);
    const asOwner = await call<ItemsResponse>({ method: 'GET', path: '/items' });
    expect(thread(asOwner.body.items[0]!)!.comments.map((c) => c.authorId)).toEqual([
      undefined,
      'owner',
    ]);
  });
});

describe('deleting', () => {
  it('lets anyone delete their own, an editor any, and nobody else', async () => {
    const theirs = thread((await post('by owner')).body.item)!.comments[0]!;
    const mine = thread((await post('by visitor', { owner: 'visitor', code: 'VIEW' })).body.item)!
      .comments[1]!;
    const del = (id: string, who: { owner?: string; code?: string } = {}) =>
      call({ method: 'DELETE', path: `/items/${item.id}/comments/${id}`, ...who });
    expect((await del(theirs.id, { owner: 'visitor', code: 'VIEW' })).status).toBe(403);
    expect((await del(mine.id, { owner: 'visitor', code: 'VIEW' })).status).toBe(200);
    expect((await del('nosuch')).body).toMatchObject({ error: 'comment_not_found' });
    const last = await call<ItemResponse>({
      method: 'DELETE',
      path: `/items/${item.id}/comments/${theirs.id}`,
    });
    expect(last.status).toBe(200);
    expect(thread(last.body.item)).toBeUndefined();
  });
});

describe('resolving', () => {
  it('resolves and reopens from a view link, writing nothing for no change', async () => {
    await post('a question');
    const verb = (v: string) =>
      call<ItemResponse>({
        path: `/items/${item.id}/comments/${v}`,
        owner: 'visitor',
        code: 'VIEW',
      });
    const r = await verb('resolve');
    expect(r.status).toBe(200);
    expect(thread(r.body.item)!.resolved).toBe(true);
    expect((await verb('resolve')).status).toBe(204);
    expect(thread((await verb('reopen')).body.item)!.resolved).toBe(false);
    // A new comment on a resolved thread reopens it, as on the canvas.
    await verb('resolve');
    expect(thread((await post('again')).body.item)!.resolved).toBe(false);
  });

  it('answers 405 for a wrong method', async () => {
    expect((await call({ method: 'GET', path: `/items/${item.id}/comments` })).status).toBe(405);
    expect((await call({ method: 'GET', path: `/items/${item.id}/comments/resolve` })).status).toBe(
      405,
    );
    expect((await call({ method: 'POST', path: `/items/${item.id}/comments/abc` })).status).toBe(
      405,
    );
  });
});

describe('restore and copies', () => {
  it('restores a thread with a card, keeping author ids on the restorer’s own only', async () => {
    const res = await call<ItemResponse>({
      path: '/items',
      body: {
        type: 'task',
        fields: { title: 'Back' },
        comments: {
          resolved: false,
          comments: [
            {
              id: 'a',
              text: 'x',
              createdAt: 1,
              authorName: 'W',
              authorColor: '#000000',
              authorId: 'owner',
            },
            {
              id: 'b',
              text: 'y',
              createdAt: 2,
              authorName: 'V',
              authorColor: '#000000',
              authorId: 'visitor',
            },
          ],
        },
      },
    });
    expect(res.status).toBe(201);
    const stored = (await db.readItem(sql.env, 'd1', res.body.item.id))!;
    expect(thread(stored)!.comments.map((c) => c.authorId)).toEqual(['owner', undefined]);
    const bad = await call({
      path: '/items',
      body: {
        type: 'task',
        fields: { title: 'Bad' },
        comments: { comments: 'no', resolved: false },
      },
    });
    expect(bad.status).toBe(400);
  });

  it('keeps comments in a copy, and leaves them out of a Community copy', async () => {
    await post('keep me');
    await db.copyDocument(sql.env, 'd1', 'd2', 'owner', 'Copy');
    expect(thread((await db.listItems(sql.env, 'd2'))[0]!)!.comments).toHaveLength(1);
    await db.copyDocument(sql.env, 'd1', 'd3', 'owner', 'Community', null, true);
    const community = (await db.listItems(sql.env, 'd3'))[0]!;
    expect(community.fields['comments']).toBeUndefined();
    expect(community.fields['title']).toBe('A');
  });
});
