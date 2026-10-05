// Community posts (docs/specs/025-community/community.md; blueprint docs/specs/025-community/blueprints/community.md
// §3 and §5): publish, Edit Listing, remove, and the public reads (list, facets, one post, related). Likes, copies,
// reports (and the automatic hiding they cause) live in community-engagement.ts.

import {
  type CommunityMineTotals,
  COMMUNITY_FEATURED_COUNT,
  COMMUNITY_FEATURED_WINDOW_MS,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_POPULAR_TAGS,
  COMMUNITY_RELATED_POSTS,
  communitySearchTags,
  communitySearchTerms,
  type CommunityCategory,
  type CommunityFacetsResponse,
  type CommunityListQuery,
  type CommunityPostInput,
} from '@livediagram/api-schema';
import {
  COMMUNITY_POST_COLS,
  COMMUNITY_POST_FROM,
  communitySearchText,
  likePattern,
  type CommunityPostRow,
} from '../community-row';
import type { Env } from '../types';
import { generateShareCode } from './share';

// G4: what every public read sees. A hidden post, a post whose document sits in the Trash, and one whose document
// has since moved into a team library (team documents cannot be published) are all invisible.
export const PUBLIC_POST = "cp.state = 'listed' AND d.trashed_at IS NULL AND d.team_id IS NULL";

// The post a document has, in any state, trashed or not: the owner's view of it.
export async function getCommunityPostForDocument(
  env: Env,
  documentId: string,
): Promise<CommunityPostRow | null> {
  return env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM} WHERE cp.document_id = ?`,
  )
    .bind(documentId)
    .first<CommunityPostRow>();
}

// The post behind a community link, in any state: the share resolve and the copy count read it.
export async function getCommunityPostByShareCode(
  env: Env,
  shareCode: string,
): Promise<CommunityPostRow | null> {
  return env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM} WHERE cp.share_code = ?`,
  )
    .bind(shareCode)
    .first<CommunityPostRow>();
}

// Whether a Community post's link is open to the public right now: 'public' when the post passes the public
// rule (listed, its document not in the Trash nor a team library), 'closed' when the post exists but does
// not, null when the code is no post's link. One rule for every door that reads through the link.
export async function communityLinkAccess(
  env: Env,
  shareCode: string,
): Promise<'public' | 'closed' | null> {
  const row = await env.DB.prepare(
    `SELECT (${PUBLIC_POST}) AS open FROM community_posts cp JOIN documents d ON d.id = cp.document_id
      WHERE cp.share_code = ?`,
  )
    .bind(shareCode)
    .first<{ open: number }>();
  if (!row) return null;
  return row.open ? 'public' : 'closed';
}

// One post as the public sees it: null when missing, hidden or trashed.
export async function getPublicCommunityPost(
  env: Env,
  postId: string,
): Promise<CommunityPostRow | null> {
  return env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM} WHERE cp.id = ? AND ${PUBLIC_POST}`,
  )
    .bind(postId)
    .first<CommunityPostRow>();
}

export async function countCommunityPostsByAuthor(env: Env, authorId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM community_posts WHERE author_id = ?')
    .bind(authorId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// The tag rows for a post, replacing whatever it had: the display array and the filter table are rewritten together.
function tagStatements(env: Env, postId: string, tags: string[]): D1PreparedStatement[] {
  return [
    env.DB.prepare('DELETE FROM community_post_tags WHERE post_id = ?').bind(postId),
    ...tags.map((tag) =>
      env.DB.prepare('INSERT INTO community_post_tags (post_id, tag) VALUES (?, ?)').bind(
        postId,
        tag,
      ),
    ),
  ];
}

// Publish: the community link (view role, never expiring, all tabs) and the post in one batch, so a post never
// exists without its link nor a link without its post. Ids come from the share-code alphabet (D2); a collision on
// either primary key fails the batch whole and is retried once with fresh ids.
export async function createCommunityPost(
  env: Env,
  documentId: string,
  authorId: string,
  input: CommunityPostInput,
  now: number = Date.now(),
): Promise<string> {
  const attempt = async (): Promise<string> => {
    const postId = generateShareCode(10);
    const shareCode = generateShareCode();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO share_links (code, document_id, role, created_at, expiry, expires_at, tab_id, purpose) VALUES (?, ?, 'view', ?, NULL, NULL, NULL, 'community')",
      ).bind(shareCode, documentId, now),
      env.DB.prepare(
        `INSERT INTO community_posts (id, document_id, share_code, author_id, title, description, category, tags,
           search_text, anonymous, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        postId,
        documentId,
        shareCode,
        authorId,
        input.title,
        input.description,
        input.category,
        JSON.stringify(input.tags),
        communitySearchText(input.title, input.description, input.tags),
        input.anonymous ? 1 : 0,
        now,
        now,
      ),
      ...tagStatements(env, postId, input.tags),
    ]);
    return postId;
  };
  try {
    return await attempt();
  } catch (err) {
    // A UNIQUE failure on document_id is a real conflict (a concurrent publish), not an id collision: rethrow it.
    if (String(err).includes('community_posts.document_id')) throw err;
    console.warn('[community] publish retried after an id collision');
    return attempt();
  }
}

// Edit Listing: the details change; likes, copies, state and the publish date stay.
export async function updateCommunityPost(
  env: Env,
  postId: string,
  input: CommunityPostInput,
  now: number = Date.now(),
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE community_posts SET title = ?, description = ?, category = ?, tags = ?, search_text = ?, anonymous = ?,
        updated_at = ? WHERE id = ?`,
    ).bind(
      input.title,
      input.description,
      input.category,
      JSON.stringify(input.tags),
      communitySearchText(input.title, input.description, input.tags),
      input.anonymous ? 1 : 0,
      now,
      postId,
    ),
    ...tagStatements(env, postId, input.tags),
  ]);
}

// Remove From Community: deleting the community link cascades the post, its tags, likes, copies and reports.
export async function deleteCommunityPost(env: Env, shareCode: string): Promise<void> {
  await env.DB.prepare("DELETE FROM share_links WHERE code = ? AND purpose = 'community'")
    .bind(shareCode)
    .run();
}

const ORDER_BY: Record<CommunityListQuery['sort'], string> = {
  new: 'cp.published_at DESC, cp.id',
  loved: 'cp.like_count DESC, cp.published_at DESC, cp.id',
  copied: 'cp.copy_count DESC, cp.published_at DESC, cp.id',
};

// An author's own posts, whatever their state (My Shares).
const OWN_POST = 'cp.author_id = ? AND d.trashed_at IS NULL';

// How popular an author's posts are altogether (My Shares), over every post they have, whatever the filter.
export async function communityMineTotals(
  env: Env,
  authorId: string,
): Promise<CommunityMineTotals> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS posts, COALESCE(SUM(cp.like_count), 0) AS likes, COALESCE(SUM(cp.copy_count), 0) AS copies
       FROM community_posts cp JOIN documents d ON d.id = cp.document_id
      WHERE ${OWN_POST}`,
  )
    .bind(authorId)
    .first<CommunityMineTotals>();
  return row ?? { posts: 0, likes: 0, copies: 0 };
}

// The gallery page (blueprint §8): one indexed query, one extra row to decide whether there is a next page.
export async function listCommunityPosts(
  env: Env,
  query: CommunityListQuery,
  // My Shares: only this author's posts, hidden ones included (not trashed ones: those are gone for the
  // author too), instead of what the public can see.
  authorId: string | null = null,
): Promise<{ rows: CommunityPostRow[]; nextOffset: number | null }> {
  const where = authorId ? [OWN_POST] : [PUBLIC_POST];
  const binds: (string | number)[] = authorId ? [authorId] : [];
  if (query.category) {
    where.push('cp.category = ?');
    binds.push(query.category);
  }
  // Every tag asked for must be on the post: the `tag` parameter and each `#tag` in the search.
  const tags = [...new Set([...(query.tag ? [query.tag] : []), ...communitySearchTags(query.q)])];
  for (const tag of tags) {
    where.push(
      'EXISTS (SELECT 1 FROM community_post_tags t WHERE t.post_id = cp.id AND t.tag = ?)',
    );
    binds.push(tag);
  }
  for (const term of communitySearchTerms(query.q)) {
    where.push("cp.search_text LIKE ? ESCAPE '\\'");
    binds.push(likePattern(term));
  }
  const result = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM}
      WHERE ${where.join(' AND ')}
      ORDER BY ${ORDER_BY[query.sort]}
      LIMIT ? OFFSET ?`,
  )
    .bind(...binds, COMMUNITY_PAGE_SIZE + 1, query.offset)
    .all<CommunityPostRow>();
  const rows = result.results ?? [];
  const more = rows.length > COMMUNITY_PAGE_SIZE;
  return {
    rows: more ? rows.slice(0, COMMUNITY_PAGE_SIZE) : rows,
    nextOffset: more ? query.offset + COMMUNITY_PAGE_SIZE : null,
  };
}

// More Like This (D8): the same category, most liked first, the post itself left out.
export async function listRelatedCommunityPosts(
  env: Env,
  postId: string,
  category: CommunityCategory,
): Promise<CommunityPostRow[]> {
  const result = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM}
      WHERE ${PUBLIC_POST} AND cp.category = ? AND cp.id != ?
      ORDER BY cp.like_count DESC, cp.published_at DESC
      LIMIT ?`,
  )
    .bind(category, postId, COMMUNITY_RELATED_POSTS)
    .all<CommunityPostRow>();
  return result.results ?? [];
}

// The filter counts: posts per category and the most used tags, over what the public can see.
export async function communityFacets(env: Env): Promise<CommunityFacetsResponse> {
  const [categories, tags] = await env.DB.batch<{ key: string; n: number }>([
    env.DB.prepare(
      `SELECT cp.category AS key, COUNT(*) AS n FROM community_posts cp JOIN documents d ON d.id = cp.document_id
        WHERE ${PUBLIC_POST} GROUP BY cp.category`,
    ),
    env.DB.prepare(
      `SELECT t.tag AS key, COUNT(*) AS n FROM community_post_tags t
         JOIN community_posts cp ON cp.id = t.post_id JOIN documents d ON d.id = cp.document_id
        WHERE ${PUBLIC_POST} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?`,
    ).bind(COMMUNITY_POPULAR_TAGS),
  ]);
  const categoryCounts: CommunityFacetsResponse['categories'] = {};
  let total = 0;
  for (const row of categories?.results ?? []) {
    categoryCounts[row.key as CommunityCategory] = row.n;
    total += row.n;
  }
  return {
    total,
    categories: categoryCounts,
    tags: (tags?.results ?? []).map((row) => ({ tag: row.key, count: row.n })),
  };
}

// The landing page's six (docs/specs/025-community/community.md "Featured on the home page"): the posts
// most liked over the last COMMUNITY_FEATURED_WINDOW_MS, then, while there are fewer than six, the best of
// all time (likes and copies together, newest first on a tie). Public posts only.
export async function listFeaturedCommunityPosts(
  env: Env,
  now: number = Date.now(),
): Promise<CommunityPostRow[]> {
  const recent = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS},
            (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = cp.id AND l.created_at >= ?) AS recent_likes
       FROM ${COMMUNITY_POST_FROM}
      WHERE ${PUBLIC_POST} AND recent_likes > 0
      ORDER BY recent_likes DESC, cp.like_count DESC, cp.published_at DESC
      LIMIT ?`,
  )
    .bind(now - COMMUNITY_FEATURED_WINDOW_MS, COMMUNITY_FEATURED_COUNT)
    .all<CommunityPostRow>();
  const rows = recent.results ?? [];
  if (rows.length >= COMMUNITY_FEATURED_COUNT) return rows;
  const fill = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM}
      WHERE ${PUBLIC_POST} AND cp.id NOT IN (SELECT value FROM json_each(?))
      ORDER BY (cp.like_count + cp.copy_count) DESC, cp.published_at DESC
      LIMIT ?`,
  )
    .bind(JSON.stringify(rows.map((r) => r.id)), COMMUNITY_FEATURED_COUNT - rows.length)
    .all<CommunityPostRow>();
  return [...rows, ...(fill.results ?? [])];
}
