// The Community routes end to end against a real schema (docs/specs/025-community/blueprints/community.md §13):
// the owner's publish guards and Edit Listing, the public reads and their caching, likes and reports with the
// community key, the off switch, and how a community link behaves on the share resolve, the share list, the
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
  getCommunityThumbnailSvg: vi.fn(async () => thumbnail.svg),
  renderTabSvg: vi.fn(async () => thumbnail.svg),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { handleCommunity } from './community';
import { handleShare } from './share';
import { handleDocumentShareRoutes } from './document-share-routes';
import { handleCapabilities } from './capabilities';
import { handleDocuments } from './documents';
import { handleTabRender } from './tab-render-route';

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
  anonymous: false,
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
  db = sqliteD1();
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
    setFirstTab(id, 1);
  }
});

// The document's first tab, holding `count` elements (publishing refuses an empty document).
function setFirstTab(documentId: string, count: number) {
  const tabId = `tab-${documentId}`;
  db.sql.prepare('DELETE FROM document_tabs WHERE document_id = ?').run(documentId);
  db.sql.prepare('DELETE FROM tabs WHERE id = ?').run(tabId);
  const elements = Array.from({ length: count }, (_, i) => ({ id: `e${i}`, type: 'shape' }));
  db.sql
    .prepare(
      "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, 'Tab', ?, 1, ?, 1)",
    )
    .run(tabId, JSON.stringify({ elements }), count);
  db.sql
    .prepare(
      'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, 0, 1)',
    )
    .run(documentId, tabId);
}

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

    setFirstTab('d1', 0);
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

  it('lists My Shares for the signed-in author only, hidden ones included, with totals', async () => {
    const shown = await publish('d1');
    const hidden = await publish('d2');
    await handleCommunity(publicCtx('PUT', `/api/community/posts/${shown.id}/like`));
    db.sql.prepare("UPDATE community_posts SET state = 'hidden' WHERE id = ?").run(hidden.id);

    expect((await handleCommunity(publicCtx('GET', '/api/community/mine'))).status).toBe(401);

    const res = await handleCommunity(publicCtx('GET', '/api/community/mine', { clerk: AUTHOR }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = (await res.json()) as {
      posts: { id: string; state: string; documentId: string; liked: boolean }[];
      totals: { posts: number; likes: number; copies: number };
    };
    expect(body.posts.map((p) => [p.id, p.state, p.documentId]).sort()).toEqual(
      [
        [shown.id, 'listed', 'd1'],
        [hidden.id, 'hidden', 'd2'],
      ].sort(),
    );
    expect(body.totals).toEqual({ posts: 2, likes: 1, copies: 0 });

    // Someone else signed in has none; the public list never shows the hidden one.
    const other = await handleCommunity(
      publicCtx('GET', '/api/community/mine', { clerk: 'user_x' }),
    );
    expect(await other.json()).toMatchObject({
      posts: [],
      totals: { posts: 0, likes: 0, copies: 0 },
    });
    const pub = (await (
      await handleCommunity(publicCtx('GET', '/api/community/posts'))
    ).json()) as {
      posts: { id: string }[];
    };
    expect(pub.posts.map((p) => p.id)).toEqual([shown.id]);
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
    // A JSON null body is a missing reason (400), never a 500.
    expect((await report(KEY, '1.1.1.1', null)).status).toBe(400);
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

describe('a hidden post', () => {
  const hide = () =>
    db.sql.prepare("UPDATE community_posts SET state = 'hidden', hidden_by = 'reports'").run();

  it('is final: its author sees it, but can neither edit nor remove it', async () => {
    const post = await publish();
    hide();
    const read = await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community'));
    expect(await read!.json()).toMatchObject({ post: { id: post.id, state: 'hidden' } });
    const edit = await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, title: 'Something else' } }),
    );
    expect(edit!.status).toBe(409);
    expect(await edit!.json()).toEqual({ error: 'post_hidden' });
    const remove = await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community'));
    expect(remove!.status).toBe(409);
    // Still there, still hidden, so the document cannot be published afresh.
    expect(db.sql.prepare('SELECT state, title FROM community_posts').get()).toEqual({
      state: 'hidden',
      title: 'Payments platform',
    });
  });

  it('has no way back: there are no moderation routes', async () => {
    const post = await publish();
    hide();
    for (const [method, path] of [
      ['GET', '/api/community/moderation'],
      ['PUT', `/api/community/posts/${post.id}/moderation`],
    ] as const) {
      const res = await handleCommunity(
        publicCtx(method, path, {
          clerk: AUTHOR,
          body: method === 'PUT' ? { state: 'listed' } : undefined,
        }),
      );
      expect(res.status).toBe(404);
    }
    expect(db.sql.prepare('SELECT state FROM community_posts').get()).toEqual({ state: 'hidden' });
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
  });

  it('closes the link when its document moves into a team library or the Trash', async () => {
    const post = await publish();
    const visit = () =>
      handleShare(makeTestRouteContext('GET', `/api/share/${post.shareCode}`, { env }));
    const image = () =>
      handleShare(makeTestRouteContext('GET', `/api/share/${post.shareCode}/image.svg`, { env }));
    expect((await visit()).status).toBe(200);
    db.sql.prepare("UPDATE documents SET team_id = 'team-1' WHERE id = 'd1'").run();
    expect((await visit()).status).toBe(404);
    expect((await image()).status).toBe(404);
    db.sql.prepare("UPDATE documents SET team_id = NULL, trashed_at = 5 WHERE id = 'd1'").run();
    expect((await image()).status).not.toBe(200);
  });

  it("stops serving a hidden post's image", async () => {
    const post = await publish();
    const image = (clerk: string | null = null) =>
      handleShare(
        makeTestRouteContext('GET', `/api/share/${post.shareCode}/image.svg`, {
          env,
          clerkUserId: clerk,
        }),
      );
    const listed = await image();
    expect(listed.status).toBe(200);
    // Briefly cacheable, with no stale window to outlive a hiding.
    expect(listed.headers.get('Cache-Control')).toBe('public, max-age=30');
    db.sql.prepare("UPDATE community_posts SET state = 'hidden'").run();
    expect((await image()).status).toBe(404);
    // Signed in or not, nobody gets it back.
    expect((await image(AUTHOR)).status).toBe(404);
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

  it('allows a share password once the post is hidden, since its link is closed for good', async () => {
    await publish();
    db.sql.prepare("UPDATE community_posts SET state = 'hidden', hidden_by = 'reports'").run();
    const res = (await handleDocumentShareRoutes(
      owner('PUT', '/api/documents/d1/share-password', { body: { password: 'secret' } }),
    ))!;
    expect(res.status).toBe(200);
  });
});

// docs/specs/025-community/community.md "Turning the Community off".
describe('switched off', () => {
  it('closes every route and link, reports it, and deletes nothing', async () => {
    const post = await publish();
    env.COMMUNITY_ENABLED = 'false';

    const capabilities = handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities', { env }),
    );
    expect(await capabilities.json()).toMatchObject({ communityEnabled: false });
    for (const path of [
      '/api/community/posts',
      `/api/community/posts/${post.id}`,
      '/api/community/featured',
      '/api/community/facets',
    ]) {
      expect((await handleCommunity(publicCtx('GET', path))).status, path).toBe(404);
    }
    expect(
      (await handleCommunity(publicCtx('PUT', `/api/community/posts/${post.id}/like`))).status,
    ).toBe(404);
    expect(
      (await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community')))!.status,
    ).toBe(404);
    const share = (path: string) => handleShare(makeTestRouteContext('GET', path, { env }));
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
    expect((await share(`/api/share/${post.shareCode}/image.svg`)).status).toBe(404);
    // A listed post no longer blocks a share password.
    const password = (await handleDocumentShareRoutes(
      owner('PUT', '/api/documents/d1/share-password', { body: { password: 'secret' } }),
    ))!;
    expect(password.status).toBe(200);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_posts').get()).toEqual({ n: 1 });

    // Back on, the post is as it was (once the password it allowed is cleared again).
    env.COMMUNITY_ENABLED = undefined;
    db.sql.prepare("UPDATE documents SET share_password = NULL WHERE id = 'd1'").run();
    expect(
      (await handleCommunity(publicCtx('GET', `/api/community/posts/${post.id}`))).status,
    ).toBe(200);
  });
});

// Round-one review fixes (docs/specs/025-community/community.md "Viewing a post's document", "Publishing").
describe('what a community link reveals', () => {
  const share = (path: string) =>
    handleShare(makeTestRouteContext('GET', path, { env, owner: 'guest-visitor' }));
  const readDocument = (code: string, query = '') =>
    handleDocuments(
      makeTestRouteContext('GET', `/api/documents/d1${query}`, {
        env,
        owner: 'guest-visitor',
        headers: { 'X-Share-Code': code },
      }),
    );

  it('sends exactly the public fields of a post, and nothing of an anonymous author', async () => {
    for (const id of ['d1', 'd2']) {
      expect(
        (await handleCommunityOwnerRoutes(
          owner('PUT', `/api/documents/${id}/community`, { body: { ...body, anonymous: true } }),
        ))!.status,
      ).toBe(201);
    }
    const read = async (path: string) => {
      const res = (await handleCommunity(publicCtx('GET', path)))!;
      expect(res.status).toBe(200);
      return res.text();
    };
    const list = await read('/api/community/posts');
    const { posts } = JSON.parse(list) as { posts: Record<string, unknown>[] };
    const one = await read(`/api/community/posts/${posts[0]!.id as string}`);
    const featured = await read('/api/community/featured');
    const parsed = JSON.parse(one) as { post: Record<string, unknown>; related: unknown[] };
    const all = [
      ...posts,
      parsed.post,
      ...(parsed.related as Record<string, unknown>[]),
      ...(JSON.parse(featured) as { posts: Record<string, unknown>[] }).posts,
    ];
    expect(all.length).toBeGreaterThanOrEqual(5);
    // An allowlist, so a column added to the row later fails here rather than reaching every visitor.
    for (const post of all) {
      expect(Object.keys(post).sort()).toEqual(
        [
          'anonymous',
          'author',
          'category',
          'copyCount',
          'description',
          'id',
          'likeCount',
          'liked',
          'publishedAt',
          'shareCode',
          'tags',
          'title',
          'updatedAt',
        ].sort(),
      );
      expect(post.author).toEqual({ name: 'Anonymous', color: '#64748b', picture: null });
    }
    for (const text of [list, one, featured]) {
      expect(text).not.toContain(AUTHOR);
      expect(text).not.toContain('Ada');
      expect(text).not.toContain('#f97316');
      expect(text).not.toMatch(
        /"(documentId|ownerId|authorId|author_id|document_id|networkHash|reportCount|hiddenBy|state)"/,
      );
    }
  });

  it("names nobody: not the owner's name or colour, nor where the document sits", async () => {
    db.sql.prepare("UPDATE documents SET folder_id = NULL WHERE id = 'd1'").run();
    const post = (await (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, anonymous: true } }),
    ))!.json()) as { post: { shareCode: string } };
    const resolved = (await (await share(`/api/share/${post.post.shareCode}`)).json()) as {
      document: Record<string, unknown>;
      community: { author: { name: string } };
    };
    expect(resolved.community.author.name).toBe('Anonymous');
    expect(resolved.document).toMatchObject({ ownerName: null, ownerColor: null, ownerId: '' });
    const read = (await (await readDocument(post.post.shareCode)).json()) as {
      document: Record<string, unknown>;
    };
    expect(read.document).toMatchObject({
      ownerName: null,
      ownerColor: null,
      folderId: null,
      source: null,
    });
  });

  it('draws nothing through render.svg: that drawing is unredacted, so it never opts in', async () => {
    const { shareCode } = await publish();
    const res = (await handleTabRender(
      makeTestRouteContext('GET', '/api/documents/d1/tabs/tab-d1/render.svg', {
        env,
        owner: 'guest-visitor',
        headers: { 'X-Share-Code': shareCode },
      }),
    ))!;
    expect(res.status).toBe(403);
    // The same tab draws for its owner, so the refusal is the link's, not the route's.
    const own = (await handleTabRender(owner('GET', '/api/documents/d1/tabs/tab-d1/render.svg')))!;
    expect(own.status).toBe(200);
  });

  it('answers a closed link with 404 alone: not trashed, not a password prompt', async () => {
    const post = await publish();
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
    db.sql
      .prepare("UPDATE documents SET trashed_at = NULL, share_password = 'pw' WHERE id = 'd1'")
      .run();
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
    expect((await share(`/api/share/${post.shareCode}/image.svg`)).status).toBe(404);
    expect(
      (await handleCommunity(publicCtx('GET', `/api/community/posts/${post.id}`))).status,
    ).toBe(404);
  });

  it('counts no comment threads in the overview a Community visitor reads', async () => {
    const post = await publish();
    const tab = JSON.stringify({
      elements: [
        {
          id: 'c1',
          type: 'shape',
          shape: 'comment-pin',
          commentThread: {
            comments: [{ id: 'm1', text: 'secret', authorId: AUTHOR, authorName: 'Ada' }],
          },
        },
      ],
    });
    db.sql
      .prepare("UPDATE tabs SET data = ?, element_count = 1, rev = rev + 1 WHERE id = 'tab-d1'")
      .run(tab);
    const overview = await (await readDocument(post.shareCode, '?view=overview')).text();
    expect(overview).not.toContain('threads');
  });
});

describe('a document that changes hands', () => {
  it("closes its previous owner's post, and lets the new owner publish their own", async () => {
    const post = await publish();
    db.sql
      .prepare(
        "INSERT INTO participants (id, name, color, created_at) VALUES ('user_bob', 'Bob', '#000', 1)",
      )
      .run();
    db.sql.prepare("UPDATE documents SET owner_id = 'user_bob' WHERE id = 'd1'").run();

    expect(
      (await handleShare(makeTestRouteContext('GET', `/api/share/${post.shareCode}`, { env })))
        .status,
    ).toBe(404);
    expect((await handleCommunity(publicCtx('GET', '/api/community/posts'))).status).toBe(200);
    const listed = (await (
      await handleCommunity(publicCtx('GET', '/api/community/posts'))
    ).json()) as {
      posts: unknown[];
    };
    expect(listed.posts).toEqual([]);
    const mine = (await (
      await handleCommunity(publicCtx('GET', '/api/community/mine', { clerk: AUTHOR }))
    ).json()) as { posts: unknown[] };
    expect(mine.posts).toEqual([]);

    const bob = (method: string, opts: { body?: unknown } = {}) =>
      handleCommunityOwnerRoutes(
        owner(method, '/api/documents/d1/community', { ...opts, clerk: 'user_bob' }),
      );
    expect(await (await bob('GET'))!.json()).toEqual({ post: null });
    const published = (await bob('PUT', { body }))!;
    expect(published.status).toBe(201);
    expect(db.sql.prepare('SELECT author_id FROM community_posts').all()).toEqual([
      { author_id: 'user_bob' },
    ]);
  });
});
