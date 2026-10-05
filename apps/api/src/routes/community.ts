// /api/community/*: the public Community api (docs/specs/025-community/community.md; blueprint §4 and §5). The public
// routes need no identity; likes and reports carry the browser's community key, which is never an owner id. Only My
// Shares needs a signed-in author. Nobody moderates by hand: enough reports hide a post.

import {
  COMMUNITY_KEY_HEADER,
  COMMUNITY_REPORT_NOTE_MAX,
  isCommunityKey,
  isCommunityReportReason,
  parseCommunityListQuery,
  type CommunityMinePost,
  type CommunityPost,
} from '@livediagram/api-schema';
import { clientIp } from '../client-ip';
import { rowState, rowToCommunityPost, type CommunityPostRow } from '../community-row';
import {
  communityFacets,
  communityMineTotals,
  communityNetworkHash,
  getPublicCommunityPost,
  likedPostIds,
  listCommunityPosts,
  listFeaturedCommunityPosts,
  listRelatedCommunityPosts,
  recordCommunityReport,
  setCommunityLike,
} from '../db';
import { json, noContent, notFound } from '../responses';
import type { Env } from '../types';
import type { RouteContext } from './context';

function communityKeyOf(request: Request): string | null {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  return isCommunityKey(key) ? key : null;
}

async function withLikes(
  env: Env,
  key: string | null,
  rows: CommunityPostRow[],
): Promise<CommunityPost[]> {
  const liked = await likedPostIds(
    env,
    key,
    rows.map((r) => r.id),
  );
  return rows.map((row) => rowToCommunityPost(row, liked.has(row.id)));
}

// Anonymous reads are the same for everyone, so a CDN and the browser may keep them briefly; with a key the
// answer carries that browser's likes and must not be shared.
function listCacheHeaders(key: string | null): HeadersInit {
  return { 'Cache-Control': key ? 'private, no-store' : 'public, max-age=30' };
}

export async function handleCommunity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, url } = ctx;
  const method = request.method;
  const key = communityKeyOf(request);

  // GET /api/community/posts
  if (segments.length === 3 && segments[2] === 'posts' && method === 'GET') {
    const query = parseCommunityListQuery(url.searchParams);
    if (!query.ok) return json({ error: 'invalid_query' }, { status: 400 });
    const { rows, nextOffset } = await listCommunityPosts(env, query.value);
    return json(
      { posts: await withLikes(env, key, rows), nextOffset },
      { headers: listCacheHeaders(key) },
    );
  }

  // GET /api/community/mine: My Shares (docs/specs/025-community/community.md "My Shares"). The signed-in
  // author's own posts under the same search words, hidden ones included, with their totals. Personal, so
  // never cached.
  if (segments.length === 3 && segments[2] === 'mine' && method === 'GET') {
    if (!ctx.clerkUserId) return json({ error: 'sign_in_required' }, { status: 401 });
    const query = parseCommunityListQuery(url.searchParams);
    if (!query.ok) return json({ error: 'invalid_query' }, { status: 400 });
    const [{ rows, nextOffset }, totals] = await Promise.all([
      listCommunityPosts(env, query.value, ctx.clerkUserId),
      communityMineTotals(env, ctx.clerkUserId),
    ]);
    const liked = await withLikes(env, key, rows);
    const posts: CommunityMinePost[] = rows.map((row, i) => ({
      ...liked[i]!,
      state: rowState(row),
      documentId: row.document_id,
    }));
    return json(
      { posts, nextOffset, totals },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // GET /api/community/featured: the landing page's six (docs/specs/025-community/community.md "Featured on
  // the home page"). The same for everyone, so cacheable a little longer, but only for a minute: a post
  // hidden after reports must not linger on the home page.
  if (segments.length === 3 && segments[2] === 'featured' && method === 'GET') {
    const rows = await listFeaturedCommunityPosts(env);
    return json(
      { posts: rows.map((row) => rowToCommunityPost(row, false)) },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  }

  // GET /api/community/facets
  if (segments.length === 3 && segments[2] === 'facets' && method === 'GET') {
    return json(await communityFacets(env), { headers: listCacheHeaders(null) });
  }

  if (segments[2] !== 'posts' || segments.length < 4) return notFound();
  const postId = segments[3]!;

  // GET /api/community/posts/<id>
  if (segments.length === 4 && method === 'GET') {
    const row = await getPublicCommunityPost(env, postId);
    if (!row) return notFound();
    const related = await listRelatedCommunityPosts(
      env,
      row.id,
      rowToCommunityPost(row, false).category,
    );
    const [post, ...rest] = await withLikes(env, key, [row, ...related]);
    return json({ post, related: rest }, { headers: listCacheHeaders(key) });
  }

  // Likes and reports: a community key, on a post the public can see.
  const isLike = segments[4] === 'like' && (method === 'PUT' || method === 'DELETE');
  const isReport = segments[4] === 'report' && method === 'POST';
  if (segments.length === 5 && (isLike || isReport)) {
    if (!key) return json({ error: 'community_key_required' }, { status: 400 });
    const row = await getPublicCommunityPost(env, postId);
    if (!row) return notFound();

    if (isLike) {
      const liked = method === 'PUT';
      const likeCount = await setCommunityLike(env, row.id, key, liked);
      return json({ likeCount, liked });
    }

    if (isReport) {
      const body = (await request.json().catch(() => ({}))) as { reason?: unknown; note?: unknown };
      if (!isCommunityReportReason(body.reason)) {
        return json({ error: 'invalid_reason' }, { status: 400 });
      }
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (
        note.length > COMMUNITY_REPORT_NOTE_MAX ||
        (body.note != null && typeof body.note !== 'string')
      ) {
        return json({ error: 'invalid_note' }, { status: 400 });
      }
      const networkHash = await communityNetworkHash(row.id, clientIp(request));
      const hidden = await recordCommunityReport(
        env,
        row.id,
        key,
        networkHash,
        body.reason,
        note || null,
      );
      if (hidden) console.log('[community] auto-hidden', { postId: row.id });
      // The answer is the same whether or not this report hid the post: a reporter learns nothing about others.
      return noContent();
    }
  }

  return notFound();
}
