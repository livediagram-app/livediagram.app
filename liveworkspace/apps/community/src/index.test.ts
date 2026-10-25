// The Worker over HTTP (liveworkspace/docs/community.md "The API"): the public routes one app at a time
// with their CORS, likes and reports; the app routes behind each app's key; the rules publishing keeps.
import {
  COMMUNITY_POSTS_PER_AUTHOR,
  type CommunityAppPost,
  type CommunityAppPublish,
  type CommunityListResponse,
  type CommunityMineResponse,
  type CommunityPostResponse,
} from '@liveworkspace/community';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from './index';
import { testDb, type TestDb } from './test-sqlite-d1';
import type { Env } from './env';

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
const BASE = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/community';
const KEY = '0b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f';
const KEY2 = '1b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f';
const KEY3 = '2b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f';

let db: TestDb;
beforeEach(() => {
  db = testDb();
});

const call = (path: string, init: RequestInit = {}, env: Env = db.env) =>
  worker.fetch(new Request(`${BASE}${path}`, init), env, ctx);

// An app's own Worker: its key, its name.
const asApp = (path: string, init: RequestInit = {}, app = 'livediagram.app', key = 'ld-key') =>
  call(path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'X-Community-App': app, ...init.headers },
  });

const body = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'Content-Type': 'application/json' },
});

const publishing = (patch: Partial<CommunityAppPublish> = {}): CommunityAppPublish => ({
  owner: 'user_author',
  shareCode: 'CODE1',
  documentState: 'public',
  author: { name: 'Ada', color: '#f97316', picture: 'https://img.clerk.com/ada.png' },
  input: {
    title: 'Payments platform',
    description: 'How our payment services talk to each other.',
    category: 'architecture',
    tags: ['AWS', 'event driven'],
    anonymous: false,
  },
  ...patch,
});

async function publish(document = 'd1', patch: Partial<CommunityAppPublish> = {}) {
  const res = await asApp(`/app/documents/${document}`, {
    method: 'PUT',
    ...body(publishing(patch)),
  });
  return { res, post: res.ok ? ((await res.json()) as { post: CommunityAppPost }).post : null };
}

const fromPage = (origin = 'https://livediagram.app', key = KEY): Record<string, string> => ({
  Origin: origin,
  'X-Community-Key': key,
});

describe('the app routes', () => {
  it("refuse a caller without the app's key", async () => {
    expect((await call('/app/sync', { method: 'POST' })).status).toBe(401);
    expect((await asApp('/app/sync', { method: 'POST' }, 'livediagram.app', 'lp-key')).status).toBe(
      401,
    );
    expect((await asApp('/app/sync', { method: 'POST' }, 'example.app')).status).toBe(401);
    const unset = testDb({ COMMUNITY_KEY_LIVEDIAGRAM: undefined });
    const res = await worker.fetch(
      new Request(`${BASE}/app/hidden`, {
        headers: { Authorization: 'Bearer ld-key', 'X-Community-App': 'livediagram.app' },
      }),
      unset.env,
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('publish a post, normalising its input, then edit it', async () => {
    const { res, post } = await publish();
    expect(res.status).toBe(201);
    expect(post).toMatchObject({
      title: 'Payments platform',
      tags: ['aws', 'event-driven'],
      state: 'listed',
      own: true,
      shareCode: 'CODE1',
      author: { name: 'Ada' },
    });
    const edited = await publish('d1', {
      input: { ...publishing().input, title: 'Renamed', anonymous: true },
    });
    expect(edited.res.status).toBe(200);
    expect(edited.post).toMatchObject({ id: post!.id, title: 'Renamed', anonymous: true });
    const read = await asApp('/app/documents/d1?owner=user_author');
    expect(((await read.json()) as { post: CommunityAppPost }).post.id).toBe(post!.id);
  });

  it('answer a second first publish as already published, not as an edit', async () => {
    await publish();
    const again = await publish('d1', { create: true, shareCode: 'OTHER' });
    expect(again.res.status).toBe(409);
    expect(await again.res.json()).toEqual({ error: 'already_published' });
    expect(db.sql.prepare('SELECT share_code FROM posts').get()).toEqual({ share_code: 'CODE1' });
  });

  it('refuse a bad input with its field code', async () => {
    const res = await asApp('/app/documents/d1', {
      method: 'PUT',
      ...body(publishing({ input: { ...publishing().input, title: 'x' } })),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_title' });
    const badAuthor = await asApp('/app/documents/d1', {
      method: 'PUT',
      ...body(publishing({ author: { name: 'A', color: 'red', picture: null } })),
    });
    expect(badAuthor.status).toBe(400);
  });

  it("keep a post's author's picture only when it is an https address", async () => {
    const { post } = await publish('d1', {
      author: { name: 'Ada', color: '#f97316', picture: 'javascript:alert(1)' },
    });
    expect(post!.author.picture).toBeNull();
  });

  it('cap an owner at the post limit, per app', async () => {
    for (let i = 0; i < COMMUNITY_POSTS_PER_AUTHOR; i++) {
      expect((await publish(`d${i}`, { shareCode: `C${i}` })).res.status).toBe(201);
    }
    const over = await publish('one-more', { shareCode: 'C-more' });
    expect(over.res.status).toBe(409);
    expect(await over.res.json()).toEqual({ error: 'post_limit' });
  });

  it("replace a previous owner's post when the document's new owner publishes", async () => {
    const first = await publish();
    const read = await asApp('/app/documents/d1?owner=user_heir');
    expect(((await read.json()) as { post: CommunityAppPost }).post.own).toBe(false);
    // The heir can't remove what isn't theirs.
    expect((await asApp('/app/documents/d1?owner=user_heir', { method: 'DELETE' })).status).toBe(
      404,
    );
    const second = await publish('d1', { owner: 'user_heir', shareCode: 'CODE2' });
    expect(second.res.status).toBe(201);
    expect(second.post!.id).not.toBe(first.post!.id);
  });

  it('never edit or remove a post hidden after reports', async () => {
    await publish();
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 5").run();
    const edit = await publish();
    expect(edit.res.status).toBe(409);
    expect(await edit.res.json()).toEqual({ error: 'post_hidden' });
    const remove = await asApp('/app/documents/d1?owner=user_author', { method: 'DELETE' });
    expect(remove.status).toBe(409);
  });

  it('remove a post', async () => {
    await publish();
    expect((await asApp('/app/documents/d1?owner=user_author', { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await asApp('/app/documents/d1?owner=user_author', { method: 'DELETE' })).status).toBe(
      404,
    );
  });

  it('take a sync, and refuse a malformed or oversized one', async () => {
    await publish();
    const ok = await asApp('/app/sync', {
      method: 'POST',
      ...body({ documents: [{ document: 'd1', state: 'closed' }], gone: [] }),
    });
    expect(ok.status).toBe(204);
    expect(db.sql.prepare('SELECT document_state FROM posts').get()).toEqual({
      document_state: 'closed',
    });
    for (const bad of [
      { documents: [{ document: 'd1', state: 'open' }], gone: [] },
      { documents: [], gone: [7] },
      { documents: [], gone: Array.from({ length: 501 }, (_, i) => `d${i}`) },
      null,
    ]) {
      expect((await asApp('/app/sync', { method: 'POST', ...body(bad) })).status).toBe(400);
    }
  });

  it('list My Shares with their totals and the browser hearts, never cached', async () => {
    const { post } = await publish();
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 5").run();
    db.sql
      .prepare(
        "INSERT INTO likes (post_id, liker_key, network_hash, created_at) VALUES (?, ?, 'n', 1)",
      )
      .run(post!.id, KEY);
    const res = await asApp('/app/mine?owner=user_author', { headers: { 'X-Community-Key': KEY } });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const mine = (await res.json()) as CommunityMineResponse;
    expect(mine.posts).toMatchObject([
      { id: post!.id, state: 'hidden', documentId: 'd1', liked: true },
    ]);
    expect(mine.totals).toEqual({ posts: 1, likes: 0, copies: 0 });
  });

  it('count copies once per person, and forget or merge copiers', async () => {
    await publish();
    const copy = (copier: string) =>
      asApp('/app/copies', {
        method: 'POST',
        ...body({ document: 'd1', copier, ip: '203.0.113.9' }),
      });
    expect((await copy('h1')).status).toBe(204);
    await copy('h1');
    await copy('h2');
    expect(db.sql.prepare('SELECT copy_count FROM posts').get()).toEqual({ copy_count: 2 });
    await asApp('/app/copiers/merge', { method: 'POST', ...body({ from: 'h1', to: 'h2' }) });
    expect(db.sql.prepare('SELECT copy_count FROM posts').get()).toEqual({ copy_count: 1 });
    await asApp('/app/copiers/forget', { method: 'POST', ...body({ copier: 'h2' }) });
    expect(db.sql.prepare('SELECT copy_count FROM posts').get()).toEqual({ copy_count: 0 });
    expect(
      (
        await asApp('/app/copies', {
          method: 'POST',
          ...body({ document: 'nope', copier: 'h', ip: '1.2.3.4' }),
        })
      ).status,
    ).toBe(404);
  });

  it('hand an app the posts hidden after reports, and nothing of another app', async () => {
    await publish();
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 77").run();
    const res = await asApp('/app/hidden?since=0');
    expect(await res.json()).toEqual({ hidden: [{ document: 'd1', hiddenAt: 77 }] });
    const other = await asApp('/app/hidden?since=0', {}, 'liveplanner.app', 'lp-key');
    expect(await other.json()).toEqual({ hidden: [] });
  });
});

describe('the public routes', () => {
  it('need an app, and answer only its posts', async () => {
    const { post } = await publish();
    expect((await call('/posts')).status).toBe(400);
    const list = (await (await call('/posts?app=livediagram.app')).json()) as CommunityListResponse;
    expect(list.posts.map((p) => p.id)).toEqual([post!.id]);
    expect(JSON.stringify(list)).not.toContain('user_author');
    expect(JSON.stringify(list)).not.toContain('"d1"');
    const other = (await (
      await call('/posts?app=liveplanner.app')
    ).json()) as CommunityListResponse;
    expect(other.posts).toEqual([]);
    expect((await call(`/posts/${post!.id}?app=liveplanner.app`)).status).toBe(404);
    const one = (await (
      await call(`/posts/${post!.id}?app=livediagram.app`)
    ).json()) as CommunityPostResponse;
    expect(one.post.title).toBe('Payments platform');
  });

  it('let any page read, cacheable without a key and private with one', async () => {
    await publish();
    const anon = await call('/posts?app=livediagram.app', {
      headers: { Origin: 'https://x.example' },
    });
    expect(anon.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(anon.headers.get('Cache-Control')).toBe('public, max-age=30');
    const keyed = await call('/posts?app=livediagram.app', { headers: fromPage() });
    expect(keyed.headers.get('Cache-Control')).toBe('private, no-store');
    for (const path of ['/facets', '/featured', '/sitemap']) {
      const res = await call(`${path}?app=livediagram.app`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+$/);
    }
  });

  it("let only an app's own pages like, unlike and report", async () => {
    const { post } = await publish();
    const like = (headers: Record<string, string>, method = 'PUT') =>
      call(`/posts/${post!.id}/like?app=livediagram.app`, { method, headers });
    const liked = await like(fromPage());
    expect(await liked.json()).toEqual({ likeCount: 1, liked: true });
    expect(liked.headers.get('Access-Control-Allow-Origin')).toBe('https://livediagram.app');
    // Another site's page: the like is answered, but the browser never lets that page read it, and the
    // preflight a real cross-site call needs refuses it first.
    const elsewhere = await like(fromPage('https://evil.example'));
    expect(elsewhere.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const pre = await call(`/posts/${post!.id}/like?app=livediagram.app`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const ok = await call(`/posts/${post!.id}/like?app=livediagram.app`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://livediagram.app' },
    });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://livediagram.app');
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('X-Community-Key');
    // The same browser key from the other page changed nothing, so unliking leaves none.
    expect(await (await like(fromPage(), 'DELETE')).json()).toEqual({ likeCount: 0, liked: false });
    expect((await like({ Origin: 'https://livediagram.app' })).status).toBe(400);
  });

  it('hide a post after three reports from distinct browsers and networks', async () => {
    const { post } = await publish();
    const report = (key: string, ip: string, payload: unknown = { reason: 'spam' }) =>
      call(`/posts/${post!.id}/report?app=livediagram.app`, {
        method: 'POST',
        headers: { ...fromPage('https://livediagram.app', key), 'CF-Connecting-IP': ip },
        body: JSON.stringify(payload),
      });
    expect((await report(KEY, '203.0.113.1', { reason: 'nope' })).status).toBe(400);
    expect((await report(KEY, '203.0.113.1', { reason: 'spam', note: 7 })).status).toBe(400);
    expect((await report(KEY, '203.0.113.1', null)).status).toBe(400);
    expect((await report(KEY, '203.0.113.1')).status).toBe(204);
    expect((await report(KEY2, '198.51.100.1')).status).toBe(204);
    expect((await call(`/posts/${post!.id}?app=livediagram.app`)).status).toBe(200);
    expect((await report(KEY3, '192.0.2.1')).status).toBe(204);
    expect((await call(`/posts/${post!.id}?app=livediagram.app`)).status).toBe(404);
  });

  it('turn away likes past the network budget', async () => {
    const { post } = await publish();
    const limited = testDb({
      COMMUNITY_RATE_LIMITER: { limit: async () => ({ success: false }) },
    });
    const res = await worker.fetch(
      new Request(`${BASE}/posts/${post!.id}/like?app=livediagram.app`, {
        method: 'PUT',
        headers: fromPage(),
      }),
      limited.env,
      ctx,
    );
    expect(res.status).toBe(429);
  });

  it('answer every route as missing while the service is off', async () => {
    const off = testDb({ COMMUNITY_ENABLED: 'false' });
    for (const path of ['/posts?app=livediagram.app', '/featured?app=livediagram.app']) {
      expect((await call(path, {}, off.env)).status).toBe(404);
    }
    const app = await worker.fetch(
      new Request(`${BASE}/app/hidden`, {
        headers: { Authorization: 'Bearer ld-key', 'X-Community-App': 'livediagram.app' },
      }),
      off.env,
      ctx,
    );
    expect(app.status).toBe(404);
  });

  it('answer nothing outside its API: liveworkspace.app hosts no Community pages', async () => {
    for (const path of ['/community', '/community/post/', '/api/communityx']) {
      const res = await worker.fetch(new Request(`https://liveworkspace-gateway.liveworkspace-easing509.workers.dev${path}`), db.env, ctx);
      expect(res.status).toBe(404);
    }
  });
});
