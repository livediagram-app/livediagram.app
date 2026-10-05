// Community posts against a real schema (docs/specs/025-community/blueprints/community.md §13): publish and Edit
// Listing, what the public reads can and cannot see, filters, sorts, search, paging, facets, the cascades, likes,
// copies, reports with automatic hiding, and the operator's decisions.
import { COMMUNITY_COUNTED_PER_NETWORK } from '@livediagram/api-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_PAGE_SIZE,
  EMPTY_COMMUNITY_QUERY,
  type CommunityListQuery,
} from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  communityFacets,
  countCommunityPostsByAuthor,
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPostByShareCode,
  getCommunityPostForDocument,
  getPublicCommunityPost,
  listCommunityPosts,
  listRelatedCommunityPosts,
  updateCommunityPost,
} from './community';
import {
  communityNetworkHash,
  likedPostIds,
  recordCommunityCopy,
  recordCommunityReport,
  setCommunityLike,
} from './community-engagement';
import { listShareLinks, getShareLink } from './share';
import { copyDocument } from './documents';
import { rowToCommunityPost } from '../community-row';
import { listFeaturedCommunityPosts } from './community';

let db: SqliteD1;

function addDocument(id: string, owner = 'user_author') {
  db.sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 1, 1)',
    )
    .run(id, owner, `Doc ${id}`);
}

const input = (patch: Partial<Parameters<typeof createCommunityPost>[3]> = {}) => ({
  title: 'Payments platform',
  description: 'How our payment services talk to each other.',
  category: 'architecture' as const,
  tags: ['aws', 'event-driven'],
  anonymous: false,
  ...patch,
});

async function publish(docId: string, patch = {}, now = 1000) {
  addDocument(docId);
  return createCommunityPost(db.env, docId, 'user_author', input(patch), now);
}

const list = async (patch: Partial<CommunityListQuery> = {}) =>
  (await listCommunityPosts(db.env, { ...EMPTY_COMMUNITY_QUERY, ...patch })).rows.map(
    (r) => r.title,
  );

beforeEach(() => {
  db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO participants (id, name, color, created_at) VALUES ('user_author', 'Ada', '#f97316', 1)",
    )
    .run();
});

describe('publishing', () => {
  it('creates a post with its own unlisted, view-role community link', async () => {
    const postId = await publish('d1');
    const row = await getCommunityPostForDocument(db.env, 'd1');
    expect(row).toMatchObject({
      id: postId,
      title: 'Payments platform',
      state: 'listed',
      author_name: 'Ada',
    });
    const link = await getShareLink(db.env, row!.share_code);
    expect(link).toMatchObject({
      role: 'view',
      purpose: 'community',
      expiresAt: null,
      tabId: null,
    });
    expect(await listShareLinks(db.env, 'd1')).toEqual([]);
    expect(await countCommunityPostsByAuthor(db.env, 'user_author')).toBe(1);
  });

  it('keeps a document to one post', async () => {
    await publish('d1');
    await expect(createCommunityPost(db.env, 'd1', 'user_author', input())).rejects.toThrow();
  });

  it('updates the details and tags but keeps counts and the publish date', async () => {
    const postId = await publish('d1');
    await setCommunityLike(db.env, postId, 'k1', true, null);
    await updateCommunityPost(db.env, postId, input({ title: 'Renamed', tags: ['gcp'] }), 5000);
    const row = await getCommunityPostForDocument(db.env, 'd1');
    expect(row).toMatchObject({
      title: 'Renamed',
      tags: '["gcp"]',
      like_count: 1,
      published_at: 1000,
      updated_at: 5000,
    });
    expect(await list({ tag: 'aws' })).toEqual([]);
    expect(await list({ tag: 'gcp' })).toEqual(['Renamed']);
  });

  it('removing the post cascades its link, tags, likes, copies and reports', async () => {
    const postId = await publish('d1');
    await setCommunityLike(db.env, postId, 'k1', true, null);
    await recordCommunityCopy(db.env, postId, 'copier', null);
    await recordCommunityReport(db.env, postId, 'k1', 'n1', 'spam', null);
    const row = await getCommunityPostForDocument(db.env, 'd1');
    await deleteCommunityPost(db.env, row!.share_code);
    expect(await getCommunityPostForDocument(db.env, 'd1')).toBeNull();
    for (const table of [
      'community_post_tags',
      'community_likes',
      'community_copies',
      'community_reports',
      'share_links',
    ]) {
      expect(db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });

  it('deleting the document deletes the post', async () => {
    await publish('d1');
    db.sql.prepare("DELETE FROM documents WHERE id = 'd1'").run();
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_posts').get()).toEqual({ n: 0 });
  });
});

describe('anonymous posts', () => {
  it('show Anonymous instead of the author, and can be switched on an edit', async () => {
    const postId = await publish('d1', { anonymous: true });
    const row = (await getCommunityPostForDocument(db.env, 'd1'))!;
    expect(rowToCommunityPost(row, false)).toMatchObject({
      anonymous: true,
      author: { name: 'Anonymous', picture: null },
    });
    expect(JSON.stringify(rowToCommunityPost(row, false))).not.toContain('Ada');
    await updateCommunityPost(db.env, postId, input({ anonymous: false }));
    const named = (await getCommunityPostForDocument(db.env, 'd1'))!;
    expect(rowToCommunityPost(named, false).author.name).toBe('Ada');
  });
});

describe('public reads', () => {
  it('hide trashed documents and hidden posts, and show a document again on restore', async () => {
    const postId = await publish('d1');
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    expect(await getPublicCommunityPost(db.env, postId)).toBeNull();
    expect(await list()).toEqual([]);
    expect((await communityFacets(db.env)).total).toBe(0);
    db.sql.prepare("UPDATE documents SET trashed_at = NULL WHERE id = 'd1'").run();
    expect(await list()).toEqual(['Payments platform']);
    db.sql.prepare("UPDATE community_posts SET state = 'hidden' WHERE id = ?").run(postId);
    expect(await getPublicCommunityPost(db.env, postId)).toBeNull();
    expect(
      await getCommunityPostByShareCode(
        db.env,
        (await getCommunityPostForDocument(db.env, 'd1'))!.share_code,
      ),
    ).not.toBeNull();
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
    // #tags in the search: every one must match.
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
    await setCommunityLike(db.env, a, 'k1', true, null);
    await setCommunityLike(db.env, a, 'k2', true, null);
    await setCommunityLike(db.env, b, 'k1', true, null);
    await recordCommunityCopy(db.env, b, 'p1', null);
    expect(await list()).toEqual(['C', 'B', 'A']);
    expect(await list({ sort: 'loved' })).toEqual(['A', 'B', 'C']);
    expect(await list({ sort: 'copied' })).toEqual(['B', 'C', 'A']);
  });

  it('pages with nextOffset', async () => {
    for (let i = 0; i < COMMUNITY_PAGE_SIZE + 2; i++)
      await publish(`d${i}`, { title: `Board ${i}` }, i);
    const first = await listCommunityPosts(db.env, EMPTY_COMMUNITY_QUERY);
    expect(first.rows).toHaveLength(COMMUNITY_PAGE_SIZE);
    expect(first.nextOffset).toBe(COMMUNITY_PAGE_SIZE);
    const second = await listCommunityPosts(db.env, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_PAGE_SIZE,
    });
    expect(second.rows).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
  });

  it('stops paging at the deepest offset, rather than repeating the last page', async () => {
    // More posts than COMMUNITY_MAX_OFFSET + a page, written straight to the tables.
    const total = COMMUNITY_MAX_OFFSET + COMMUNITY_PAGE_SIZE + 5;
    const doc = db.sql.prepare(
      "INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, 'user_author', 'D', 0, 1, 1)",
    );
    const link = db.sql.prepare(
      "INSERT INTO share_links (code, document_id, role, created_at, purpose) VALUES (?, ?, 'view', 1, 'community')",
    );
    const post = db.sql.prepare(
      `INSERT INTO community_posts (id, document_id, share_code, author_id, title, description, category, search_text,
         published_at, updated_at) VALUES (?, ?, ?, 'user_author', 'P', 'A post.', 'other', 'p', ?, ?)`,
    );
    for (let i = 0; i < total; i++) {
      doc.run(`bulk${i}`);
      link.run(`code${i}`, `bulk${i}`);
      post.run(`post${i}`, `bulk${i}`, `code${i}`, i, i);
    }
    const deepest = await listCommunityPosts(db.env, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_MAX_OFFSET,
    });
    expect(deepest.rows).toHaveLength(COMMUNITY_PAGE_SIZE);
    expect(deepest.nextOffset).toBeNull();
    const before = await listCommunityPosts(db.env, {
      ...EMPTY_COMMUNITY_QUERY,
      offset: COMMUNITY_MAX_OFFSET - COMMUNITY_PAGE_SIZE,
    });
    expect(before.nextOffset).toBe(COMMUNITY_MAX_OFFSET);
  });

  it('counts categories and popular tags', async () => {
    await publish('d1', { tags: ['aws', 'k8s'] });
    await publish('d2', { tags: ['aws'] });
    await publish('d3', { category: 'art', tags: [] });
    expect(await communityFacets(db.env)).toEqual({
      total: 3,
      categories: { architecture: 2, art: 1 },
      tags: [
        { tag: 'aws', count: 2 },
        { tag: 'k8s', count: 1 },
      ],
    });
  });

  it('relates posts in the same category, most loved first, without the post itself', async () => {
    const a = await publish('d1', { title: 'A' });
    const b = await publish('d2', { title: 'B' });
    const c = await publish('d3', { title: 'C' });
    await publish('d4', { title: 'D', category: 'art' });
    await setCommunityLike(db.env, c, 'k1', true, null);
    const related = await listRelatedCommunityPosts(db.env, a, 'architecture');
    expect(related.map((r) => r.id)).toEqual([c, b]);
  });
});

describe('likes and copies', () => {
  it('are idempotent per key and per copier', async () => {
    const postId = await publish('d1');
    expect(await setCommunityLike(db.env, postId, 'k1', true, null)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k1', true, null)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k2', true, null)).toBe(2);
    expect([...(await likedPostIds(db.env, 'k1', [postId, 'other']))]).toEqual([postId]);
    expect(await setCommunityLike(db.env, postId, 'k1', false, null)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k1', false, null)).toBe(1);
    await recordCommunityCopy(db.env, postId, 'p1', null);
    await recordCommunityCopy(db.env, postId, 'p1', null);
    await recordCommunityCopy(db.env, postId, 'p2', null);
    expect((await getCommunityPostForDocument(db.env, 'd1'))!.copy_count).toBe(2);
  });

  it('count at most five from any one network, every like still remembered', async () => {
    const postId = await publish('d1');
    let count = 0;
    for (let i = 0; i < 8; i++) {
      count = await setCommunityLike(db.env, postId, `office${i}`, true, 'net-office');
    }
    expect(count).toBe(COMMUNITY_COUNTED_PER_NETWORK);
    expect(await setCommunityLike(db.env, postId, 'home', true, 'net-home')).toBe(6);
    // The eighth office browser still sees its own heart.
    expect([...(await likedPostIds(db.env, 'office7', [postId]))]).toEqual([postId]);
    for (let i = 0; i < 7; i++)
      await recordCommunityCopy(db.env, postId, `copier${i}`, 'net-office');
    await recordCommunityCopy(db.env, postId, 'solo', null);
    expect((await getCommunityPostForDocument(db.env, 'd1'))!.copy_count).toBe(6);
  });

  it('likedPostIds is empty without a key', async () => {
    const postId = await publish('d1');
    expect((await likedPostIds(db.env, null, [postId])).size).toBe(0);
  });
});

describe('reports', () => {
  it('hides a post after three distinct reporters on three distinct networks', async () => {
    const postId = await publish('d1');
    expect(await recordCommunityReport(db.env, postId, 'k1', 'n1', 'spam', null)).toBe(false);
    // Same browser again: ignored. A second browser on the same network: not enough networks.
    expect(await recordCommunityReport(db.env, postId, 'k1', 'n2', 'spam', null)).toBe(false);
    expect(await recordCommunityReport(db.env, postId, 'k2', 'n1', 'spam', null)).toBe(false);
    expect(await recordCommunityReport(db.env, postId, 'k3', 'n2', 'offensive', 'rude')).toBe(
      false,
    );
    expect(await getPublicCommunityPost(db.env, postId)).not.toBeNull();
    expect(await recordCommunityReport(db.env, postId, 'k4', 'n3', 'other', null)).toBe(true);
    expect(await getPublicCommunityPost(db.env, postId)).toBeNull();
    expect((await getCommunityPostForDocument(db.env, 'd1'))!.hidden_by).toBe('reports');
  });

  it('hashes a network per post', async () => {
    const a = await communityNetworkHash('p1', '203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await communityNetworkHash('p1', '203.0.113.7')).toBe(a);
    expect(await communityNetworkHash('p2', '203.0.113.7')).not.toBe(a);
  });
});

describe('a copy through a Community link', () => {
  it('carries the board without its comments or the people on its actions', async () => {
    addDocument('d1');
    const tab = {
      elements: [
        {
          id: 'e1',
          type: 'shape',
          commentThread: {
            comments: [{ id: 'c1', text: 'private note', authorId: 'user_author' }],
          },
          action: {
            id: 'a1',
            name: 'Follow up',
            description: '',
            assignee: { userId: 'user_jane', name: 'Jane' },
            teamId: null,
            assignerId: 'user_author',
            assignerName: 'Ada',
            status: 'open',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
    };
    db.sql
      .prepare("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab', ?, 1)")
      .run(JSON.stringify(tab));
    db.sql
      .prepare(
        "INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1)",
      )
      .run();

    await copyDocument(db.env, 'd1', 'copy-1', 'guest-copier', 'Copy', null, true);
    const copied = db.sql
      .prepare(
        "SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = 'copy-1'",
      )
      .get() as { data: string };
    expect(copied.data).toContain('Follow up');
    for (const s of ['private note', 'user_jane', 'Jane', 'Ada', 'commentThread']) {
      expect(copied.data).not.toContain(s);
    }
    // Nothing private reaches the copier's activity index either.
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM collab_threads').get()).toEqual({ n: 0 });

    // An ordinary copy is unchanged.
    await copyDocument(db.env, 'd1', 'copy-2', 'user_author', 'Copy', null);
    const plain = db.sql
      .prepare(
        "SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = 'copy-2'",
      )
      .get() as { data: string };
    expect(plain.data).toContain('private note');
  });
});

describe('featured on the home page', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = 400 * DAY;

  it('ranks by likes in the last three months, then tops up with the best of all time', async () => {
    const old = await publish('d1', { title: 'Old favourite' }, 1);
    const fresh = await publish('d2', { title: 'Fresh hit' }, 2);
    const quiet = await publish('d3', { title: 'Quiet' }, 3);
    // Old favourite: many likes, all long ago.
    for (const k of ['k1', 'k2', 'k3'])
      await setCommunityLike(db.env, old, k, true, null, NOW - 200 * DAY);
    // Fresh hit: two recent likes.
    for (const k of ['k4', 'k5'])
      await setCommunityLike(db.env, fresh, k, true, null, NOW - 5 * DAY);
    const titles = (await listFeaturedCommunityPosts(db.env, NOW)).map((r) => r.title);
    expect(titles[0]).toBe('Fresh hit');
    expect(titles).toEqual(['Fresh hit', 'Old favourite', 'Quiet']);
    void quiet;
  });

  it('counts no more than five likes from one network toward the ranking', async () => {
    const crowd = await publish('d1', { title: 'One network' }, 1);
    const spread = await publish('d2', { title: 'Many networks' }, 2);
    for (let i = 0; i < 20; i++) {
      await setCommunityLike(db.env, crowd, `k${i}`, true, 'net-one', NOW - DAY);
    }
    for (let i = 0; i < 6; i++) {
      await setCommunityLike(db.env, spread, `s${i}`, true, `net-${i}`, NOW - DAY);
    }
    const titles = (await listFeaturedCommunityPosts(db.env, NOW)).map((r) => r.title);
    expect(titles.slice(0, 2)).toEqual(['Many networks', 'One network']);
  });

  it('is at most six, and only public posts', async () => {
    for (let i = 0; i < 8; i++) await publish(`d${i}`, { title: `P${i}` }, i);
    db.sql.prepare("UPDATE community_posts SET state = 'hidden' WHERE title = 'P7'").run();
    const rows = await listFeaturedCommunityPosts(db.env, NOW);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.title)).not.toContain('P7');
  });
});
