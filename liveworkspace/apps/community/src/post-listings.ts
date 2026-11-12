// The Community's public listings (liveworkspace/docs/specs/007-community/community.md), for one app or every app: the
// gallery page, My Shares and its totals, More Like This, the sitemap, the filter counts, the home page's featured
// posts and Start With's tiles. The writes and the one-post reads are in posts.ts, which re-exports these.

import {
  COMMUNITY_COUNTED_PER_NETWORK,
  COMMUNITY_FEATURED_COUNT,
  COMMUNITY_FEATURED_WINDOW_MS,
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_POPULAR_TAGS,
  COMMUNITY_RELATED_POSTS,
  COMMUNITY_SITEMAP_MAX,
  COMMUNITY_START_MIN_LIKES,
  COMMUNITY_START_PER_CATEGORY,
  COMMUNITY_START_WINDOW_MS,
  communitySearchTags,
  communitySearchTerms,
  type CommunityApp,
  type CommunityCategory,
  type CommunityFacetsResponse,
  type CommunityListQuery,
  type CommunityMineTotals,
  type CommunityScope,
  type CommunitySitemapEntry,
} from '@liveworkspace/community';
import type { Env } from './env';
import { likePattern, POST_COLS, PUBLIC_POST, publicWhere, type PostRow } from './rows';

const ORDER_BY: Record<CommunityListQuery['sort'], string> = {
  new: 'p.published_at DESC, p.id',
  loved: 'p.like_count DESC, p.published_at DESC, p.id',
  copied: 'p.copy_count DESC, p.published_at DESC, p.id',
};

// An owner's own posts in an app (My Shares), hidden ones and closed ones included, but not one whose
// document is away: in the Trash it is gone for the author too, and a document that changed hands is
// no longer theirs.
const OWN_POST = "p.app = ? AND p.owner = ? AND p.document_state <> 'away'";

// How popular an owner's posts are altogether (My Shares), whatever the filter.
export async function mineTotals(
  env: Env,
  app: CommunityApp,
  owner: string,
): Promise<CommunityMineTotals> {
  const row = await env.COMMUNITY_DB.prepare(
    `SELECT COUNT(*) AS posts, COALESCE(SUM(p.like_count), 0) AS likes,
            COALESCE(SUM(p.copy_count), 0) AS copies
       FROM posts p WHERE ${OWN_POST}`,
  )
    .bind(app, owner)
    .first<CommunityMineTotals>();
  return row ?? { posts: 0, likes: 0, copies: 0 };
}

// The gallery page: one indexed query, one extra row to decide whether there is a next page. `all` lists every app's
// posts together (All Apps), on the indexes that lead with the state rather than the app (migration 0002). With
// `owner`, My Shares: only that owner's posts in one app, hidden ones included.
export async function listPosts(
  env: Env,
  app: CommunityScope,
  query: CommunityListQuery,
  owner: string | null = null,
): Promise<{ rows: PostRow[]; nextOffset: number | null }> {
  const own = owner !== null && app !== 'all';
  const first = own ? { where: OWN_POST, binds: [app, owner] } : publicWhere(app);
  const where = [first.where];
  const binds: (string | number)[] = [...first.binds];
  if (query.category) {
    where.push('p.category = ?');
    binds.push(query.category);
  }
  // A category named with its app (All Apps' menu, `category:liveplanner/planning`): that app's posts only. Served by
  // idx_posts_category (app, category, state, document_state, published_at).
  if (query.category && query.categoryApp) {
    where.push('p.app = ?');
    binds.push(query.categoryApp);
  }
  // Every tag asked for must be on the post: the `tag` parameter and each `#tag` in the search.
  const tags = [...new Set([...(query.tag ? [query.tag] : []), ...communitySearchTags(query.q)])];
  for (const tag of tags) {
    where.push('EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag = ?)');
    binds.push(tag);
  }
  for (const term of communitySearchTerms(query.q)) {
    where.push("p.search_text LIKE ? ESCAPE '\\'");
    binds.push(likePattern(term));
  }
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${POST_COLS} FROM posts p
      WHERE ${where.join(' AND ')}
      ORDER BY ${ORDER_BY[query.sort]}
      LIMIT ? OFFSET ?`,
  )
    .bind(...binds, COMMUNITY_PAGE_SIZE + 1, query.offset)
    .all<PostRow>();
  const rows = result.results ?? [];
  const more = rows.length > COMMUNITY_PAGE_SIZE;
  return {
    rows: more ? rows.slice(0, COMMUNITY_PAGE_SIZE) : rows,
    // No page past the deepest offset a query may ask for: it would be clamped back to this one, and
    // Load More would append the same page forever.
    nextOffset:
      more && query.offset + COMMUNITY_PAGE_SIZE <= COMMUNITY_MAX_OFFSET
        ? query.offset + COMMUNITY_PAGE_SIZE
        : null,
  };
}

// More Like This: the same app and category, most liked first, the post itself left out.
export async function listRelatedPosts(
  env: Env,
  app: CommunityApp,
  postId: string,
  category: CommunityCategory,
): Promise<PostRow[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${POST_COLS} FROM posts p
      WHERE ${PUBLIC_POST} AND p.category = ? AND p.id != ?
      ORDER BY p.like_count DESC, p.published_at DESC
      LIMIT ?`,
  )
    .bind(app, category, postId, COMMUNITY_RELATED_POSTS)
    .all<PostRow>();
  return result.results ?? [];
}

// The sitemap's posts: every public post of the app, newest first, ids and update times only.
export async function listSitemap(env: Env, app: CommunityApp): Promise<CommunitySitemapEntry[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT p.id AS id, p.updated_at AS updated_at FROM posts p
      WHERE ${PUBLIC_POST}
      ORDER BY p.published_at DESC, p.id
      LIMIT ?`,
  )
    .bind(app, COMMUNITY_SITEMAP_MAX)
    .all<{ id: string; updated_at: number }>();
  return (result.results ?? []).map((r) => ({ id: r.id, updatedAt: r.updated_at }));
}

// The filter counts: posts per category and the most used tags, over what the public can see of one app, or of
// every app (`all`). Counted per app and category, so All Apps' menu can count each app's own (`apps`); one app's
// answer is the same rows with one app.
export async function facets(env: Env, app: CommunityScope): Promise<CommunityFacetsResponse> {
  const { where, binds } = publicWhere(app);
  const [categories, tags] = await env.COMMUNITY_DB.batch<{ app: string; key: string; n: number }>([
    env.COMMUNITY_DB.prepare(
      `SELECT p.app AS app, p.category AS key, COUNT(*) AS n FROM posts p WHERE ${where}
        GROUP BY p.app, p.category`,
    ).bind(...binds),
    env.COMMUNITY_DB.prepare(
      `SELECT t.tag AS key, COUNT(*) AS n FROM post_tags t JOIN posts p ON p.id = t.post_id
        WHERE ${where} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?`,
    ).bind(...binds, COMMUNITY_POPULAR_TAGS),
  ]);
  const categoryCounts: CommunityFacetsResponse['categories'] = {};
  const apps: NonNullable<CommunityFacetsResponse['apps']> = {};
  let total = 0;
  for (const row of categories?.results ?? []) {
    const key = row.key as CommunityCategory;
    categoryCounts[key] = (categoryCounts[key] ?? 0) + row.n;
    const own = (apps[row.app as CommunityApp] ??= {});
    own[key] = row.n;
    total += row.n;
  }
  return {
    total,
    categories: categoryCounts,
    ...(app === 'all' ? { apps } : {}),
    tags: (tags?.results ?? []).map((row) => ({ tag: row.key, count: row.n })),
  };
}

// The home page's six: the app's posts most liked over the last COMMUNITY_FEATURED_WINDOW_MS, then,
// while there are fewer than six, its best of all time (likes and copies together, newest first on a
// tie). Public posts only.
export async function listFeaturedPosts(
  env: Env,
  app: CommunityApp,
  now: number = Date.now(),
): Promise<PostRow[]> {
  // The window's likes in one pass over the created_at index (named, since the planner otherwise walks
  // the whole table in primary-key order to suit the GROUP BY), grouped by post and network and capped
  // per network like the like count itself, so one network cannot buy a place on the home page.
  const recent = await env.COMMUNITY_DB.prepare(
    `WITH recent AS (
       SELECT post_id, SUM(MIN(n, ?)) AS recent_likes FROM (
         SELECT post_id, COUNT(*) AS n FROM likes INDEXED BY idx_likes_created
          WHERE created_at >= ?
          GROUP BY post_id, network_hash)
        GROUP BY post_id)
     SELECT ${POST_COLS}
       FROM recent JOIN posts p ON p.id = recent.post_id
      WHERE ${PUBLIC_POST}
      ORDER BY recent.recent_likes DESC, p.like_count DESC, p.published_at DESC
      LIMIT ?`,
  )
    .bind(
      COMMUNITY_COUNTED_PER_NETWORK,
      now - COMMUNITY_FEATURED_WINDOW_MS,
      app,
      COMMUNITY_FEATURED_COUNT,
    )
    .all<PostRow>();
  const rows = recent.results ?? [];
  if (rows.length >= COMMUNITY_FEATURED_COUNT) return rows;
  const fill = await env.COMMUNITY_DB.prepare(
    `SELECT ${POST_COLS} FROM posts p
      WHERE ${PUBLIC_POST} AND p.id NOT IN (SELECT value FROM json_each(?))
      ORDER BY (p.like_count + p.copy_count) DESC, p.published_at DESC
      LIMIT ?`,
  )
    .bind(app, JSON.stringify(rows.map((r) => r.id)), COMMUNITY_FEATURED_COUNT - rows.length)
    .all<PostRow>();
  return [...rows, ...(fill.results ?? [])];
}

// Start With's Community tiles (liveworkspace/docs/specs/007-community/community.md "Start With"): for every category of
// the app, up to COMMUNITY_START_PER_CATEGORY public posts, ranked by the likes they received in the last
// COMMUNITY_START_WINDOW_MS (capped per network, as the like count and the featured six are), then copies, then newest.
// Only posts with at least COMMUNITY_START_MIN_LIKES likes in that window qualify.
// One statement for every category, never one per category, and no UNION (production D1 refuses a compound of more
// than five terms): the app's public posts on their (app, state, document_state) index, each one's likes in the window
// on the covering idx_likes_post_created (migration 0004), so the read grows with the app's own month of likes rather
// than every app's; each qualifying post found again by its key (CROSS JOIN keeps that order: without statistics the
// planner otherwise walks the app's posts a second time); ROW_NUMBER over the category picking each one's best.
// Rows come back ordered by category, then rank.
export async function listStartPosts(
  env: Env,
  app: CommunityApp,
  now: number = Date.now(),
): Promise<PostRow[]> {
  const result = await env.COMMUNITY_DB.prepare(START_POSTS_SQL)
    .bind(
      COMMUNITY_COUNTED_PER_NETWORK,
      now - COMMUNITY_START_WINDOW_MS,
      app,
      COMMUNITY_START_MIN_LIKES,
      app,
      COMMUNITY_START_PER_CATEGORY,
    )
    .all<PostRow>();
  return result.results ?? [];
}

// Exported for the query plan test (posts.test.ts), which checks it stays on its indexes.
export const START_POSTS_SQL = `WITH recent AS (
     SELECT post_id, SUM(MIN(n, ?)) AS recent_likes FROM (
       SELECT l.post_id AS post_id, COUNT(*) AS n
         FROM posts q JOIN likes l INDEXED BY idx_likes_post_created
           ON l.post_id = q.id AND l.created_at >= ?
        WHERE q.app = ? AND q.state = 'listed' AND q.document_state = 'public'
        GROUP BY l.post_id, l.network_hash)
      GROUP BY post_id
     HAVING recent_likes >= ?),
   ranked AS (
     SELECT ${POST_COLS},
            ROW_NUMBER() OVER (
              PARTITION BY p.category
              ORDER BY recent.recent_likes DESC, p.copy_count DESC, p.published_at DESC, p.id
            ) AS place
       FROM recent CROSS JOIN posts p ON p.id = recent.post_id
      WHERE ${PUBLIC_POST})
   SELECT * FROM ranked WHERE place <= ? ORDER BY category, place`;
