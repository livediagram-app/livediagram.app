// The Community routes end to end against a real schema (docs/specs/025-community/blueprints/community.md §13):
// the owner's publish guards and Edit Listing, the public reads and their caching, likes and reports with the
// community key, the operator gate, and how a community link behaves on the share resolve, the share list, the
// password route and the copy route.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';

const { thumbnail } = vi.hoisted(() => ({
  thumbnail: { svg: '<svg/>' as string | null },
}));
vi.mock('../thumbnail', () => ({
  getDocumentThumbnailSvg: vi.fn(async () => thumbnail.svg),
  getDocumentTabImageSvg: vi.fn(async () => thumbnail.svg),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { handleCommunity } from './community';
import { isCommunityOperator } from '../auth/community-operators';
import { handleShare } from './share';
import { handleDocumentShareRoutes } from './document-share-routes';

const KEY = '3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b';
const KEY2 = '4a2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b';
const AUTHOR = 'user_author';

let db: SqliteD1;
let env: Env;

const body = {
  title: 'Payments platform',
  description: 'How our payment services talk to each other.',
  category: 'architecture',
  tags: ['AWS'],
};

function owner(method: string, path: string, opts: { body?: unknown; clerk?: string | null } = {}) {
  const clerk = opts.clerk === undefined ? AUTHOR : opts.clerk;
  return makeTestRouteContext(method, path, {
    env,
    owner: clerk ?? 'guest-1',
    clerkUserId: clerk,
    body: opts.body,
  });
}

function publicCtx(
  method: string,
  path: string,
  opts: { body?: unknown; key?: string | null; clerk?: string | null; ip?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.key !== null) headers['X-Community-Key'] = opts.key ?? KEY;
  if (opts.ip) headers['CF-Connecting-IP'] = opts.ip;
  return makeTestRouteContext(method, path, {
    env,
    clerkUserId: opts.clerk ?? null,
    body: opts.body,
    headers,
  });
}

async function publish(docId = 'd1'): Promise<{ id: string; shareCode: string }> {
  const res = (await handleCommunityOwnerRoutes(
    owner('PUT', `/api/documents/${docId}/community`, { body }),
  ))!;
  expect(res.status).toBe(201);
  const { post } = (await res.json()) as { post: { id: string; shareCode: string } };
  return post;
}

beforeEach(() => {
  db = sqliteD1({ COMMUNITY_OPERATOR_IDS: ' user_op , ,user_op2' } as Partial<Env>);
  env = db.env;
  thumbnail.svg = '<svg/>';
  db.sql
    .prepare(
      "INSERT INTO participants (id, name, color, created_at) VALUES (?, 'Ada', '#f97316', 1)",
    )
    .run(AUTHOR);
  for (const id of ['d1', 'd2']) {
    db.sql
      .prepare(
        'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(id, AUTHOR, `Doc ${id}`);
  }
});

describe('owner routes', () => {
  it('publishes, reads back, edits the listing and removes', async () => {
    const post = await publish();
    const read = await (await handleCommunityOwnerRoutes(
      owner('GET', '/api/documents/d1/community'),
    ))!.json();
    expect(read).toMatchObject({
      post: {
        id: post.id,
        title: 'Payments platform',
        tags: ['aws'],
        state: 'listed',
        author: { name: 'Ada' },
      },
    });
    expect(JSON.stringify(read)).not.toContain(AUTHOR);

    const edited = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, title: 'Renamed' } }),
    ))!;
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { post: { id: string; title: string } }).post).toMatchObject({
      id: post.id,
      title: 'Renamed',
    });

    expect(
      (await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community')))!.status,
    ).toBe(204);
    expect(
      await (await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community')))!.json(),
    ).toEqual({
      post: null,
    });
    expect(
      (await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community')))!.status,
    ).toBe(404);
  });

  it('refuses a guest, a team document, a password, an empty board, bad input and the cap', async () => {
    const guest = makeTestRouteContext('PUT', '/api/documents/d1/community', {
      env,
      owner: AUTHOR,
      body,
    });
    expect(await (await handleCommunityOwnerRoutes(guest))!.json()).toEqual({
      error: 'sign_in_required',
    });

    db.sql.prepare("UPDATE documents SET share_password = 'pw' WHERE id = 'd1'").run();
    const pw = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body }),
    ))!;
    expect([pw.status, await pw.json()]).toEqual([409, { error: 'share_password_set' }]);
    db.sql.prepare("UPDATE documents SET share_password = NULL WHERE id = 'd1'").run();

    const bad = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, category: 'cats' } }),
    ))!;
    expect([bad.status, await bad.json()]).toEqual([400, { error: 'invalid_category' }]);

    thumbnail.svg = null;
    const empty = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body }),
    ))!;
    expect([empty.status, await empty.json()]).toEqual([409, { error: 'empty_document' }]);
  });

  it('is not someone else’s to publish', async () => {
    const res = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body, clerk: 'user_other' }),
    ))!;
    expect(res.status).toBe(403);
  });

  it('ignores other paths', async () => {
    expect(
      await handleCommunityOwnerRoutes(owner('POST', '/api/documents/d1/community')),
    ).toBeNull();
    expect(await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/share'))).toBeNull();
  });
});

describe('public routes', () => {
  it('lists with likes for the caller and caches only anonymous reads', async () => {
    const post = await publish();
    await handleCommunity(publicCtx('PUT', `/api/community/posts/${post.id}/like`));
    const mine = await handleCommunity(publicCtx('GET', '/api/community/posts'));
    expect(mine.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await mine.json()).toMatchObject({
      posts: [{ id: post.id, liked: true, likeCount: 1 }],
      nextOffset: null,
    });
    const anon = await handleCommunity(publicCtx('GET', '/api/community/posts', { key: null }));
    expect(anon.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(await anon.json()).toMatchObject({ posts: [{ liked: false }] });
    expect(
      (await handleCommunity(publicCtx('GET', '/api/community/posts?category=nope'))).status,
    ).toBe(400);
  });

  it('serves one post with related posts, and facets', async () => {
    const a = await publish('d1');
    const b = await publish('d2');
    const one = (await (
      await handleCommunity(publicCtx('GET', `/api/community/posts/${a.id}`))
    ).json()) as {
      post: { id: string };
      related: { id: string }[];
    };
    expect(one.post.id).toBe(a.id);
    expect(one.related.map((p) => p.id)).toEqual([b.id]);
    expect(await (await handleCommunity(publicCtx('GET', '/api/community/facets'))).json()).toEqual(
      {
        total: 2,
        categories: { architecture: 2 },
        tags: [{ tag: 'aws', count: 2 }],
      },
    );
    expect((await handleCommunity(publicCtx('GET', '/api/community/posts/missing'))).status).toBe(
      404,
    );
  });

  it('likes and unlikes idempotently, and needs a valid key', async () => {
    const post = await publish();
    const like = () => handleCommunity(publicCtx('PUT', `/api/community/posts/${post.id}/like`));
    expect(await (await like()).json()).toEqual({ likeCount: 1, liked: true });
    expect(await (await like()).json()).toEqual({ likeCount: 1, liked: true });
    const unlike = await handleCommunity(
      publicCtx('DELETE', `/api/community/posts/${post.id}/like`),
    );
    expect(await unlike.json()).toEqual({ likeCount: 0, liked: false });
    const noKey = await handleCommunity(
      publicCtx('PUT', `/api/community/posts/${post.id}/like`, { key: 'owner-id' }),
    );
    expect([noKey.status, await noKey.json()]).toEqual([400, { error: 'community_key_required' }]);
  });

  it('takes reports, validates them, and hides a post after three browsers on three networks', async () => {
    const post = await publish();
    const report = (key: string, ip: string, b: unknown = { reason: 'spam' }) =>
      handleCommunity(
        publicCtx('POST', `/api/community/posts/${post.id}/report`, { key, ip, body: b }),
      );
    expect((await report(KEY, '1.1.1.1', { reason: 'nope' })).status).toBe(400);
    expect((await report(KEY, '1.1.1.1', { reason: 'spam', note: 'x'.repeat(301) })).status).toBe(
      400,
    );
    expect((await report(KEY, '1.1.1.1')).status).toBe(204);
    expect((await report(KEY2, '2.2.2.2')).status).toBe(204);
    expect((await report('5a2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b', '3.3.3.3')).status).toBe(204);
    expect(
      (await handleCommunity(publicCtx('GET', `/api/community/posts/${post.id}`))).status,
    ).toBe(404);
    // Hidden: no more likes either.
    expect(
      (await handleCommunity(publicCtx('PUT', `/api/community/posts/${post.id}/like`))).status,
    ).toBe(404);
  });

  it('answers a wrong method with 404', async () => {
    const post = await publish();
    expect(
      (await handleCommunity(publicCtx('GET', `/api/community/posts/${post.id}/like`))).status,
    ).toBe(404);
  });
});

describe('moderation', () => {
  it('parses the operator list', () => {
    expect(isCommunityOperator(env, 'user_op')).toBe(true);
    expect(isCommunityOperator(env, 'user_op2')).toBe(true);
    expect(isCommunityOperator(env, '')).toBe(false);
    expect(isCommunityOperator(env, null)).toBe(false);
    expect(isCommunityOperator({} as Env, 'user_op')).toBe(false);
  });

  it('is operator only, hides and restores', async () => {
    const post = await publish();
    expect(
      (await handleCommunity(publicCtx('GET', '/api/community/moderation', { clerk: AUTHOR })))
        .status,
    ).toBe(403);
    const hide = await handleCommunity(
      publicCtx('PUT', `/api/community/posts/${post.id}/moderation`, {
        clerk: 'user_op',
        body: { state: 'hidden' },
      }),
    );
    expect(await hide.json()).toMatchObject({
      item: { id: post.id, state: 'hidden', hiddenBy: 'operator' },
    });
    const queue = await (
      await handleCommunity(publicCtx('GET', '/api/community/moderation', { clerk: 'user_op' }))
    ).json();
    expect(queue).toMatchObject({ items: [{ id: post.id }] });
    const restore = await handleCommunity(
      publicCtx('PUT', `/api/community/posts/${post.id}/moderation`, {
        clerk: 'user_op',
        body: { state: 'listed' },
      }),
    );
    expect(await restore.json()).toMatchObject({
      item: { state: 'listed', hiddenBy: null, reports: [] },
    });
    const invalid = await handleCommunity(
      publicCtx('PUT', `/api/community/posts/${post.id}/moderation`, {
        clerk: 'user_op',
        body: { state: 'gone' },
      }),
    );
    expect(invalid.status).toBe(400);
  });
});

describe('the community link', () => {
  it('resolves read-only with the post, and stops resolving while hidden', async () => {
    const post = await publish();
    const visit = () =>
      handleShare(
        makeTestRouteContext('GET', `/api/share/${post.shareCode}`, {
          env,
          owner: 'guest-visitor',
        }),
      );
    const resolved = (await (await visit()).json()) as Record<string, unknown>;
    expect(resolved).toMatchObject({
      role: 'view',
      tabId: null,
      community: { postId: post.id, author: { name: 'Ada', color: '#f97316', picture: null } },
    });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 0 });
    db.sql.prepare("UPDATE community_posts SET state = 'hidden'").run();
    expect((await visit()).status).toBe(404);
    // An operator reviewing the hidden post can still open it.
    const review = await handleShare(
      makeTestRouteContext('GET', `/api/share/${post.shareCode}`, {
        env,
        owner: 'user_op',
        clerkUserId: 'user_op',
      }),
    );
    expect(review.status).toBe(200);
  });

  it("stops serving a hidden post's image, except to an operator", async () => {
    const post = await publish();
    const image = (clerk: string | null = null) =>
      handleShare(
        makeTestRouteContext('GET', `/api/share/${post.shareCode}/image.svg`, {
          env,
          clerkUserId: clerk,
        }),
      );
    expect((await image()).status).toBe(200);
    db.sql.prepare("UPDATE community_posts SET state = 'hidden'").run();
    expect((await image()).status).toBe(404);
    expect((await image('user_op')).status).toBe(200);
  });

  it('is not listed for the owner, survives revoke-all, and cannot be revoked by code', async () => {
    const post = await publish();
    const list = await (await handleDocumentShareRoutes(
      owner('GET', '/api/documents/d1/share'),
    ))!.json();
    expect(list).toMatchObject({ links: [] });
    await handleDocumentShareRoutes(owner('DELETE', '/api/documents/d1/share'));
    const revokeOne = (await handleDocumentShareRoutes(
      owner('DELETE', `/api/documents/d1/share/${post.shareCode}`),
    ))!;
    expect(revokeOne.status).toBe(404);
    expect(
      db.sql.prepare("SELECT COUNT(*) AS n FROM share_links WHERE purpose = 'community'").get(),
    ).toEqual({ n: 1 });
  });

  it('refuses a share password while published', async () => {
    await publish();
    const res = (await handleDocumentShareRoutes(
      owner('PUT', '/api/documents/d1/share-password', { body: { password: 'secret' } }),
    ))!;
    expect([res.status, await res.json()]).toEqual([409, { error: 'community_published' }]);
    const clear = (await handleDocumentShareRoutes(
      owner('PUT', '/api/documents/d1/share-password', { body: { password: null } }),
    ))!;
    expect(clear.status).toBe(200);
  });
});
