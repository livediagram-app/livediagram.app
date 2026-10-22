// Posts against the real schema: publish and Edit Listing, what the public reads can and cannot see,
// one app at a time, filters, sorts, search, paging, facets, the cascades, likes, copies, reports with
// automatic hiding, the featured six, and keeping in step with the app's documents.
import {
  COMMUNITY_COUNTED_PER_NETWORK,
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_PAGE_SIZE,
  EMPTY_COMMUNITY_QUERY,
  type CommunityApp,
  type CommunityAppPublish,
  type CommunityListQuery,
  type CommunityPostInput,
} from '@liveworkspace/community';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetCopier,
  likedPostIds,
  mergeCopier,
  recordCopy,
  recordReport,
  setLike,
} from './engagement';
import {
  countPostsByOwner,
  createPost,
  deletePost,
  facets,
  getPostForDocument,
  getPublicPost,
  listFeaturedPosts,
  listHiddenSince,
  listPosts,
  listRelatedPosts,
  mineTotals,
  syncDocuments,
  updatePost,
} from './posts';
import { rowToPost } from './rows';
import { testDb, type TestDb } from './test-sqlite-d1';

let db: TestDb;
const LD: CommunityApp = 'livediagram.app';
const LP: CommunityApp = 'liveplanner.app';

const input = (patch: Partial<CommunityPostInput> = {}): CommunityPostInput => ({
  title: 'Payments platform',
  description: 'How our payment services talk to each other.',
  category: 'architecture',
  tags: ['aws', 'event-driven'],
  anonymous: false,
  ...patch,
});

const publishing = (patch: Partial<CommunityPostInput> = {}): CommunityAppPublish => ({
  owner: 'user_author',
  shareCode: 'code',
  documentState: 'public',
  author: { name: 'Ada', color: '#f97316', picture: null },
  input: input(patch),
});

async function publish(
  document: string,
  patch: Partial<CommunityPostInput> = {},
  now = 1000,
  app: CommunityApp = LD,
) {
  return createPost(
    db.env,
    app,
    document,
    { ...publishing(patch), shareCode: `code-${document}` },
    now,
  );
}

const list = async (patch: Partial<CommunityListQuery> = {}, app: CommunityApp = LD) =>
  (await listPosts(db.env, app, { ...EMPTY_COMMUNITY_QUERY, ...patch })).rows.map((r) => r.title);

const count = (table: string) =>
  (db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
  db = testDb();
});

describe('publishing', () => {
  it('creates a post for an app document', async () => {
    const postId = await publish('d1');
    expect(await getPostForDocument(db.env, LD, 'd1')).toMatchObject({
      id: postId,
      app: LD,
      share_code: 'code-d1',
      owner: 'user_author',
      title: 'Payments platform',
      state: 'listed',
      document_state: 'public',
      author_name: 'Ada',
    });
    expect(await countPostsByOwner(db.env, LD, 'user_author')).toBe(1);
    expect(await countPostsByOwner(db.env, LP, 'user_author')).toBe(0);
  });

  it('keeps a document to one post per app, and apps apart', async () => {
    await publish('d1');
    await expect(publish('d1')).rejects.toThrow();
    // The same document id in another app is another document.
    await publish('d1', {}, 1000, LP);
    expect(count('posts')).toBe(2);
  });

  it('updates the details, the author and tags but keeps counts and the publish date', async () => {
    const postId = await publish('d1');
    await setLike(db.env, postId, 'k1', true, 'n1');
    await updatePost(
      db.env,
      postId,
      {
        ...publishing({ title: 'Renamed', tags: ['gcp'] }),
        author: { name: 'Ada L', color: '#000000', picture: null },
      },
      5000,
    );
    expect(await getPostForDocument(db.env, LD, 'd1')).toMatchObject({
      title: 'Renamed',
      tags: '["gcp"]',
      author_name: 'Ada L',
      like_count: 1,
      published_at: 1000,
      updated_at: 5000,
    });
    expect(await list({ tag: 'aws' })).toEqual([]);
    expect(await list({ tag: 'gcp' })).toEqual(['Renamed']);
  });

  it('removing the post cascades its tags, likes, copies and reports', async () => {
    const postId = await publish('d1');
    await setLike(db.env, postId, 'k1', true, 'n1');
    await recordCopy(db.env, postId, 'copier', 'n1');
    await recordReport(db.env, postId, 'k1', 'n1', 'spam', null);
    await deletePost(db.env, postId);
    expect(await getPostForDocument(db.env, LD, 'd1')).toBeNull();
    for (const table of ['posts', 'post_tags', 'likes', 'copies', 'reports']) {
      expect(count(table)).toBe(0);
    }
  });
});

describe('anonymous posts', () => {
  it('show Anonymous instead of the author, and can be switched on an edit', async () => {
    const postId = await publish('d1', { anonymous: true });
    const row = (await getPostForDocument(db.env, LD, 'd1'))!;
    expect(rowToPost(row, false)).toMatchObject({
      anonymous: true,
      author: { name: 'Anonymous', picture: null },
    });
    expect(JSON.stringify(rowToPost(row, false))).not.toContain('Ada');
    await updatePost(db.env, postId, publishing({ anonymous: false }));
    const named = (await getPostForDocument(db.env, LD, 'd1'))!;
    expect(rowToPost(named, false).author.name).toBe('Ada');
  });

  it('never carry the owner or the app document id', async () => {
    await publish('d1');
    const post = rowToPost((await getPostForDocument(db.env, LD, 'd1'))!, false);
    expect(JSON.stringify(post)).not.toContain('user_author');
    expect(Object.values(post)).not.toContain('d1');
  });
});

describe('public reads', () => {
  it("show one app's posts only", async () => {
    const mine = await publish('d1', { title: 'A diagram' });
    const theirs = await publish('d2', { title: 'A plan' }, 1000, LP);
    expect(await list()).toEqual(['A diagram']);
    expect(await list({}, LP)).toEqual(['A plan']);
    expect(await getPublicPost(db.env, LD, theirs)).toBeNull();
    expect(await getPublicPost(db.env, LP, mine)).toBeNull();
    expect((await facets(db.env, LD)).total).toBe(1);
  });

  it('hide a post whose document is not public, and show it again when it is', async () => {
    const postId = await publish('d1');
    for (const state of ['closed', 'away'] as const) {
      await syncDocuments(db.env, LD, { documents: [{ document: 'd1', state }], gone: [] });
      expect(await getPublicPost(db.env, LD, postId)).toBeNull();
      expect(await list()).toEqual([]);
      expect((await facets(db.env, LD)).total).toBe(0);
    }
    await syncDocuments(db.env, LD, { documents: [{ document: 'd1', state: 'public' }], gone: [] });
    expect(await list()).toEqual(['Payments platform']);
  });

  it('hide a hidden post', async () => {
    const postId = await publish('d1');
    db.sql.prepare("UPDATE posts SET state = 'hidden' WHERE id = ?").run(postId);
    expect(await getPublicPost(db.env, LD, postId)).toBeNull();
    expect(await getPostForDocument(db.env, LD, 'd1')).not.toBeNull();
  });

  it('filters by category, tag and every search term', async () => {
    await publish('d1', { title: 'Cloud map', tags: ['aws'] });
    await publish('d2', {
      title: 'Sprint retro',
      category: 'workshops',
      tags: ['agile'],
      description: 'What went well and what did not.',
    });
    await publish('d3', { title: 'Cloud costs', category: 'planning', tags: ['finops'] });
    expect(await list({ category: 'workshops' })).toEqual(['Sprint retro']);
    expect(await list({ tag: 'aws' })).toEqual(['Cloud map']);
    expect((await list({ q: 'cloud' })).sort()).toEqual(['Cloud costs', 'Cloud map']);
    expect(await list({ q: 'cloud FINOPS' })).toEqual(['Cloud costs']);
    expect(await list({ q: 'went well' })).toEqual(['Sprint retro']);
    expect(await list({ q: '#aws' })).toEqual(['Cloud map']);
    expect(await list({ q: 'cloud #finops' })).toEqual(['Cloud costs']);
    expect(await list({ q: '#aws #finops' })).toEqual([]);
  });

  it('treats LIKE wildcards in a search literally', async () => {
    await publish('d1', { title: '100% uptime' });
    await publish('d2', { title: 'Other board' });
    expect(await list({ q: '%' })).toEqual(['100% uptime']);
    expect(await list({ q: '_' })).toEqual([]);
  });

  it('sorts by newest, most loved and most copied', async () => {
    const a = await publish('d1', { title: 'A' }, 1);
    const b = await publish('d2', { title: 'B' }, 2);
    await publish('d3', { title: 'C' }, 3);
    await setLike(db.env, a, 'k1', true, 'n1');
    await setLike(db.env, a, 'k2', true, 'n2');
    await setLike(db.env, b, 'k1', true, 'n1');
    await recordCopy(db.env, b, 'p1', 'n1');
    expect(await list()).toEqual(['C', 'B', 'A']);
    expect(await list({ sort: 'loved' })).toEqual(['A', 'B', 'C']);
    expect(await list({ sort: 'copied' })).toEqual(['B', 'C', 'A']);
  });

  it('pages with nextOffset', async () => {
    for (let i = 0; i < COMMUNITY_PAGE_SIZE + 2; i++) await publish(`d${i}`, { title: `B${i}` }, i);
    const first = await listPosts(db.env, LD, EMPTY_COMMUNITY_QUERY);
    expect(first.rows).toHaveLength(COMMUNITY_PAGE_SIZE);
    expect(first.nextOffset).toBe(COMMUNITY_PAGE_SIZE);
    const second = await listPosts(db.env, LD, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_PAGE_SIZE,
    });
    expect(second.rows).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
  });

  it('stops paging at the deepest offset, rather than repeating the last page', async () => {
    const total = COMMUNITY_MAX_OFFSET + COMMUNITY_PAGE_SIZE + 5;
    const post = db.sql.prepare(
      `INSERT INTO posts (id, app, document, share_code, owner, author_name, author_color, title, description,
         category, search_text, published_at, updated_at)
       VALUES (?, 'livediagram.app', ?, ?, 'o', 'A', '#000000', 'P', 'A post.', 'other', 'p', ?, ?)`,
    );
    for (let i = 0; i < total; i++) post.run(`post${i}`, `doc${i}`, `code${i}`, i, i);
    const deepest = await listPosts(db.env, LD, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_MAX_OFFSET,
    });
    expect(deepest.rows).toHaveLength(COMMUNITY_PAGE_SIZE);
    expect(deepest.nextOffset).toBeNull();
    const before = await listPosts(db.env, LD, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_MAX_OFFSET - COMMUNITY_PAGE_SIZE,
    });
    expect(before.nextOffset).toBe(COMMUNITY_MAX_OFFSET);
  });

  it('counts categories and popular tags', async () => {
    await publish('d1', { tags: ['aws', 'k8s'] });
    await publish('d2', { tags: ['aws'] });
    await publish('d3', { category: 'art', tags: [] });
    await publish('d4', { tags: ['aws'] }, 1000, LP);
    expect(await facets(db.env, LD)).toEqual({
      total: 3,
      categories: { architecture: 2, art: 1 },
      tags: [
        { tag: 'aws', count: 2 },
        { tag: 'k8s', count: 1 },
      ],
    });
  });

  it('relates posts in the same app and category, most loved first, without the post itself', async () => {
    const a = await publish('d1', { title: 'A' });
    const b = await publish('d2', { title: 'B' });
    const c = await publish('d3', { title: 'C' });
    await publish('d4', { title: 'D', category: 'art' });
    await publish('d5', { title: 'E' }, 1000, LP);
    await setLike(db.env, c, 'k1', true, 'n1');
    const related = await listRelatedPosts(db.env, LD, a, 'architecture');
    expect(related.map((r) => r.id)).toEqual([c, b]);
  });
});

describe('My Shares', () => {
  it("lists an owner's posts, hidden and closed ones included, but not away ones", async () => {
    const hidden = await publish('d1', { title: 'Hidden' });
    await publish('d2', { title: 'Closed' });
    await publish('d3', { title: 'Away' });
    await publish('d4', { title: 'Plan' }, 1000, LP);
    db.sql.prepare("UPDATE posts SET state = 'hidden' WHERE id = ?").run(hidden);
    await syncDocuments(db.env, LD, {
      documents: [
        { document: 'd2', state: 'closed' },
        { document: 'd3', state: 'away' },
      ],
      gone: [],
    });
    const mine = await listPosts(db.env, LD, EMPTY_COMMUNITY_QUERY, 'user_author');
    expect(mine.rows.map((r) => r.title).sort()).toEqual(['Closed', 'Hidden']);
    expect(await mineTotals(db.env, LD, 'user_author')).toEqual({ posts: 2, likes: 0, copies: 0 });
    expect(await list()).toEqual([]);
  });
});

describe('keeping in step', () => {
  it('deletes the posts of documents gone for good, with everything on them', async () => {
    const postId = await publish('d1');
    await publish('d2');
    await setLike(db.env, postId, 'k1', true, 'n1');
    await syncDocuments(db.env, LD, { documents: [], gone: ['d1', 'unknown'] });
    expect(await getPostForDocument(db.env, LD, 'd1')).toBeNull();
    expect(await getPostForDocument(db.env, LD, 'd2')).not.toBeNull();
    expect(count('likes')).toBe(0);
  });

  it('reports the posts hidden since a time, for the app to close their links', async () => {
    const a = await publish('d1');
    const b = await publish('d2');
    await publish('d3', {}, 1000, LP);
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 50 WHERE id = ?").run(a);
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 90 WHERE id = ?").run(b);
    db.sql.prepare("UPDATE posts SET state = 'hidden', hidden_at = 70 WHERE app = ?").run(LP);
    expect(await listHiddenSince(db.env, LD, 0)).toEqual([
      { document: 'd1', hiddenAt: 50 },
      { document: 'd2', hiddenAt: 90 },
    ]);
    expect(await listHiddenSince(db.env, LD, 90)).toEqual([{ document: 'd2', hiddenAt: 90 }]);
  });
});

describe('likes and copies', () => {
  it('are idempotent per key and per copier', async () => {
    const postId = await publish('d1');
    expect(await setLike(db.env, postId, 'k1', true, 'n1')).toBe(1);
    expect(await setLike(db.env, postId, 'k1', true, 'n1')).toBe(1);
    expect(await setLike(db.env, postId, 'k2', true, 'n2')).toBe(2);
    expect([...(await likedPostIds(db.env, 'k1', [postId, 'other']))]).toEqual([postId]);
    expect(await setLike(db.env, postId, 'k1', false, 'n1')).toBe(1);
    expect(await setLike(db.env, postId, 'k1', false, 'n1')).toBe(1);
    await recordCopy(db.env, postId, 'p1', 'n1');
    await recordCopy(db.env, postId, 'p1', 'n1');
    await recordCopy(db.env, postId, 'p2', 'n2');
    expect((await getPostForDocument(db.env, LD, 'd1'))!.copy_count).toBe(2);
  });

  it('count at most five from any one network, every like still remembered', async () => {
    const postId = await publish('d1');
    let likes = 0;
    for (let i = 0; i < 8; i++) likes = await setLike(db.env, postId, `office${i}`, true, 'office');
    expect(likes).toBe(COMMUNITY_COUNTED_PER_NETWORK);
    expect(await setLike(db.env, postId, 'home', true, 'home')).toBe(6);
    expect([...(await likedPostIds(db.env, 'office7', [postId]))]).toEqual([postId]);
    for (let i = 0; i < 7; i++) await recordCopy(db.env, postId, `copier${i}`, 'office');
    await recordCopy(db.env, postId, 'solo', 'home');
    expect((await getPostForDocument(db.env, LD, 'd1'))!.copy_count).toBe(6);
  });

  it('likedPostIds is empty without a key', async () => {
    const postId = await publish('d1');
    expect((await likedPostIds(db.env, null, [postId])).size).toBe(0);
  });

  it("forget a deleted account's copies, in its app only", async () => {
    const a = await publish('d1');
    const b = await publish('d2', {}, 1000, LP);
    await recordCopy(db.env, a, 'gone', 'n1');
    await recordCopy(db.env, a, 'stays', 'n2');
    await recordCopy(db.env, b, 'gone', 'n1');
    await forgetCopier(db.env, LD, 'gone');
    expect((await getPostForDocument(db.env, LD, 'd1'))!.copy_count).toBe(1);
    expect((await getPostForDocument(db.env, LP, 'd2'))!.copy_count).toBe(1);
    await forgetCopier(db.env, LD, 'nobody');
  });

  it("move a guest's copies to their account, counting a post both copied once", async () => {
    const a = await publish('d1');
    const b = await publish('d2');
    await recordCopy(db.env, a, 'guest', 'n1');
    await recordCopy(db.env, a, 'account', 'n2');
    await recordCopy(db.env, b, 'guest', 'n1');
    await mergeCopier(db.env, LD, 'guest', 'account');
    expect((await getPostForDocument(db.env, LD, 'd1'))!.copy_count).toBe(1);
    expect((await getPostForDocument(db.env, LD, 'd2'))!.copy_count).toBe(1);
    expect(db.sql.prepare("SELECT COUNT(*) AS n FROM copies WHERE copier = 'guest'").get()).toEqual(
      {
        n: 0,
      },
    );
  });
});

describe('reports', () => {
  it('hide a post after three distinct reporters on three distinct networks', async () => {
    const postId = await publish('d1');
    expect(await recordReport(db.env, postId, 'k1', 'n1', 'spam', null, 10)).toBe(false);
    // The same browser again: ignored. A second browser on the same network: not enough networks.
    expect(await recordReport(db.env, postId, 'k1', 'n2', 'spam', null, 10)).toBe(false);
    expect(await recordReport(db.env, postId, 'k2', 'n1', 'spam', null, 10)).toBe(false);
    expect(await recordReport(db.env, postId, 'k3', 'n2', 'offensive', 'rude', 10)).toBe(false);
    expect(await getPublicPost(db.env, LD, postId)).not.toBeNull();
    expect(await recordReport(db.env, postId, 'k4', 'n3', 'other', null, 42)).toBe(true);
    expect(await getPublicPost(db.env, LD, postId)).toBeNull();
    expect((await getPostForDocument(db.env, LD, 'd1'))!.hidden_at).toBe(42);
  });
});

describe('featured on the home page', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = 400 * DAY;

  it('ranks by likes in the last three months, then tops up with the best of all time', async () => {
    const old = await publish('d1', { title: 'Old favourite' }, 1);
    const fresh = await publish('d2', { title: 'Fresh hit' }, 2);
    await publish('d3', { title: 'Quiet' }, 3);
    for (const k of ['k1', 'k2', 'k3']) await setLike(db.env, old, k, true, k, NOW - 200 * DAY);
    for (const k of ['k4', 'k5']) await setLike(db.env, fresh, k, true, k, NOW - 5 * DAY);
    const titles = (await listFeaturedPosts(db.env, LD, NOW)).map((r) => r.title);
    expect(titles).toEqual(['Fresh hit', 'Old favourite', 'Quiet']);
  });

  it('counts no more than five likes from one network toward the ranking', async () => {
    const crowd = await publish('d1', { title: 'One network' }, 1);
    const spread = await publish('d2', { title: 'Many networks' }, 2);
    for (let i = 0; i < 20; i++) await setLike(db.env, crowd, `k${i}`, true, 'one', NOW - DAY);
    for (let i = 0; i < 6; i++) await setLike(db.env, spread, `s${i}`, true, `net-${i}`, NOW - DAY);
    const titles = (await listFeaturedPosts(db.env, LD, NOW)).map((r) => r.title);
    expect(titles.slice(0, 2)).toEqual(['Many networks', 'One network']);
  });

  it("is at most six, only public posts, and only the app's", async () => {
    for (let i = 0; i < 8; i++) await publish(`d${i}`, { title: `P${i}` }, i);
    const plan = await publish('p1', { title: 'Plan' }, 9, LP);
    await setLike(db.env, plan, 'k', true, 'n', NOW - DAY);
    db.sql.prepare("UPDATE posts SET state = 'hidden' WHERE title = 'P7'").run();
    const rows = await listFeaturedPosts(db.env, LD, NOW);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.title)).not.toContain('P7');
    expect(rows.map((r) => r.title)).not.toContain('Plan');
  });
});
