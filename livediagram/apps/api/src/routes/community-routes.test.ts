// The Community end to end, this api and the liveworkspace Community service both real (docs/specs/025-community/
// community.md; liveworkspace/docs/specs/007-community/community.md): the owner's publish guards and Edit Listing, My Shares, the canvas's
// check that keeps the service in step with where it stands at the index, the off switch, and how a community link
// behaves on the share resolve, the drawing the canvas gives liveworkspace's previews (its export door) and the
// copy route. The service's own rules (lists, likes, reports,
// caching) are tested with the service; the index's share links, passwords and Trash are the index's, faked here
// over `test_share_links`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type IndexClient } from '@liveworkspace/index-client';
import { documentRoom } from '../document-client';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import type { GrantCaller, ItemGrant } from '../index-service';
import {
  sqliteD1,
  testDocument,
  testIndexFor,
  TEST_GRANT_HOOK,
  type SqliteD1,
  type TestGrantCaller,
} from '../test-sqlite-d1';
import { communityServiceFor, type TestCommunityService } from '../test-community-service';
import type { DocumentEnv, Env } from '../types';

const { thumbnail, index } = vi.hoisted(() => ({
  thumbnail: { svg: '<svg/>' },
  // Where each canvas stands at the index: in the Trash, behind a share password.
  index: {
    trashed: new Set<string>(),
    password: new Set<string>(),
    // Codes made as public links (a post's).
    public: new Set<string>(),
  },
}));
vi.mock('../thumbnail', () => ({
  renderTabSvg: vi.fn(async () => thumbnail.svg),
  drawDocument: vi.fn(async () => thumbnail.svg),
}));
vi.mock('../index-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../index-service')>();
  // The grants a request fetches (a link visitor's, a copy's) as the index would give them (test-sqlite-d1.ts),
  // verified as the index signed them.
  const grants = new Map<string, ItemGrant>();
  const requestGrant = async (
    env: unknown,
    caller: GrantCaller,
    documentId: string,
    share: { code: string } | null,
  ) => {
    const hook = (env as Record<string, unknown>)[TEST_GRANT_HOOK] as (
      id: string,
      who: TestGrantCaller,
    ) => ItemGrant | null;
    const grant = hook(documentId, {
      person: caller.kind === 'delegate' ? caller.personId : null,
      teams: caller.kind === 'delegate' ? caller.teams : [],
      code: share?.code ?? null,
      create: false,
    });
    if (!grant) return { ok: false as const, status: 404, error: 'not_found' };
    grants.set(grant.token, grant);
    return {
      ok: true as const,
      grant: {
        grant: grant.token,
        level: grant.level,
        tabId: grant.tab,
        expiresAt: grant.exp * 1000,
      },
    };
  };
  const verifyGrant = async (_env: unknown, token: string, documentId: string) => {
    const grant = grants.get(token);
    return grant && grant.item === documentId ? grant : null;
  };
  return {
    ...original,
    indexService: { ...original.indexService, requestGrant, verifyGrant },
    indexFor: (env: unknown, caller: GrantCaller) => indexDoors(env, caller),
    requestGrant,
  };
});

import { checkCommunityPost } from '../document-room/community-post';
import { readDocumentMeta } from '../document-room/document-content';
import { answerDocumentRequest, type RouteIdentity } from '../document-room/document-route';
import { makeTestRouteContext } from './test-route-context';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { handleCommunity } from './community';
import { handleShare } from './share';
import { handleCapabilities } from './capabilities';
import { handleDocuments } from './documents';
import { handleTabRender } from './tab-render-route';

const KEY = '3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b';
const AUTHOR = 'user_author';

let accounts: TestAccountsService;
let db: SqliteD1;
let env: Env;
let service: TestCommunityService;

// The index's doors this flow calls, over the test's tables: its share links (made, listed, revoked, resolved,
// refusing a canvas in the Trash or behind a password), the canvas as it stands, and a copy.
function indexDoors(env: unknown, caller: GrantCaller): IndexClient | null {
  const base = testIndexFor(env, caller);
  if (!base) return null;
  const item = (id: string) => {
    const row = db.sql
      .prepare('SELECT owner_id, team_id, name FROM document WHERE id = ?')
      .get(id) as { owner_id: string; team_id: string | null; name: string } | undefined;
    if (!row) throw new IndexError(404, 'not_found');
    return {
      id,
      ownerId: row.owner_id,
      teamId: row.team_id,
      title: row.name,
      trashedAt: index.trashed.has(id) ? 5 : null,
    };
  };
  const doors: Partial<IndexClient> = {
    getItem: async (id) => ({ item: item(id) as never }),
    listShareLinks: async (id) => ({
      links: (
        db.sql.prepare('SELECT code FROM test_share_links WHERE document_id = ?').all(id) as {
          code: string;
        }[]
      ).map((l) => ({ code: l.code }) as never),
      passwordSet: index.password.has(id),
    }),
    createShareLink: async (id, input = {}) => {
      const code = `CODE${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
      db.sql
        .prepare(
          'INSERT INTO test_share_links (code, document_id, role, tab_id, created_at, expires_at) VALUES (?, ?, ?, NULL, 1, NULL)',
        )
        .run(code, id, input.level ?? 'view');
      if (input.public) index.public.add(code);
      return { link: { code, itemId: id, level: input.level ?? 'view', tabId: null } as never };
    },
    revokeShareLink: async (code) => {
      db.sql.prepare('DELETE FROM test_share_links WHERE code = ?').run(code);
    },
    resolveShare: async (code, password) => {
      const link = db.sql
        .prepare('SELECT document_id, role, tab_id FROM test_share_links WHERE code = ?')
        .get(code) as { document_id: string; role: string; tab_id: string | null } | undefined;
      if (!link) throw new IndexError(404, 'not_found');
      if (index.trashed.has(link.document_id)) throw new IndexError(404, 'not_found');
      // A public link never asks for a password: behind one it is closed.
      if (index.password.has(link.document_id) && index.public.has(code))
        throw new IndexError(404, 'not_found');
      if (index.password.has(link.document_id) && !password)
        throw new IndexError(401, 'password_required');
      return {
        item: item(link.document_id) as never,
        level: link.role as never,
        tabId: link.tab_id,
      };
    },
    copyItem: async (id, input = {}) => ({
      item: {
        ...item(id),
        id: `${id}-copy`,
        title: input.title ?? `Copy of ${item(id).title}`,
        folderId: null,
        source: null,
        intent: null,
        summary: {},
        sharedVia: null,
        createdAt: 1,
        updatedAt: 1,
      } as never,
    }),
  };
  return { ...base, ...doors };
}

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
  const res = await handleDocuments(owner('PUT', `/api/documents/${docId}/community`, { body }));
  expect(res.status).toBe(201);
  const { post } = (await res.json()) as { post: { id: string; shareCode: string } };
  return post;
}

const community = (method: string, opts: { body?: unknown; clerk?: string | null } = {}) =>
  handleDocuments(owner(method, '/api/documents/d1/community', opts));

// What a page sees in the gallery: the ids of the listed posts.
async function gallery(): Promise<string[]> {
  const res = await service.read('/posts');
  const body: { posts: { id: string }[] } = await res.json();
  return body.posts.map((p) => p.id);
}

// The canvas's own check of where its post stands (its alarm, document-room.ts).
async function check(): Promise<void> {
  const store = env as Env & DocumentEnv;
  await checkCommunityPost(store, 'd1', await readDocumentMeta(store, 'd1'), Date.now());
}

// Reports hide a post on the service; the canvas's next check closes its link.
async function hideOnService(postId: string) {
  service.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 77 WHERE id = ?").run(postId);
  await check();
}

const count = (sql: string) => (db.sql.prepare(sql).get() as { n: number }).n;

// The worker's side of a request (no canvas store: it settles the grant and hands the canvas its request), with the
// canvas's room answering as the real one does, its Community post's link included (document-room.ts `route`).
function worker(): Env {
  const rooms = env.DOCUMENT_ROOM;
  const roomsWithCommunity = {
    ...rooms,
    idFromName: (name: string) => rooms.idFromName(name),
    get: (id: DurableObjectId) => {
      const stub = rooms.get(id) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      return {
        ...stub,
        route: async (documentId: string, request: Request, identity: RouteIdentity) =>
          answerDocumentRequest(
            env as never,
            request,
            identity,
            () => {},
            (await stub.community!(documentId)) as { code: string; open: boolean } | null,
          ),
      };
    },
  };
  return new Proxy(env, {
    has: (target, key) => key !== 'DOCUMENT_DB' && key in target,
    get: (target, key) =>
      key === 'DOCUMENT_DB'
        ? undefined
        : key === 'DOCUMENT_ROOM'
          ? roomsWithCommunity
          : (Reflect.get(target, key) as unknown),
  });
}

// A request as it reaches the worker: the grant is the index's to give, fetched for it there.
const viaWorker = (ctx: ReturnType<typeof makeTestRouteContext>) =>
  ({ ...ctx, env: worker(), grant: undefined }) as unknown as ReturnType<
    typeof makeTestRouteContext
  >;

// What the canvas's export door answers liveworkspace's previews for a link's code (liveworkspace/docs/specs/006-media/previews.md):
// whether the link is open is the index's to say, so this is only the canvas's own part, its Community post.
const drawnFor = async (code: string) =>
  (
    await documentRoom(env, 'd1').exportImage({
      format: 'svg',
      tabId: null,
      code,
      ifVersion: null,
    })
  ).status;

beforeEach(() => {
  db = sqliteD1();
  env = db.env;
  index.trashed.clear();
  index.password.clear();
  index.public.clear();
  service = communityServiceFor(env);
  thumbnail.svg = '<svg/>';
  accounts = accountsServiceFor(env);
  accounts.profiles.set(AUTHOR, { name: 'Ada', color: '#f97316', createdAt: 1 });
  testDocument(db, 'd1', AUTHOR, { name: 'Doc d1' });
  setFirstTab('d1', 1);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    expect(await gallery()).toEqual([post.id]);
    expect(
      count(`SELECT COUNT(*) AS n FROM test_share_links WHERE code = '${post.shareCode}'`),
    ).toBe(1);
    const read = await (await community('GET')).json();
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

    const edited = await community('PUT', { body: { ...body, title: 'Renamed' } });
    expect(edited.status).toBe(200);
    expect((await edited.json<{ post: { id: string; title: string } }>()).post).toMatchObject({
      id: post.id,
      title: 'Renamed',
    });
    // The link's doors show the new title too.
    expect(db.sql.prepare('SELECT title FROM community_post').get()).toEqual({ title: 'Renamed' });

    expect((await community('DELETE')).status).toBe(204);
    expect(await (await community('GET')).json()).toEqual({ post: null });
    expect((await community('DELETE')).status).toBe(404);
    expect(await gallery()).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(0);
  });

  it('refuses a guest, a password, bad input and an empty board, leaving no link behind', async () => {
    const guest = makeTestRouteContext('PUT', '/api/documents/d1/community', {
      env,
      owner: AUTHOR,
      body,
    });
    expect(await (await handleDocuments(guest)).json()).toEqual({ error: 'sign_in_required' });

    index.password.add('d1');
    const pw = await community('PUT', { body });
    expect([pw.status, await pw.json()]).toEqual([409, { error: 'share_password_set' }]);
    index.password.delete('d1');

    const bad = await community('PUT', { body: { ...body, category: 'cats' } });
    expect([bad.status, await bad.json()]).toEqual([400, { error: 'invalid_category' }]);

    setFirstTab('d1', 0);
    const empty = await community('PUT', { body });
    expect([empty.status, await empty.json()]).toEqual([409, { error: 'empty_document' }]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
  });

  it('passes on the per-author cap from the service', async () => {
    service.sql
      .exec(`INSERT INTO posts (id, app, document, share_code, owner, author_name, author_color, title,
      description, category, search_text, published_at, updated_at)
      SELECT 'p' || value, 'livediagram.app', 'x' || value, 'c' || value, '${AUTHOR}', 'Ada', '#000000', 'T', 'D',
             'other', 't', 1, 1
        FROM json_each('[${Array.from({ length: 50 }, (_, i) => i).join(',')}]')`);
    const res = await community('PUT', { body });
    expect([res.status, await res.json()]).toEqual([409, { error: 'post_limit' }]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
  });

  // Someone without the canvas's grant learns nothing of it, a post included: 404, as any door of a canvas that
  // isn't theirs answers.
  it('is not someone else’s to publish', async () => {
    const res = await community('PUT', { body, clerk: 'user_other' });
    expect(res.status).toBe(404);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
  });

  it('ignores other paths', async () => {
    expect(
      await handleCommunityOwnerRoutes(owner('POST', '/api/documents/d1/community')),
    ).toBeNull();
    expect(await handleCommunityOwnerRoutes(owner('GET', '/api/documents/d1/share'))).toBeNull();
  });

  it('has no Community without the service key', async () => {
    env.COMMUNITY_KEY = undefined;
    expect((await community('GET')).status).toBe(404);
  });
});

describe('My Shares', () => {
  const mine = (clerk: string | null) =>
    handleCommunity(
      makeTestRouteContext('GET', '/api/community/mine', {
        env,
        accountUserId: clerk,
        headers: { 'X-Community-Key': KEY },
      }),
    );
  type Mine = {
    posts: { id: string; state: string; documentId: string; liked: boolean }[];
    totals: { posts: number; likes: number; copies: number };
  };

  it('lists the signed-in author’s posts from the service, hidden ones included, with the browser’s hearts', async () => {
    const post = await publish('d1');
    await service.read(`/posts/${post.id}/like`, {
      method: 'PUT',
      headers: {
        'X-Community-Key': KEY,
        Origin: 'https://www.livediagram.app',
      },
    });

    expect((await mine(null)).status).toBe(401);
    const res = await mine(AUTHOR);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const listed = (await res.json()) as Mine;
    expect(listed.posts.map((p) => [p.id, p.state, p.documentId, p.liked])).toEqual([
      [post.id, 'listed', 'd1', true],
    ]);
    expect(listed.totals).toEqual({ posts: 1, likes: 1, copies: 0 });

    await hideOnService(post.id);
    const hidden = (await (await mine(AUTHOR)).json()) as Mine;
    expect(hidden.posts.map((p) => [p.id, p.state])).toEqual([[post.id, 'hidden']]);
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
    index.trashed.add('d1');
    await check();
    expect(await gallery()).toEqual([]);
    index.trashed.delete('d1');
    await check();
    expect(await gallery()).toEqual([post.id]);
  });

  it('closes a post whose document moved into a team library or took a password, keeping it in My Shares', async () => {
    const post = await publish();
    db.sql.prepare("UPDATE document SET team_id = 'team-1' WHERE id = 'd1'").run();
    await check();
    expect(await gallery()).toEqual([]);
    expect(service.sql.prepare('SELECT document_state FROM posts').get()).toEqual({
      document_state: 'closed',
    });
    db.sql.prepare("UPDATE document SET team_id = NULL WHERE id = 'd1'").run();
    index.password.add('d1');
    await check();
    expect(await gallery()).toEqual([]);
    index.password.delete('d1');
    await check();
    expect(await gallery()).toEqual([post.id]);
  });

  it('deletes the post of a document whose link is gone, and forgets it', async () => {
    await publish();
    db.sql.prepare('DELETE FROM test_share_links').run();
    await check();
    expect(service.sql.prepare('SELECT COUNT(*) AS n FROM posts').get()).toEqual({ n: 0 });
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(0);
  });

  it('sends nothing when nothing changed', async () => {
    await publish();
    const working = fetch;
    const spy = vi.fn(working);
    vi.stubGlobal('fetch', spy);
    await check();
    expect(spy.mock.calls.map(([input]) => new Request(input).url)).not.toContainEqual(
      expect.stringContaining('/sync'),
    );
  });

  it('keeps what failed to send for the next check', async () => {
    await publish();
    index.trashed.add('d1');
    const working = fetch;
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    await expect(check()).rejects.toThrow();
    expect(db.sql.prepare('SELECT sent_state FROM community_post').get()).toEqual({
      sent_state: 'public',
    });
    vi.stubGlobal('fetch', working);
    await check();
    expect(await gallery()).toEqual([]);
    expect(db.sql.prepare('SELECT sent_state FROM community_post').get()).toEqual({
      sent_state: 'away',
    });
  });
});

describe('a hidden post', () => {
  it('is final: its author sees it, but can neither edit nor remove it', async () => {
    const post = await publish();
    await hideOnService(post.id);
    const read = await community('GET');
    expect(await read.json()).toMatchObject({ post: { id: post.id, state: 'hidden' } });
    const edit = await community('PUT', { body: { ...body, title: 'Something else' } });
    expect(edit.status).toBe(409);
    expect(await edit.json()).toEqual({ error: 'post_hidden' });
    const remove = await community('DELETE');
    expect(remove.status).toBe(409);
    expect(service.sql.prepare('SELECT state, title FROM posts').get()).toEqual({
      state: 'hidden',
      title: 'Payments platform',
    });
  });
});

describe('the community link', () => {
  it('resolves read-only with the post, and stops resolving once the check hears it was hidden', async () => {
    const post = await publish();
    const visit = () =>
      handleShare(
        makeTestRouteContext('GET', `/api/share/${post.shareCode}`, {
          env: worker(),
          owner: 'guest-visitor',
        }),
      );
    const resolved = (await (await visit()).json()) as Record<string, unknown>;
    expect(resolved).toMatchObject({
      role: 'view',
      tabId: null,
      community: { postId: post.id, author: { name: 'Ada', color: '#f97316', picture: null } },
    });
    await hideOnService(post.id);
    expect((await visit()).status).toBe(404);
  });

  it('closes the link when its document moves into a team library or the Trash', async () => {
    const post = await publish();
    const visit = () =>
      handleShare(makeTestRouteContext('GET', `/api/share/${post.shareCode}`, { env: worker() }));
    expect((await visit()).status).toBe(200);
    db.sql.prepare("UPDATE document SET team_id = 'team-1' WHERE id = 'd1'").run();
    expect((await visit()).status).toBe(404);
    expect(await drawnFor(post.shareCode)).toBe('not_found');
  });

  it("stops drawing a hidden post's image", async () => {
    const post = await publish();
    expect(await drawnFor(post.shareCode)).toBe('ok');
    await hideOnService(post.id);
    expect(await drawnFor(post.shareCode)).toBe('not_found');
  });

  it('counts a copy taken through it once per person, and names the copy after the post', async () => {
    const post = await publish();
    const copy = () =>
      handleDocuments(
        viaWorker(
          makeTestRouteContext('POST', '/api/documents/d1/copy', {
            env,
            owner: 'guest-visitor',
            body: {},
            headers: { 'X-Share-Code': post.shareCode },
            waitUntil: (p: Promise<unknown>) => void p,
          }),
        ),
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
    expect((await community('GET')).status).toBe(404);
    const share = (path: string) =>
      handleShare(makeTestRouteContext('GET', path, { env: worker() }));
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
    expect(await drawnFor(post.shareCode)).toBe('not_found');
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(1);

    env.COMMUNITY_ENABLED = undefined;
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(200);
  });
});

describe('what a community link reveals', () => {
  const share = (path: string) =>
    handleShare(makeTestRouteContext('GET', path, { env: worker(), owner: 'guest-visitor' }));
  const readDocument = (code: string, query = '') =>
    handleDocuments(
      viaWorker(
        makeTestRouteContext('GET', `/api/documents/d1${query}`, {
          env,
          owner: 'guest-visitor',
          headers: { 'X-Share-Code': code },
        }),
      ),
    );

  it('sends the service nothing of an anonymous author it would show', async () => {
    const res = await community('PUT', { body: { ...body, anonymous: true } });
    expect(res.status).toBe(201);
    const text = await (await service.read('/posts')).text();
    expect(text).not.toContain(AUTHOR);
    expect(text).not.toContain('Ada');
    expect(text).not.toContain('#f97316');
    expect(text).not.toContain('"d1"');
  });

  it("names nobody: not the owner's name or colour, nor where the document sits", async () => {
    const post = (await (
      await community('PUT', { body: { ...body, anonymous: true } })
    ).json()) as { post: { shareCode: string } };
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
    const res = await handleDocuments(
      viaWorker(
        makeTestRouteContext('GET', '/api/documents/d1/tabs/tab-d1/render.svg', {
          env,
          owner: 'guest-visitor',
          headers: { 'X-Share-Code': shareCode },
        }),
      ),
    );
    expect(res.status).toBe(403);
    const own = (await handleTabRender(owner('GET', '/api/documents/d1/tabs/tab-d1/render.svg')))!;
    expect(own.status).toBe(200);
  });

  // Its drawing behind a share password is refused by the index before liveworkspace's previews ask the canvas
  // (liveworkspace/docs/specs/006-media/previews.md "Who may see one").
  it('answers a closed link with 404 alone, not trashed', async () => {
    const post = await publish();
    index.trashed.add('d1');
    await check();
    expect((await share(`/api/share/${post.shareCode}`)).status).toBe(404);
  });

  // The post's link is a public link at the index: a canvas that later took a share password closes it (404), so a
  // Community visitor never meets a password prompt.
  it('answers a closed link behind a share password with 404 alone, not a password prompt', async () => {
    const post = await publish();
    index.password.add('d1');
    const res = await share(`/api/share/${post.shareCode}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    // An ordinary link to the same canvas still asks for the password.
    const own = (
      await indexDoors(env, { kind: 'delegate', personId: AUTHOR, teams: [] })!.createShareLink(
        'd1',
        { level: 'view' },
      )
    ).link as { code: string };
    expect((await share(`/api/share/${own.code}`)).status).toBe(401);
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
    accounts.profiles.set('user_bob', { name: 'Bob', color: '#000000', createdAt: 1 });
    db.sql.prepare("UPDATE document SET owner_id = 'user_bob' WHERE id = 'd1'").run();
    await check();

    expect(
      (
        await handleShare(
          makeTestRouteContext('GET', `/api/share/${post.shareCode}`, { env: worker() }),
        )
      ).status,
    ).toBe(404);
    expect(await gallery()).toEqual([]);

    const bob = (method: string, opts: { body?: unknown } = {}) =>
      community(method, { ...opts, clerk: 'user_bob' });
    expect(await (await bob('GET')).json()).toEqual({ post: null });
    const published = await bob('PUT', { body });
    expect(published.status).toBe(201);
    expect(service.sql.prepare('SELECT owner FROM posts').all()).toEqual([{ owner: 'user_bob' }]);
    expect(db.sql.prepare('SELECT author_id FROM community_post').all()).toEqual([
      { author_id: 'user_bob' },
    ]);
    // The previous owner's link went with their post.
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(1);
  });
});
