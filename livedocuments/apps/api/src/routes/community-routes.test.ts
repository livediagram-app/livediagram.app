// The Community end to end, this api and the liveworkspace Community service both real (docs/specs/025-community/
// community.md; liveworkspace/docs/specs/007-community/community.md): the owner's publish guards and Edit Listing,
// My Shares, the document's check that keeps the service in step with where it stands at the index, the off switch,
// and how a community link behaves on the share resolve, the document read, the drawing the document gives
// liveworkspace's previews and the copy route. The service's own rules are tested with the service, and the shared
// route logic with @liveworkspace/community/app; the index's share links, passwords and Trash are faked here over
// `test_share_links`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type IndexClient } from '@liveworkspace/index-client';
import { documentRoom } from '../document-client';
import { ACCOUNTS_ON, profileOf, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { DocumentGrant, GrantCaller } from '../index-service';
import {
  sqliteD1,
  testIndexFor,
  TEST_GRANT_HOOK,
  type SqliteD1,
  type TestGrantCaller,
} from '../test-sqlite-d1';
import { communityServiceFor, type TestCommunityService } from '../test-community-service';
import type { DocumentEnv, Env } from '../types';

const { index } = vi.hoisted(() => ({
  // Where each document stands at the index: in the Trash, behind a share password; and the codes made as public
  // links (a post's).
  index: { trashed: new Set<string>(), password: new Set<string>(), public: new Set<string>() },
}));
// The drawings are the renderer's; whether the first page has something to show stays real.
vi.mock('../thumbnail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumbnail')>()),
  renderTabSvg: vi.fn(async () => '<svg/>'),
  drawDocument: vi.fn(async () => '<svg/>'),
}));
vi.mock('../index-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../index-service')>();
  // The grants a request fetches (a link visitor's) as the index would give them (test-sqlite-d1.ts), verified as
  // the index signed them.
  const grants = new Map<string, DocumentGrant>();
  const requestGrant = async (
    env: unknown,
    caller: GrantCaller,
    documentId: string,
    share: { code: string } | null,
  ) => {
    const hook = (env as Record<string, unknown>)[TEST_GRANT_HOOK] as (
      id: string,
      who: TestGrantCaller,
    ) => DocumentGrant | null;
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
import { makeTestRouteContext } from './test-route-context';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { handleCommunity } from './community';
import { handleShare } from './share';
import { handleCapabilities } from './capabilities';
import { handleDocuments } from './documents';

const AUTHOR = 'user_author';

let accounts: FakeAccounts;
let db: SqliteD1;
let env: Env;
let service: TestCommunityService;

// The index's doors this flow calls, over the test's tables: its share links (made, listed, revoked, resolved,
// refusing a document in the Trash or behind a password), the document as it stands, and a copy.
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
          'INSERT INTO test_share_links (code, document_id, role, tab_id, created_at) VALUES (?, ?, ?, NULL, 1)',
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
      if (!link || index.trashed.has(link.document_id)) throw new IndexError(404, 'not_found');
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
  title: 'Quarterly report',
  description: 'How the quarter went, in four pages.',
  category: 'articles',
  tags: ['Finance'],
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

const community = (method: string, opts: { body?: unknown; clerk?: string | null } = {}) =>
  handleDocuments(owner(method, '/api/documents/d1/community', opts));

async function publish(): Promise<{ id: string; shareCode: string }> {
  const res = await community('PUT', { body });
  expect(res.status).toBe(201);
  return (await res.json<{ post: { id: string; shareCode: string } }>()).post;
}

// What a page sees in the gallery: the ids of the listed posts.
async function gallery(): Promise<string[]> {
  const res = await service.read('/posts');
  return (await res.json<{ posts: { id: string }[] }>()).posts.map((p) => p.id);
}

// The document's own check of where its post stands (its alarm, document-room.ts).
async function check(): Promise<void> {
  const store = env as Env & DocumentEnv;
  await checkCommunityPost(store, 'd1', await readDocumentMeta(store, 'd1'), Date.now());
}

// Reports hide a post on the service; the document's next check closes its link.
async function hideOnService(postId: string) {
  service.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 77 WHERE id = ?").run(postId);
  await check();
}

const count = (sql: string) => (db.sql.prepare(sql).get() as { n: number }).n;

// The worker's side of a request: no document store, so it settles the grant and hands the document's room the
// request, which answers it with the room's Community post's link (document-room.ts `route`).
function worker(): Env {
  return new Proxy(env, {
    has: (target, key) => key !== 'DOCUMENT_DB' && key in target,
    get: (target, key) =>
      key === 'DOCUMENT_DB' ? undefined : (Reflect.get(target, key) as unknown),
  });
}
const viaWorker = (ctx: ReturnType<typeof makeTestRouteContext>) =>
  ({ ...ctx, env: worker(), grant: undefined }) as unknown as ReturnType<
    typeof makeTestRouteContext
  >;

const visitor = (method: string, path: string, code: string, extra: { body?: unknown } = {}) =>
  handleDocuments(
    viaWorker(
      makeTestRouteContext(method, path, {
        env,
        owner: 'guest-visitor',
        headers: { 'X-Share-Code': code },
        waitUntil: (p: Promise<unknown>) => void p,
        ...extra,
      }),
    ),
  );

const share = (code: string) =>
  handleShare(
    makeTestRouteContext('GET', `/api/share/${code}`, { env: worker(), owner: 'guest-visitor' }),
  );

// What the document's export door answers liveworkspace's previews for a link's code
// (liveworkspace/docs/specs/006-media/previews.md): only the document's own part, its Community post.
const drawnFor = async (code: string) =>
  (
    await documentRoom(env, 'd1').exportImage({
      format: 'svg',
      tabId: null,
      code,
      appearance: null,
      ifVersion: null,
    })
  ).status;

// The document's first tab, holding `count` elements on its first page (publishing refuses an empty first page).
// With no stored pages, the tab's one page is centred on the origin.
function setFirstTab(documentId: string, count: number, at = 0) {
  const tabId = `tab-${documentId}`;
  db.sql.prepare('DELETE FROM document_tabs WHERE document_id = ?').run(documentId);
  db.sql.prepare('DELETE FROM tabs WHERE id = ?').run(tabId);
  const elements = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    type: 'shape',
    shape: 'rectangle',
    x: at - 20,
    y: at - 20,
    width: 40,
    height: 40,
  }));
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

beforeEach(() => {
  index.trashed.clear();
  index.password.clear();
  index.public.clear();
  db = sqliteD1({ ...ACCOUNTS_ON });
  env = db.env;
  accounts = stubAccounts();
  accounts.profiles.set(AUTHOR, profileOf(AUTHOR, 'Ada', '#f97316'));
  service = communityServiceFor(env);
  db.sql
    .prepare(
      "INSERT INTO test_documents (id, owner_id, name, created_at) VALUES ('d1', ?, 'Doc d1', 1)",
    )
    .run(AUTHOR);
  setFirstTab('d1', 1);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('owner routes', () => {
  it('publishes, reads back, edits the listing and removes', async () => {
    const post = await publish();
    expect(await gallery()).toEqual([post.id]);
    expect(
      count(`SELECT COUNT(*) AS n FROM test_share_links WHERE code = '${post.shareCode}'`),
    ).toBe(1);
    expect(index.public.has(post.shareCode)).toBe(true);
    const read = await (await community('GET')).json();
    expect(read).toMatchObject({
      post: {
        id: post.id,
        title: 'Quarterly report',
        category: 'articles',
        tags: ['finance'],
        state: 'listed',
        author: { name: 'Ada', color: '#f97316' },
      },
    });
    expect(JSON.stringify(read)).not.toContain(AUTHOR);

    const edited = await community('PUT', { body: { ...body, title: 'Renamed' } });
    expect(edited.status).toBe(200);
    expect(db.sql.prepare('SELECT title FROM community_post').get()).toEqual({ title: 'Renamed' });

    expect((await community('DELETE')).status).toBe(204);
    expect(await (await community('GET')).json()).toEqual({ post: null });
    expect((await community('DELETE')).status).toBe(404);
    expect(await gallery()).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(0);
  });

  it('refuses a guest, a password, bad input and an empty first page, leaving no link behind', async () => {
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

    // A diagram's category is not one of livedocuments'.
    const bad = await community('PUT', { body: { ...body, category: 'architecture' } });
    expect([bad.status, await bad.json()]).toEqual([400, { error: 'invalid_category' }]);

    setFirstTab('d1', 0);
    const empty = await community('PUT', { body });
    expect([empty.status, await empty.json()]).toEqual([409, { error: 'empty_document' }]);
    // Something only off the first page is still nothing on the post's card.
    setFirstTab('d1', 1, 5000);
    const offPage = await community('PUT', { body });
    expect([offPage.status, await offPage.json()]).toEqual([409, { error: 'empty_document' }]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(0);
  });

  it('refuses a team document', async () => {
    db.sql.prepare("UPDATE document SET team_id = 'team-1' WHERE id = 'd1'").run();
    const res = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/d1/community', {
        env,
        owner: AUTHOR,
        accountUserId: AUTHOR,
        teams: [{ id: 'team-1', name: 'Team', role: 'admin' }] as never,
        body,
      }),
    );
    expect([res.status, await res.json()]).toEqual([409, { error: 'team_document' }]);
  });

  // Someone without the document's grant learns nothing of it, a post included.
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

  it('has no Community without the service key, and says so', async () => {
    env.COMMUNITY_KEY = undefined;
    expect((await community('GET')).status).toBe(404);
    const capabilities = handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities', { env }),
    );
    expect(await capabilities.json()).toMatchObject({ communityEnabled: false });
  });
});

describe('My Shares', () => {
  const mine = (clerk: string | null) =>
    handleCommunity(
      makeTestRouteContext('GET', '/api/community/mine', { env, accountUserId: clerk }),
    );

  it('lists the signed-in author’s posts from the service, hidden ones included', async () => {
    const post = await publish();
    expect((await mine(null)).status).toBe(401);
    const res = await mine(AUTHOR);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const listed = (await res.json()) as {
      posts: { id: string; state: string; documentId: string }[];
    };
    expect(listed.posts.map((p) => [p.id, p.state, p.documentId])).toEqual([
      [post.id, 'listed', 'd1'],
    ]);

    await hideOnService(post.id);
    const hidden = (await (await mine(AUTHOR)).json()) as { posts: { state: string }[] };
    expect(hidden.posts.map((p) => p.state)).toEqual(['hidden']);
    expect(await (await mine('user_x')).json()).toMatchObject({ posts: [] });
  });

  it('is the only Community read this api answers', async () => {
    for (const path of ['/api/community/posts', '/api/community/featured']) {
      const res = await handleCommunity(makeTestRouteContext('GET', path, { env }));
      expect(res.status, path).toBe(404);
    }
  });
});

describe('keeping in step', () => {
  it("carries the post's state on the owner's read of the document, for the header badge", async () => {
    const stateOf = async () =>
      (
        await (
          await handleDocuments(owner('GET', '/api/documents/d1'))
        ).json<{
          document: { communityState: string | null };
        }>()
      ).document.communityState;
    expect(await stateOf()).toBeNull();
    const post = await publish();
    expect(await stateOf()).toBe('listed');
    await hideOnService(post.id);
    expect(await stateOf()).toBe('hidden');
  });

  it('takes a trashed document’s post out of the gallery, and puts it back on restore', async () => {
    const post = await publish();
    index.trashed.add('d1');
    await check();
    expect(await gallery()).toEqual([]);
    index.trashed.delete('d1');
    await check();
    expect(await gallery()).toEqual([post.id]);
  });

  it('closes a post whose document moved into a team library, and deletes one whose link is gone', async () => {
    await publish();
    db.sql.prepare("UPDATE document SET team_id = 'team-1' WHERE id = 'd1'").run();
    await check();
    expect(service.sql.prepare('SELECT document_state FROM posts').get()).toEqual({
      document_state: 'closed',
    });
    db.sql.prepare('UPDATE document SET team_id = NULL').run();
    db.sql.prepare('DELETE FROM test_share_links').run();
    await check();
    expect(service.sql.prepare('SELECT COUNT(*) AS n FROM posts').get()).toEqual({ n: 0 });
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(0);
  });

  it('marks the listed document Public in what it tells the index', async () => {
    await publish();
    const listed = db.sql
      .prepare('SELECT COUNT(*) AS n FROM community_post WHERE hidden_at IS NULL')
      .get();
    expect(listed).toEqual({ n: 1 });
    const summary = await import('../document-room/document-outbox').then((m) =>
      m.itemSummaryOf({ elements: 1, communityListed: true } as never),
    );
    expect(summary).toMatchObject({ public: true });
  });
});

describe('the community link', () => {
  it('resolves read-only with the post, and stops resolving once the check hears it was hidden', async () => {
    const post = await publish();
    expect(await (await share(post.shareCode)).json()).toMatchObject({
      role: 'view',
      tabId: null,
      community: { postId: post.id, author: { name: 'Ada', color: '#f97316' } },
    });
    expect(await drawnFor(post.shareCode)).toBe('ok');
    await hideOnService(post.id);
    expect((await share(post.shareCode)).status).toBe(404);
    expect(await drawnFor(post.shareCode)).toBe('not_found');
  });

  it('answers a closed link behind a share password with 404 alone, not a password prompt', async () => {
    const post = await publish();
    index.password.add('d1');
    const res = await share(post.shareCode);
    expect([res.status, await res.json()]).toEqual([404, { error: 'not_found' }]);
  });

  it('reads the document with nobody named, and refuses the live room', async () => {
    const res = await community('PUT', { body: { ...body, anonymous: true } });
    const { shareCode } = ((await res.json()) as { post: { shareCode: string } }).post;
    const resolved = (await (await share(shareCode)).json()) as {
      community: { author: { name: string } };
    };
    expect(resolved.community.author.name).toBe('Anonymous');
    const read = await visitor('GET', '/api/documents/d1', shareCode);
    expect(read.status).toBe(200);
    expect((await read.json<{ document: Record<string, unknown> }>()).document).toMatchObject({
      ownerId: '',
      communityState: null,
      ownerName: null,
      ownerColor: null,
      folderId: null,
      source: null,
    });
    const ticket = await visitor('POST', '/api/documents/d1/room-ticket', shareCode);
    expect([ticket.status, await ticket.json()]).toEqual([403, { error: 'community_link' }]);
  });

  it('counts a copy taken through it once per person, and names the copy after the post', async () => {
    const post = await publish();
    const copy = () => visitor('POST', '/api/documents/d1/copy', post.shareCode, { body: {} });
    const first = await copy();
    expect(first.status).toBe(201);
    expect((await first.json<{ document: { name: string } }>()).document.name).toBe(
      'Quarterly report',
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
    expect((await share(post.shareCode)).status).toBe(404);
    expect(await drawnFor(post.shareCode)).toBe('not_found');
    expect(count('SELECT COUNT(*) AS n FROM community_post')).toBe(1);

    env.COMMUNITY_ENABLED = undefined;
    expect((await share(post.shareCode)).status).toBe(200);
  });
});

describe('a document that changes hands', () => {
  it("closes its previous owner's post, and lets the new owner publish their own", async () => {
    const post = await publish();
    accounts.profiles.set('user_bob', profileOf('user_bob', 'Bob', '#000000'));
    db.sql.prepare("UPDATE document SET owner_id = 'user_bob' WHERE id = 'd1'").run();
    await check();
    expect((await share(post.shareCode)).status).toBe(404);
    expect(await gallery()).toEqual([]);

    const bob = (method: string, opts: { body?: unknown } = {}) =>
      community(method, { ...opts, clerk: 'user_bob' });
    expect(await (await bob('GET')).json()).toEqual({ post: null });
    expect((await bob('PUT', { body })).status).toBe(201);
    expect(service.sql.prepare('SELECT owner FROM posts').all()).toEqual([{ owner: 'user_bob' }]);
    expect(count('SELECT COUNT(*) AS n FROM test_share_links')).toBe(1);
  });
});
