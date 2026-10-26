// The public Community API (liveworkspace/docs/specs/007-community/community.md "The API"): what every app's Community
// pages read, and the likes and reports they send. Each request names its app (`?app=`), and only that
// app's posts answer. No identity: likes and reports carry the browser's community key, which is never
// an owner id. Nobody moderates by hand: enough reports hide a post.

import {
  COMMUNITY_APP_PARAM,
  COMMUNITY_KEY_HEADER,
  COMMUNITY_REPORT_NOTE_MAX,
  isCommunityApp,
  isCommunityKey,
  isCommunityReportReason,
  parseCommunityListQuery,
  type CommunityApp,
  type CommunityPost,
} from '@liveworkspace/community';
import { FEATURED_MAX_AGE_S, LIST_MAX_AGE_S, MAX_BODY_BYTES, SITEMAP_MAX_AGE_S } from './config';
import { likedPostIds, recordReport, setLike } from './engagement';
import type { Env } from './env';
import { badRequest, edgeCached, json, noContent, notFound } from './http';
import { communityNetwork } from '@liveworkspace/community';
import { clientIp, networkHash } from './network';
import {
  facets,
  getPublicPost,
  listFeaturedPosts,
  listPosts,
  listRelatedPosts,
  listSitemap,
} from './posts';
import { rowToPost, type PostRow } from './rows';

function communityKeyOf(request: Request): string | null {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  return isCommunityKey(key) ? key : null;
}

export async function withLikes(
  env: Env,
  key: string | null,
  rows: PostRow[],
): Promise<CommunityPost[]> {
  const liked = await likedPostIds(
    env,
    key,
    rows.map((r) => r.id),
  );
  return rows.map((row) => rowToPost(row, liked.has(row.id)));
}

// Anonymous reads are the same for everyone, so a browser may keep them briefly; with a key the answer
// carries that browser's likes and must not be shared.
function listCacheHeaders(key: string | null): HeadersInit {
  return { 'Cache-Control': key ? 'private, no-store' : `public, max-age=${LIST_MAX_AGE_S}` };
}

// `path` is what follows /api/community: `/posts`, `/posts/<id>`, `/posts/<id>/like`, …
export async function handlePublic(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  path: string,
): Promise<Response> {
  const app = url.searchParams.get(COMMUNITY_APP_PARAM);
  if (!isCommunityApp(app)) return badRequest('invalid_app');
  const segments = path.split('/').filter(Boolean);
  const method = request.method;
  const key = communityKeyOf(request);

  if (segments.length === 1 && method === 'GET') {
    switch (segments[0]) {
      case 'posts': {
        const query = parseCommunityListQuery(url.searchParams);
        if (!query.ok) return badRequest('invalid_query');
        const { rows, nextOffset } = await listPosts(env, app, query.value);
        return json(
          { posts: await withLikes(env, key, rows), nextOffset },
          { headers: listCacheHeaders(key) },
        );
      }
      // The home page's six. The same for everyone, and every home page visit asks, so the edge
      // answers it for a minute; no longer, so a post hidden after reports doesn't linger there.
      case 'featured':
        return edgeCached(env, ctx, appUrl(url, app), FEATURED_MAX_AGE_S, async () =>
          json({ posts: (await listFeaturedPosts(env, app)).map((row) => rowToPost(row, false)) }),
        );
      // What each app's sitemap lists. Crawlers read it rarely, so an hour at the edge is plenty.
      case 'sitemap':
        return edgeCached(env, ctx, appUrl(url, app), SITEMAP_MAX_AGE_S, async () =>
          json({ posts: await listSitemap(env, app) }),
        );
      case 'facets':
        return edgeCached(env, ctx, appUrl(url, app), LIST_MAX_AGE_S, async () =>
          json(await facets(env, app)),
        );
    }
    return notFound();
  }

  if (segments[0] !== 'posts' || segments.length < 2 || segments.length > 3) return notFound();
  const postId = segments[1]!;

  // GET /posts/<id>: the post and More Like This.
  if (segments.length === 2 && method === 'GET') {
    const row = await getPublicPost(env, app, postId);
    if (!row) return notFound();
    const related = await listRelatedPosts(env, app, row.id, rowToPost(row, false).category);
    const [post, ...rest] = await withLikes(env, key, [row, ...related]);
    return json({ post, related: rest }, { headers: listCacheHeaders(key) });
  }

  const isLike = segments[2] === 'like' && (method === 'PUT' || method === 'DELETE');
  const isReport = segments[2] === 'report' && method === 'POST';
  if (!isLike && !isReport) return notFound();
  if (!key) return badRequest('community_key_required');
  const ip = clientIp(request);
  // Anonymous writes, so each network gets a budget, counted at Cloudflare's edge across isolates.
  if (env.COMMUNITY_RATE_LIMITER) {
    const { success } = await env.COMMUNITY_RATE_LIMITER.limit({ key: communityNetwork(ip) });
    if (!success) return json({ error: 'rate_limited' }, { status: 429 });
  }
  const row = await getPublicPost(env, app, postId);
  if (!row) return notFound();
  const network = await networkHash(row.id, ip);

  if (isLike) {
    const liked = method === 'PUT';
    const likeCount = await setLike(env, row.id, key, liked, network);
    return json({ likeCount, liked });
  }

  const body = await readReport(request);
  if (typeof body === 'string') return badRequest(body);
  const hidden = await recordReport(env, row.id, key, network, body.reason, body.note);
  if (hidden) console.log('[community] auto-hidden', { app, postId: row.id });
  // The answer is the same whether or not this report hid the post: a reporter learns nothing about
  // the others.
  return noContent();
}

// One edge cache entry per app and route, whatever else the URL carries.
function appUrl(url: URL, app: CommunityApp): URL {
  return new URL(`${url.origin}${url.pathname}?${COMMUNITY_APP_PARAM}=${encodeURIComponent(app)}`);
}

async function readReport(
  request: Request,
): Promise<
  | { reason: Parameters<typeof recordReport>[4]; note: string | null }
  | 'invalid_reason'
  | 'invalid_note'
> {
  const text = await request.text().catch(() => '');
  let parsed: unknown = null;
  if (text.length <= MAX_BODY_BYTES) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  // `?? {}`: a JSON `null` body parses fine and must answer 400, not 500.
  const body = (parsed ?? {}) as { reason?: unknown; note?: unknown };
  if (!isCommunityReportReason(body.reason)) return 'invalid_reason';
  if (body.note != null && typeof body.note !== 'string') return 'invalid_note';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > COMMUNITY_REPORT_NOTE_MAX) return 'invalid_note';
  return { reason: body.reason, note: note || null };
}
