// Community posts against a real schema (docs/specs/025-community/blueprints/community.md §13): publish and Edit
// Listing, what the public reads can and cannot see, filters, sorts, search, paging, facets, the cascades, likes,
// copies, reports with automatic hiding, and the operator's decisions.
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
  listCommunityModeration,
  moderateCommunityPost,
  recordCommunityCopy,
  recordCommunityReport,
  setCommunityLike,
} from './community-engagement';
import { listShareLinks, getShareLink } from './share';

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
    await setCommunityLike(db.env, postId, 'k1', true);
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
    await setCommunityLike(db.env, postId, 'k1', true);
    await recordCommunityCopy(db.env, postId, 'copier');
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

describe('public reads', () => {
  it('hide trashed documents and hidden posts, and show them again on restore', async () => {
    const postId = await publish('d1');
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    expect(await getPublicCommunityPost(db.env, postId)).toBeNull();
    expect(await list()).toEqual([]);
    expect((await communityFacets(db.env)).total).toBe(0);
    db.sql.prepare("UPDATE documents SET trashed_at = NULL WHERE id = 'd1'").run();
    expect(await list()).toEqual(['Payments platform']);
    await moderateCommunityPost(db.env, postId, 'hidden');
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
    await setCommunityLike(db.env, a, 'k1', true);
    await setCommunityLike(db.env, a, 'k2', true);
    await setCommunityLike(db.env, b, 'k1', true);
    await recordCommunityCopy(db.env, b, 'p1');
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
    await setCommunityLike(db.env, c, 'k1', true);
    const related = await listRelatedCommunityPosts(db.env, a, 'architecture');
    expect(related.map((r) => r.id)).toEqual([c, b]);
  });
});

describe('likes and copies', () => {
  it('are idempotent per key and per copier', async () => {
    const postId = await publish('d1');
    expect(await setCommunityLike(db.env, postId, 'k1', true)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k1', true)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k2', true)).toBe(2);
    expect([...(await likedPostIds(db.env, 'k1', [postId, 'other']))]).toEqual([postId]);
    expect(await setCommunityLike(db.env, postId, 'k1', false)).toBe(1);
    expect(await setCommunityLike(db.env, postId, 'k1', false)).toBe(1);
    await recordCommunityCopy(db.env, postId, 'p1');
    await recordCommunityCopy(db.env, postId, 'p1');
    await recordCommunityCopy(db.env, postId, 'p2');
    expect((await getCommunityPostForDocument(db.env, 'd1'))!.copy_count).toBe(2);
  });

  it('likedPostIds is empty without a key', async () => {
    const postId = await publish('d1');
    expect((await likedPostIds(db.env, null, [postId])).size).toBe(0);
  });
});

describe('reports and moderation', () => {
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

  it('lists reported and hidden posts for operators, and restoring clears the reports', async () => {
    const reported = await publish('d1', { title: 'Reported' });
    const hidden = await publish('d2', { title: 'Hidden' });
    await publish('d3', { title: 'Fine' });
    await recordCommunityReport(db.env, reported, 'k1', 'n1', 'spam', 'buy now');
    await moderateCommunityPost(db.env, hidden, 'hidden');
    const queue = await listCommunityModeration(db.env);
    expect(queue.map((r) => [r.title, r.state, r.reports.length])).toEqual([
      ['Reported', 'listed', 1],
      ['Hidden', 'hidden', 0],
    ]);
    expect(queue[0]!.reports[0]).toEqual({
      reason: 'spam',
      note: 'buy now',
      createdAt: expect.any(Number),
    });
    expect(await moderateCommunityPost(db.env, reported, 'listed')).toBe(true);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_reports').get()).toEqual({ n: 0 });
    expect(await moderateCommunityPost(db.env, 'missing', 'hidden')).toBe(false);
  });

  it('hashes a network per post', async () => {
    const a = await communityNetworkHash('p1', '203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await communityNetworkHash('p1', '203.0.113.7')).toBe(a);
    expect(await communityNetworkHash('p2', '203.0.113.7')).not.toBe(a);
  });
});
