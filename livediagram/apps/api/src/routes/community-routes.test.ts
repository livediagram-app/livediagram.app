// The Community end to end, this api and the liveworkspace Community service both real (docs/specs/025-community/
// community.md; liveworkspace/docs/community.md): the owner's publish guards and Edit Listing, My Shares, the sync
// that keeps the service in step with the documents, the off switch, and how a community link behaves on the share
// resolve, the share list, the password route and the copy route. The service's own rules (lists, likes, reports,
// caching) are tested with the service.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncCommunity } from '../community-service';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { communityServiceFor, type TestCommunityService } from '../test-community-service';
import type { Env } from '../types';

const { thumbnail } = vi.hoisted(() => ({
  thumbnail: { svg: '<svg/>' },
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
const AUTHOR = 'user_author';

let db: SqliteD1;
let env: Env;
let service: TestCommunityService;

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
    accountUserId: clerk,
    body: opts.body,
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

// What a page sees in the gallery: the ids of the listed posts.
async function gallery(): Promise<string[]> {
  const res = await service.read('/posts');
  const body: { posts: { id: string }[] } = await res.json();
  return body.posts.map((p) => p.id);
}

// Reports hide a post on the service; the sync closes its link here.
async function hideOnService(postId: string) {
  service.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 77 WHERE id = ?").run(postId);
  await syncCommunity(env);
}

beforeEach(() => {
  db = sqliteD1();
  env = db.env;
  service = communityServiceFor(env);
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

afterEach(() => vi.unstubAllGlobals());

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
    expect(await gallery()).toEqual([post.id]);
    const read = await (await handleCommunityOwnerRoutes(
      owner('GET', '/api/documents/d1/community'),
    ))!.json();
    expect(read).toMatchObject({
      post: {
        id: post.id,
        title: 'Payments platform',
        tags: ['aws'],
        state: 'listed',
        author: { name: 'Ada', color: '#f97316' },
      },
    });
    expect(JSON.stringify(read)).not.toContain(AUTHOR);
    expect(JSON.stringify(read)).not.toContain('"own"');

    const edited = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, title: 'Renamed' } }),
    ))!;
    expect(edited.status).toBe(200);
    expect((await edited.json<{ post: { id: string; title: string } }>()).post).toMatchObject({
      id: post.id,
      title: 'Renamed',
    });
    // The link's doors show the new title too.
    expect(db.sql.prepare('SELECT title FROM community_links').get()).toEqual({ title: 'Renamed' });

    expect(
      (await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community')))!.status,
    ).toBe(204);
    expect(
      await (await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community')))!.json(),
    ).toEqual({ post: null });
    expect(
      (await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community')))!.status,
    ).toBe(404);
    expect(await gallery()).toEqual([]);
    expect(
      db.sql.prepare("SELECT COUNT(*) AS n FROM share_links WHERE purpose = 'community'").get(),
    ).toEqual({ n: 0 });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_links').get()).toEqual({ n: 0 });
  });

  it('refuses a guest, a password, bad input and an empty board, leaving no link behind', async () => {
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
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()).toEqual({ n: 0 });
  });

  it('passes on the per-author cap from the service', async () => {
    service.sql
      .exec(`INSERT INTO posts (id, app, document, share_code, owner, author_name, author_color, title,
      description, category, search_text, published_at, updated_at)
      SELECT 'p' || value, 'livediagram.app', 'x' || value, 'c' || value, '${AUTHOR}', 'Ada', '#000000', 'T', 'D',
             'other', 't', 1, 1
        FROM json_each('[${Array.from({ length: 50 }, (_, i) => i).join(',')}]')`);
    const res = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body }),
    ))!;
    expect([res.status, await res.json()]).toEqual([409, { error: 'post_limit' }]);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()).toEqual({ n: 0 });
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

  it('has no Community without the service key', async () => {
    env.COMMUNITY_KEY = undefined;
    expect(
      (await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community')))!.status,
    ).toBe(404);
  });
});

describe('My Shares', () => {
  it('lists the signed-in author’s posts from the service, hidden ones included, with the browser’s hearts', async () => {
    const shown = await publish('d1');
    const hidden = await publish('d2');
    await service.read(`/posts/${shown.id}/like`, {
      method: 'PUT',
      headers: { 'X-Community-Key': KEY, Origin: 'https://livediagram.app' },
    });
    await hideOnService(hidden.id);

    const mine = (clerk: string | null) =>
      handleCommunity(
        makeTestRouteContext('GET', '/api/community/mine', {
          env,
          accountUserId: clerk,
          headers: { 'X-Community-Key': KEY },
        }),
      );
    expect((await mine(null)).status).toBe(401);
    const res = await mine(AUTHOR);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const result = (await res.json()) as {
      posts: { id: string; state: string; documentId: string; liked: boolean }[];
      totals: { posts: number; likes: number; copies: number };
    };
    expect(result.posts.map((p) => [p.id, p.state, p.documentId, p.liked]).sort()).toEqual(
      [
        [shown.id, 'listed', 'd1', true],
        [hidden.id, 'hidden', 'd2', false],
      ].sort(),
    );
    expect(result.totals).toEqual({ posts: 2, likes: 1, copies: 0 });
    expect(await (await mine('user_x')).json()).toMatchObject({ posts: [] });
  });

  it('is the only Community read this api answers', async () => {
    for (const path of [
      '/api/community/posts',
      '/api/community/featured',
      '/api/community/facets',
    ]) {
      const res = await handleCommunity(makeTestRouteContext('GET', path, { env }));
      expect(res.status, path).toBe(404);
    }
  });
});

describe('keeping in step', () => {
  it('takes a trashed document’s post out of the gallery, and puts it back on restore', async () => {
    const post = await publish();
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    await syncCommunity(env, 'd1');
    expect(await gallery()).toEqual([]);
    db.sql.prepare("UPDATE documents SET trashed_at = NULL WHERE id = 'd1'").run();
    await syncCommunity(env);
    expect(await gallery()).toEqual([post.id]);
  });

  it('closes a post whose document moved into a team library or took a password, keeping it in My Shares', async () => {
    const post = await publish();
    db.sql.prepare("UPDATE documents SET team_id = 'team-1' WHERE id = 'd1'").run();
    await syncCommunity(env);
    expect(await gallery()).toEqual([]);
    expect(service.sql.prepare('SELECT document_state FROM posts').get()).toEqual({
      document_state: 'closed',
    });
    db.sql
      .prepare("UPDATE documents SET team_id = NULL, share_password = 'pw' WHERE id = 'd1'")
      .run();
    await syncCommunity(env);
    expect(await gallery()).toEqual([]);
    db.sql.prepare("UPDATE documents SET share_password = NULL WHERE id = 'd1'").run();
    await syncCommunity(env);
    expect(await gallery()).toEqual([post.id]);
  });

  it('deletes the post of a document deleted for good, and forgets its link', async () => {
    await publish();
    db.sql.prepare("DELETE FROM documents WHERE id = 'd1'").run();
    await syncCommunity(env);
    expect(service.sql.prepare('SELECT COUNT(*) AS n FROM posts').get()).toEqual({ n: 0 });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_links').get()).toEqual({ n: 0 });
  });

  it('sends nothing when nothing changed', async () => {
    await publish();
    const spy = vi.fn(fetch);
    vi.stubGlobal('fetch', spy);
    await syncCommunity(env, 'd1');
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps what failed to send for the next run', async () => {
    await publish();
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    const working = fetch;
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await syncCommunity(env);
    expect(db.sql.prepare('SELECT sent_state FROM community_links').get()).toEqual({
      sent_state: 'public',
    });
    vi.stubGlobal('fetch', working);
    await syncCommunity(env);
    expect(await gallery()).toEqual([]);
    expect(db.sql.prepare('SELECT sent_state FROM community_links').get()).toEqual({
      sent_state: 'away',
    });
  });
});

describe('a hidden post', () => {
  it('is final: its author sees it, but can neither edit nor remove it', async () => {
    const post = await publish();
    await hideOnService(post.id);
    const read = await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community'));
    expect(await read!.json()).toMatchObject({ post: { id: post.id, state: 'hidden' } });
    const edit = await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, title: 'Something else' } }),
    );
    expect(edit!.status).toBe(409);
    expect(await edit!.json()).toEqual({ error: 'post_hidden' });
    const remove = await handleCommunityOwnerRoutes(owner('DELETE', '/api/documents/d1/community'));
    expect(remove!.status).toBe(409);
    expect(service.sql.prepare('SELECT state, title FROM posts').get()).toEqual({
      state: 'hidden',
      title: 'Payments platform',
    });
  });
});

describe('the community link', () => {
  it('resolves read-only with the post, and stops resolving once the sync hears it was hidden', async () => {
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
    await hideOnService(post.id);
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
          accountUserId: clerk,
        }),
      );
    const listed = await image();
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Cache-Control')).toBe('public, max-age=30');
    await hideOnService(post.id);
    expect((await image()).status).toBe(404);
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

  it('refuses a share password while published, and allows one once the post is hidden', async () => {
    const post = await publish();
    const setPassword = async (password: string | null) =>
      (await handleDocumentShareRoutes(
        owner('PUT', '/api/documents/d1/share-password', { body: { password } }),
      ))!;
    const res = await setPassword('secret');
    expect([res.status, await res.json()]).toEqual([409, { error: 'community_published' }]);
    expect((await setPassword(null)).status).toBe(200);
    await hideOnService(post.id);
    expect((await setPassword('secret')).status).toBe(200);
  });

  it('counts a copy taken through it once per person, and names the copy after the post', async () => {
    const post = await publish();
    const copy = () =>
      handleDocuments(
        makeTestRouteContext('POST', '/api/documents/d1/copy', {
          env,
          owner: 'guest-visitor',
          body: {},
          headers: { 'X-Share-Code': post.shareCode },
          waitUntil: (p: Promise<unknown>) => void p,
        }),
      );
    const first = await copy();
    expect(first.status).toBe(201);
    expect((await first.json<{ document: { name: string } }>()).document.name).toBe(
      'Payments platform',
    );
    await copy();
    await vi.waitFor(() =>
      expect(service.sql.prepare('SELECT copy_count FROM posts').get()).toEqual({ copy_count: 1 }),
    );
    // The service never holds the guest's id, which is its credential.
    expect(JSON.stringify(service.sql.prepare('SELECT * FROM copies').all())).not.toContain(
      'guest-visitor',
    );
  });
});

// docs/specs/025-community/community.md "Turning the Community off".
describe('switched off', () => {
  it('closes the owner routes and every link, reports it, and deletes nothing', async () => {
    const post = await publish();
    env.COMMUNITY_ENABLED = 'false';

    const capabilities = handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities', { env }),
    );
    expect(await capabilities.json()).toMatchObject({ communityEnabled: false });
    expect(
      (await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/community')))!.status,
    ).toBe(404);
    const share = (path: string) => handleShare(makeTestRouteContext('GET', path, { env }));
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
    expect((await share(`/api/share/${post.shareCode}/image.svg`)).status).toBe(404);
    const password = (await handleDocumentShareRoutes(
      owner('PUT', '/api/documents/d1/share-password', { body: { password: 'secret' } }),
    ))!;
    expect(password.status).toBe(200);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_links').get()).toEqual({ n: 1 });

    env.COMMUNITY_ENABLED = undefined;
    db.sql.prepare("UPDATE documents SET share_password = NULL WHERE id = 'd1'").run();
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(200);
  });
});

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

  it('sends the service nothing of an anonymous author it would show', async () => {
    const res = (await handleCommunityOwnerRoutes(
      owner('PUT', '/api/documents/d1/community', { body: { ...body, anonymous: true } }),
    ))!;
    expect(res.status).toBe(201);
    const text = await (await service.read('/posts')).text();
    expect(text).not.toContain(AUTHOR);
    expect(text).not.toContain('Ada');
    expect(text).not.toContain('#f97316');
    expect(text).not.toContain('"d1"');
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
        "INSERT INTO participants (id, name, color, created_at) VALUES ('user_bob', 'Bob', '#000000', 1)",
      )
      .run();
    db.sql.prepare("UPDATE documents SET owner_id = 'user_bob' WHERE id = 'd1'").run();
    await syncCommunity(env);

    expect(
      (await handleShare(makeTestRouteContext('GET', `/api/share/${post.shareCode}`, { env })))
        .status,
    ).toBe(404);
    expect(await gallery()).toEqual([]);
    const mine = (await (
      await handleCommunity(
        makeTestRouteContext('GET', '/api/community/mine', { env, accountUserId: AUTHOR }),
      )
    ).json()) as { posts: unknown[] };
    expect(mine.posts).toEqual([]);

    const bob = (method: string, opts: { body?: unknown } = {}) =>
      handleCommunityOwnerRoutes(
        owner(method, '/api/documents/d1/community', { ...opts, clerk: 'user_bob' }),
      );
    expect(await (await bob('GET'))!.json()).toEqual({ post: null });
    const published = (await bob('PUT', { body }))!;
    expect(published.status).toBe(201);
    expect(service.sql.prepare('SELECT owner FROM posts').all()).toEqual([{ owner: 'user_bob' }]);
    expect(db.sql.prepare('SELECT author_id FROM community_links').all()).toEqual([
      { author_id: 'user_bob' },
    ]);
    expect(
      db.sql.prepare("SELECT COUNT(*) AS n FROM share_links WHERE purpose = 'community'").get(),
    ).toEqual({ n: 1 });
  });
});
