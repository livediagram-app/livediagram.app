// The public site at /kb/<site>/... (docs/specs/030-knowledgebase/publishing.md "The public site"; blueprint P15 to
// P23), answered by the worker before any identity is read: no cookie, no Authorization header and no share code
// reaches it. The address's registry instance names the knowledgebase, whose room answers from its published
// snapshot; the page is drawn here and kept at the edge for PUBLISHED_EDGE_SECONDS (the Cache API: no new binding).
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import {
  renderSitemap,
  renderSiteNotFound,
  renderSitePage,
  renderSiteSearch,
  SEARCH_MAX_QUERY_CHARS,
  siteAddressRefusal,
  siteLook,
  type SiteView,
} from '@liveknowledge/knowledge';
import { documentRoom } from '../document-client';
import type { Env } from '../types';
import type { PublishedAnswer, PublishedRead } from './published-reads';
import { PUBLISH_PURGE_HEADER } from './publishing-routes';
import { siteAddress } from './site-addresses';

/** How long the edge keeps a public answer: a save or an Unpublish reaches every reader within it. */
export const PUBLISHED_EDGE_SECONDS = 60;

/** The answer's Content Security Policy: no script, ever (P22). */
export const PUBLIC_SITE_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

type Waiter = (promise: Promise<unknown>) => void;

// The edge cache, where the runtime has one (not in tests or a bare isolate).
const edgeCache = (): Cache | null =>
  typeof caches !== 'undefined' && 'default' in caches
    ? (caches as unknown as { default: Cache }).default
    : null;

function answer(
  body: string | null,
  status: number,
  type: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${PUBLISHED_EDGE_SECONDS}`,
      'Content-Security-Policy': PUBLIC_SITE_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...extra,
    },
  });
}

const HTML = 'text/html; charset=utf-8';
const notFoundPage = () => answer(renderSiteNotFound(), 404, HTML);
const redirect = (to: string) =>
  new Response(null, {
    status: 301,
    headers: { Location: to, 'Cache-Control': `public, max-age=${PUBLISHED_EDGE_SECONDS}` },
  });

// What a path asks for: the site, and a page (null for the front page), the search or the sitemap.
type Asked = { site: string; read: PublishedRead; rest: string };

function askedOf(url: URL): Asked | null {
  const parts = url.pathname.split('/').slice(2);
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  const [site, page, ...more] = parts;
  if (!site || more.length > 0 || siteAddressRefusal(site) === 'invalid_address') return null;
  if (page === undefined) return { site, read: { kind: 'page', address: null }, rest: '' };
  if (page === 'sitemap.xml') return { site, read: { kind: 'sitemap' }, rest: '/sitemap.xml' };
  if (page === 'search') {
    const query = (url.searchParams.get('q') ?? '').slice(0, SEARCH_MAX_QUERY_CHARS);
    return { site, read: { kind: 'search', query }, rest: `/search${url.search}` };
  }
  if (!/^[a-z0-9-]{1,80}$/.test(page)) return null;
  return { site, read: { kind: 'page', address: page }, rest: `/${page}` };
}

// The page drawn from the room's answer.
function rendered(url: URL, asked: Asked, published: PublishedAnswer): Response {
  if (published.status === 'none') return notFoundPage();
  if (published.status === 'moved')
    return redirect(`/kb/${asked.site}${published.address ? `/${published.address}` : ''}`);
  const { site } = published;
  const view: SiteView = {
    origin: url.origin,
    address: site.address,
    name: site.name,
    noindex: site.noindex,
    look: siteLook(site.style),
    tree: site.tree,
  };
  const robots: Record<string, string> = site.noindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {};
  if (asked.read.kind === 'sitemap')
    return answer(
      renderSitemap(view, new Map(Object.entries(published.savedAt!))),
      200,
      'application/xml; charset=utf-8',
      robots,
    );
  if (asked.read.kind === 'search')
    return answer(
      renderSiteSearch(view, asked.read.query, published.results!),
      200,
      HTML,
      // A search page is never indexed: it is the same pages again.
      { 'X-Robots-Tag': 'noindex, follow' },
    );
  return answer(renderSitePage(view, published.page!), 200, HTML, robots);
}

/** One request to the public site. */
export async function handlePublicSite(
  request: Request,
  env: Env,
  waitUntil: Waiter,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const asked = askedOf(url);
  if (!asked) return notFoundPage();
  const searching = asked.read.kind === 'search';
  // Search is the one read the edge cannot keep, so it is limited per network (P23).
  if (searching && env.SEARCH_RATE_LIMITER) {
    const ok = await env.SEARCH_RATE_LIMITER.limit({ key: `kb:${clientRateKey(request)}` });
    if (!ok.success)
      return new Response('Too many searches. Try again in a minute.', {
        status: 429,
        headers: { 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
      });
  }
  const cache = searching ? null : edgeCache();
  const key = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;

  const holder = await siteAddress(env, asked.site, { kind: 'read' });
  let response: Response;
  if (!holder || typeof holder === 'string') response = notFoundPage();
  else if (holder.movedTo) response = redirect(`/kb/${holder.movedTo}${asked.rest}`);
  else
    response = rendered(
      url,
      asked,
      await documentRoom(env, holder.documentId).publishedRead(asked.read),
    );
  if (cache) waitUntil(cache.put(key, response.clone()).catch(() => undefined));
  return request.method === 'HEAD' ? new Response(null, response) : response;
}

/** An Editor's publish or Unpublish named the public paths it changed: drop them from this edge's copy, and strip
 *  the header from the answer. Other edges' copies run out within PUBLISHED_EDGE_SECONDS. */
export function purgePublished(response: Response, origin: string, waitUntil: Waiter): Response {
  const named = response.headers.get(PUBLISH_PURGE_HEADER);
  if (named === null) return response;
  const cache = edgeCache();
  let paths: unknown = [];
  try {
    paths = JSON.parse(named);
  } catch {
    // A header the api did not write names nothing.
  }
  if (cache && Array.isArray(paths))
    for (const path of paths)
      if (typeof path === 'string' && path.startsWith('/kb/'))
        waitUntil(cache.delete(new Request(`${origin}${path}`)).catch(() => false));
  const stripped = new Response(response.body, response);
  stripped.headers.delete(PUBLISH_PURGE_HEADER);
  return stripped;
}
