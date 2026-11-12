// Community posts (liveworkspace/docs/specs/007-community/community.md): what an app's Worker writes (publish, Edit Listing,
// remove, and where each post's document stands), and the one-post reads, every one of them for one app. The public
// listings (list, facets, related, featured, Start With, sitemap) are in post-listings.ts, re-exported here. Likes,
// copies and reports are in engagement.ts.

import {
  COMMUNITY_POSTS_PER_AUTHOR,
  type CommunityApp,
  type CommunityAppPublish,
  type CommunityAppSync,
} from '@liveworkspace/community';
import type { Env } from './env';
import { newPostId, POST_COLS, PUBLIC_POST, searchText, type PostRow } from './rows';

export {
  facets,
  listFeaturedPosts,
  listPosts,
  listRelatedPosts,
  listSitemap,
  listStartPosts,
  mineTotals,
  START_POSTS_SQL,
} from './post-listings';

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
// rewritten together. Each goes in only while the post is there (a publish refused at the cap writes none).
function tagStatements(env: Env, postId: string, tags: string[]): D1PreparedStatement[] {
  return [
    env.COMMUNITY_DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId),
    ...tags.map((tag) =>
      env.COMMUNITY_DB.prepare(
        'INSERT INTO post_tags (post_id, tag) SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM posts WHERE id = ?1)',
      ).bind(postId, tag),
    ),
  ];
}

// Publish: the post and its tags in one batch. A collision on the id fails the batch whole and is
// retried once with a fresh one; a second post for the same document is a real conflict, rethrown. The owner's cap
// (COMMUNITY_POSTS_PER_AUTHOR) is checked again inside the insert, so publishes racing past the route's count can't
// together go over: null when it refused. `replacing` names a post the document's previous owner made, deleted in the
// same batch under the same cap check, so a publish that fails or is refused leaves it as it was.
export async function createPost(
  env: Env,
  app: CommunityApp,
  document: string,
  publish: CommunityAppPublish,
  now: number = Date.now(),
  replacing?: string,
): Promise<string | null> {
  const { input, author } = publish;
  const underCap = '(SELECT COUNT(*) FROM posts WHERE app = ? AND owner = ?) < ?';
  const attempt = async (): Promise<string | null> => {
    const postId = newPostId();
    // The previous owner's post isn't this owner's, so its going leaves the count the insert checks as it was.
    const replace = replacing
      ? [
          env.COMMUNITY_DB.prepare(`DELETE FROM posts WHERE id = ? AND ${underCap}`).bind(
            replacing,
            app,
            publish.owner,
            COMMUNITY_POSTS_PER_AUTHOR,
          ),
        ]
      : [];
    const results = await env.COMMUNITY_DB.batch([
      ...replace,
      env.COMMUNITY_DB.prepare(
        `INSERT INTO posts (id, app, document, share_code, owner, author_name, author_color, author_picture,
           anonymous, title, description, category, tags, search_text, document_state, published_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE ${underCap}`,
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
        app,
        publish.owner,
        COMMUNITY_POSTS_PER_AUTHOR,
      ),
      ...tagStatements(env, postId, input.tags),
    ]);
    return results[replace.length]?.meta.changes ? postId : null;
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

// An account closed: every post it made in the app goes, its tags, likes, copies and reports with it (hidden ones
// too: no one can publish as a closed account, so nothing is left for hiding to guard).
export async function deleteOwnerPosts(env: Env, app: CommunityApp, owner: string): Promise<void> {
  await env.COMMUNITY_DB.prepare('DELETE FROM posts WHERE app = ? AND owner = ?')
    .bind(app, owner)
    .run();
}

// What an app says changed about its posts' documents: each one's state, and the ones deleted for
// good. One batch, so a sync lands whole or not at all, and one statement per state rather than per
// document: D1 counts statements against a Worker invocation's query limit, so a sync of 500 documents
// is at most 5 statements, not 500. A document gone `away` (the Trash, another owner) removes its post, unless
// hidden after reports: that one stays, set `away`, so hiding stays final (community.md "What lives where").
export async function syncDocuments(
  env: Env,
  app: CommunityApp,
  sync: CommunityAppSync,
): Promise<void> {
  const statements = syncStatements(env, app, sync);
  if (statements.length > 0) await env.COMMUNITY_DB.batch(statements);
}

// The sync's statements, for a caller that batches them with its own (the sweep).
export function syncStatements(
  env: Env,
  app: CommunityApp,
  sync: CommunityAppSync,
): D1PreparedStatement[] {
  const byState = new Map<string, string[]>();
  for (const { document, state } of sync.documents) {
    const documents = byState.get(state) ?? [];
    documents.push(document);
    byState.set(state, documents);
  }
  const away = byState.get('away');
  const statements = [
    ...(away
      ? [
          env.COMMUNITY_DB.prepare(
            `DELETE FROM posts WHERE app = ? AND state = 'listed'
              AND document IN (SELECT value FROM json_each(?))`,
          ).bind(app, JSON.stringify(away)),
        ]
      : []),
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
  return statements;
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
