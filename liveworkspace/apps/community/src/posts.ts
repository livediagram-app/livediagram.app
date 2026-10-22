// Community posts (liveworkspace/docs/community.md): what an app's Worker writes (publish, Edit Listing,
// remove, and where each post's document stands), and the public reads (list, facets, one post, related,
// featured, sitemap), every one of them for one app. Likes, copies and reports are in engagement.ts.

import {
  COMMUNITY_COUNTED_PER_NETWORK,
  COMMUNITY_FEATURED_COUNT,
  COMMUNITY_FEATURED_WINDOW_MS,
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_POPULAR_TAGS,
  COMMUNITY_RELATED_POSTS,
  COMMUNITY_SITEMAP_MAX,
  communitySearchTags,
  communitySearchTerms,
  type CommunityApp,
  type CommunityAppPublish,
  type CommunityAppSync,
  type CommunityCategory,
  type CommunityFacetsResponse,
  type CommunityListQuery,
  type CommunityMineTotals,
  type CommunitySitemapEntry,
} from '@liveworkspace/community';
import type { Env } from './env';
import { likePattern, newPostId, POST_COLS, PUBLIC_POST, searchText, type PostRow } from './rows';

// The post an app's document has, in any state.
export async function getPostForDocument(
  env: Env,
  app: CommunityApp,
  document: string,
): Promise<PostRow | null> {
  return env.COMMUNITY_DB.prepare(
    `SELECT ${POST_COLS} FROM posts p WHERE p.app = ? AND p.document = ?`,
  )
    .bind(app, document)
    .first<PostRow>();
}

// One post as the public sees it: null when missing, another app's, hidden, or its document not public.
export async function getPublicPost(
  env: Env,
  app: CommunityApp,
  postId: string,
): Promise<PostRow | null> {
  return env.COMMUNITY_DB.prepare(
    `SELECT ${POST_COLS} FROM posts p WHERE ${PUBLIC_POST} AND p.id = ?`,
  )
    .bind(app, postId)
    .first<PostRow>();
}

export async function countPostsByOwner(
  env: Env,
  app: CommunityApp,
  owner: string,
): Promise<number> {
  const row = await env.COMMUNITY_DB.prepare(
    'SELECT COUNT(*) AS n FROM posts WHERE app = ? AND owner = ?',
  )
    .bind(app, owner)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// The tag rows for a post, replacing whatever it had: the display array and the filter table are
// rewritten together.
function tagStatements(env: Env, postId: string, tags: string[]): D1PreparedStatement[] {
  return [
    env.COMMUNITY_DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId),
    ...tags.map((tag) =>
      env.COMMUNITY_DB.prepare('INSERT INTO post_tags (post_id, tag) VALUES (?, ?)').bind(
        postId,
        tag,
      ),
    ),
  ];
}

// Publish: the post and its tags in one batch. A collision on the id fails the batch whole and is
// retried once with a fresh one; a second post for the same document is a real conflict, rethrown.
export async function createPost(
  env: Env,
  app: CommunityApp,
  document: string,
  publish: CommunityAppPublish,
  now: number = Date.now(),
): Promise<string> {
  const { input, author } = publish;
  const attempt = async (): Promise<string> => {
    const postId = newPostId();
    await env.COMMUNITY_DB.batch([
      env.COMMUNITY_DB.prepare(
        `INSERT INTO posts (id, app, document, share_code, owner, author_name, author_color, author_picture,
           anonymous, title, description, category, tags, search_text, document_state, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        postId,
        app,
        document,
        publish.shareCode,
        publish.owner,
        author.name,
        author.color,
        author.picture,
        input.anonymous ? 1 : 0,
        input.title,
        input.description,
        input.category,
        JSON.stringify(input.tags),
        searchText(input.title, input.description, input.tags),
        publish.documentState,
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
    if (!String(err).includes('posts.id')) throw err;
    console.warn('[community] publish retried after an id collision');
    return attempt();
  }
}

// Edit Listing: the details, the author's look and the document's state change; likes,
// copies, state and the publish date stay.
export async function updatePost(
  env: Env,
  postId: string,
  publish: CommunityAppPublish,
  now: number = Date.now(),
): Promise<void> {
  const { input, author } = publish;
  await env.COMMUNITY_DB.batch([
    env.COMMUNITY_DB.prepare(
      `UPDATE posts SET title = ?, description = ?, category = ?, tags = ?, search_text = ?, anonymous = ?,
         author_name = ?, author_color = ?, author_picture = ?, share_code = ?, document_state = ?,
         updated_at = ?
       WHERE id = ?`,
    ).bind(
      input.title,
      input.description,
      input.category,
      JSON.stringify(input.tags),
      searchText(input.title, input.description, input.tags),
      input.anonymous ? 1 : 0,
      author.name,
      author.color,
      author.picture,
      publish.shareCode,
      publish.documentState,
      now,
      postId,
    ),
    ...tagStatements(env, postId, input.tags),
  ]);
}

// Remove From Community: the post goes, its tags, likes, copies and reports with it.
export async function deletePost(env: Env, postId: string): Promise<void> {
  await env.COMMUNITY_DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
}

// What an app says changed about its posts' documents: each one's state, and the ones deleted for
// good. One batch, so a sync lands whole or not at all, and one statement per state rather than per
// document: D1 counts statements against a Worker invocation's query limit, so a sync of 500 documents
// is at most 4 statements, not 500.
export async function syncDocuments(
  env: Env,
  app: CommunityApp,
  sync: CommunityAppSync,
): Promise<void> {
  const byState = new Map<string, string[]>();
  for (const { document, state } of sync.documents) {
    const documents = byState.get(state) ?? [];
    documents.push(document);
    byState.set(state, documents);
  }
  const statements = [
    ...[...byState].map(([state, documents]) =>
      env.COMMUNITY_DB.prepare(
        `UPDATE posts SET document_state = ?
          WHERE app = ? AND document IN (SELECT value FROM json_each(?))`,
      ).bind(state, app, JSON.stringify(documents)),
    ),
    ...(sync.gone.length > 0
      ? [
          env.COMMUNITY_DB.prepare(
            'DELETE FROM posts WHERE app = ? AND document IN (SELECT value FROM json_each(?))',
          ).bind(app, JSON.stringify(sync.gone)),
        ]
      : []),
  ];
  if (statements.length > 0) await env.COMMUNITY_DB.batch(statements);
}

// The app's posts hidden after reports at or after `since`.
export async function listHiddenSince(
  env: Env,
  app: CommunityApp,
  since: number,
): Promise<{ document: string; hiddenAt: number }[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT document, hidden_at FROM posts WHERE app = ? AND hidden_at IS NOT NULL AND hidden_at >= ?
      ORDER BY hidden_at`,
  )
    .bind(app, since)
    .all<{ document: string; hidden_at: number }>();
  return (result.results ?? []).map((r) => ({ document: r.document, hiddenAt: r.hidden_at }));
}

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

// The gallery page: one indexed query, one extra row to decide whether there is a next page. With
// `owner`, My Shares: only that owner's posts, hidden ones included.
export async function listPosts(
  env: Env,
  app: CommunityApp,
  query: CommunityListQuery,
  owner: string | null = null,
): Promise<{ rows: PostRow[]; nextOffset: number | null }> {
  const where = owner ? [OWN_POST] : [PUBLIC_POST];
  const binds: (string | number)[] = owner ? [app, owner] : [app];
  if (query.category) {
    where.push('p.category = ?');
    binds.push(query.category);
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

// The filter counts: posts per category and the most used tags, over what the public can see.
export async function facets(env: Env, app: CommunityApp): Promise<CommunityFacetsResponse> {
  const [categories, tags] = await env.COMMUNITY_DB.batch<{ key: string; n: number }>([
    env.COMMUNITY_DB.prepare(
      `SELECT p.category AS key, COUNT(*) AS n FROM posts p WHERE ${PUBLIC_POST} GROUP BY p.category`,
    ).bind(app),
    env.COMMUNITY_DB.prepare(
      `SELECT t.tag AS key, COUNT(*) AS n FROM post_tags t JOIN posts p ON p.id = t.post_id
        WHERE ${PUBLIC_POST} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?`,
    ).bind(app, COMMUNITY_POPULAR_TAGS),
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
