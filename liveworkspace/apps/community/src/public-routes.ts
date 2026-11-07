// The public Community API (liveworkspace/docs/specs/007-community/community.md "The API"): what every app's Community
// pages read, and the likes and reports they send. Each request names its app (`?app=`), and only that
// app's posts answer. No identity: likes and reports carry the browser's community key, which is never
// an owner id. Nobody moderates by hand: enough reports hide a post.

import {
  COMMUNITY_ALL_APPS,
  COMMUNITY_APP_PARAM,
  COMMUNITY_START_PER_CATEGORY,
  communityStartPost,
  COMMUNITY_KEY_HEADER,
  COMMUNITY_REPORT_NOTE_MAX,
  isCommunityApp,
  isCommunityKey,
  isCommunityReportReason,
  parseCommunityListQuery,
  type CommunityPost,
  type CommunityScope,
  type CommunityStartResponse,
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
  listStartPosts,
} from './posts';
import { rowToPost, type PostRow } from './rows';

// Every app's posts (`/posts`) or their counts (`/facets`), under the same rules and caching as one app's.
async function allAppsRead(
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  read: string,
  key: string | null,
): Promise<Response> {
  if (read === 'facets') {
    return edgeCached(env, ctx, appUrl(url, COMMUNITY_ALL_APPS), LIST_MAX_AGE_S, async () =>
      json(await facets(env, COMMUNITY_ALL_APPS)),
    );
  }
  const query = parseCommunityListQuery(url.searchParams);
  if (!query.ok) return badRequest('invalid_query');
  const { rows, nextOffset } = await listPosts(env, COMMUNITY_ALL_APPS, query.value);
  return json(
    { posts: await withLikes(env, key, rows), nextOffset },
    { headers: listCacheHeaders(key) },
  );
}

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

// The reads that may name every app at once (`?app=all`): the gallery's list and its counts, for the Community page's
// All Apps. A post, its likes and reports, the featured six and the sitemap are always one app's.
const ALL_APPS_READS: ReadonlySet<string> = new Set(['posts', 'facets']);

// `path` is what follows /api/community: `/posts`, `/posts/<id>`, `/posts/<id>/like`, …
export async function handlePublic(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  path: string,
): Promise<Response> {
  const segments = path.split('/').filter(Boolean);
  const method = request.method;
  const key = communityKeyOf(request);
  const named = url.searchParams.get(COMMUNITY_APP_PARAM);
  if (
    named === COMMUNITY_ALL_APPS &&
    segments.length === 1 &&
    method === 'GET' &&
    ALL_APPS_READS.has(segments[0]!)
  ) {
    return allAppsRead(env, ctx, url, segments[0]!, key);
  }
  const app = named;
  if (!isCommunityApp(app)) return badRequest('invalid_app');

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
      // Start With's Community tiles: every category's best of the month, asked once when a template picker opens.
      // The same for everyone, so the edge answers it for a minute, as the featured six.
      case 'start':
        return edgeCached(env, ctx, appUrl(url, app), FEATURED_MAX_AGE_S, async () =>
          json(startResponse(await listStartPosts(env, app))),
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

// The rows by the category each reads as (a retired id reads as Something Else, so it is capped again there), each
// list best first, a category with none absent.
export function startResponse(rows: PostRow[]): CommunityStartResponse {
  const categories: CommunityStartResponse['categories'] = {};
  for (const row of rows) {
    const post = rowToPost(row, false);
    const list = (categories[post.category] ??= []);
    if (list.length < COMMUNITY_START_PER_CATEGORY) list.push(communityStartPost(post));
  }
  return { categories };
}

// One edge cache entry per app and route, whatever else the URL carries.
function appUrl(url: URL, app: CommunityScope): URL {
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
