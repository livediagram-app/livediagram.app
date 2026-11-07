// The Community on an app's address (liveworkspace/docs/specs/007-community/community.md "One page for every app";
// each product's 025-community "Search engines"). The pages are liveworkspace.app's, built once in its site and served
// under each app's own `/community` by the app's router, with the address unchanged, the way the Explorer is
// (@liveworkspace/sites/workspace-proxy). Every app's router runs this step first, bound to its app, its canonical
// origin and its product name; it answers three paths itself and hands every other one to `forward`:
//
//   /community               the gallery, its <head> made the app's own (its title, description and canonical);
//   /community/post          the post shell, its <head> filled in with the post `?id=` names (./post-head.ts), or
//                            answered 404 when there is no such public post, so a dead post link never indexes;
//   /community/sitemap.xml   every public post of the app, at its canonical address, from the service's /sitemap.
//
// The posts are the liveworkspace Community service's, asked over HTTPS for the app's posts only: production's, or the
// one `communityUrl` names. When it is slow or failing, the page is served exactly as built: it still works, it just
// names no post until its script runs.

import {
  communityServiceUrl,
  type CommunityPostResponse,
  type CommunitySitemapResponse,
} from '@liveworkspace/community';
import { COMMUNITY_HOME_PATH } from '@liveworkspace/community/paths';
import {
  API_TIMEOUT_MS,
  escapeHtml,
  galleryHead,
  jsonLdScript,
  postHead,
  sitemapXml,
  type CommunityRouteSite,
  type GalleryHead,
  type PostHead,
} from './post-head';

export type { CommunityRouteSite } from './post-head';

// The few runtime types used here, written out so an app's one DOM-lib typecheck covers this file too.
type RewriterElement = {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
  append(content: string, options: { html: boolean }): void;
};
type Rewriter = {
  on(selector: string, handlers: { element(el: RewriterElement): void }): Rewriter;
  transform(response: Response): Response;
};
declare const HTMLRewriter: new () => Rewriter;

/** The router's own binding of the step. */
export type CommunityRouteOptions = {
  site: CommunityRouteSite;
  /** The Community service's API (the router's `COMMUNITY_URL`); unset means production's. */
  communityUrl?: string;
  /** The router's way to liveworkspace.app's pages: its `routeToWorkspace` for this request. */
  forward: (request: Request) => Promise<Response> | null;
};

/** Where the Community lives on an app's address: `/community`, anything under it, and its RSC payloads. */
export const COMMUNITY_PATH = COMMUNITY_HOME_PATH;
const POST_PATH = `${COMMUNITY_PATH}/post`;
const SITEMAP_PATH = `${COMMUNITY_PATH}/sitemap.xml`;

export function isCommunityPath(pathname: string): boolean {
  if (pathname === COMMUNITY_PATH) return true;
  const next = pathname.charAt(COMMUNITY_PATH.length);
  return pathname.startsWith(COMMUNITY_PATH) && (next === '/' || next === '.');
}

type ApiResult<T> = { status: 'ok'; body: T } | { status: 'missing' } | { status: 'unavailable' };

const isHtml = (res: Response) => (res.headers.get('content-type') ?? '').includes('text/html');

// The shell's shared head fields, set to `title` and `description`.
function withTitle(rewriter: Rewriter, title: string, description: string): Rewriter {
  const set = (value: string) => ({
    element(el: RewriterElement) {
      el.setAttribute('content', value);
    },
  });
  return rewriter
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"]', set(description))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(description))
    .on('meta[name="twitter:title"]', set(title))
    .on('meta[name="twitter:description"]', set(description));
}

// The post shell's head, rewritten to name the post. The shell carries no canonical (one shell serves every post).
function withPostHead(shell: Response, head: PostHead): Response {
  return withTitle(new HTMLRewriter(), head.title, head.description)
    .on('head', {
      element(el) {
        el.append(
          `<link rel="canonical" href="${escapeHtml(head.canonical)}"/>` +
            `<meta property="og:url" content="${escapeHtml(head.canonical)}"/>` +
            jsonLdScript(head.jsonLd),
          { html: true },
        );
      },
    })
    .transform(shell);
}

// The gallery shell's head, made the app's: liveworkspace.app's All Apps canonical and name become the app's.
function withGalleryHead(shell: Response, head: GalleryHead): Response {
  const set = (name: string, value: string) => ({
    element(el: RewriterElement) {
      el.setAttribute(name, value);
    },
  });
  return withTitle(new HTMLRewriter(), head.title, head.description)
    .on('link[rel="canonical"]', set('href', head.canonical))
    .on('meta[property="og:url"]', set('content', head.canonical))
    .on('meta[property="og:site_name"]', set('content', head.siteName))
    .transform(shell);
}

/** The step: an answer for a Community path on the app's address, or null for any other path. */
export function routeCommunity(
  request: Request,
  options: CommunityRouteOptions,
): Promise<Response> | null {
  const url = new URL(request.url);
  if (!isCommunityPath(url.pathname)) return null;
  if (url.pathname === SITEMAP_PATH) return sitemap(options);
  const page = options.forward(request);
  if (!page) return null;
  if (request.method !== 'GET') return page;
  if (url.pathname === COMMUNITY_PATH) return page.then((res) => galleryPage(res, options));
  if (url.pathname === POST_PATH) return page.then((res) => postPage(res, url, options));
  return page;
}

async function api<T>(options: CommunityRouteOptions, path: string): Promise<ApiResult<T>> {
  try {
    const url = communityServiceUrl(options.site.app, path, { base: options.communityUrl });
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) {
      console.warn('[community-route] api answered', res.status, path);
      return { status: 'unavailable' };
    }
    return { status: 'ok', body: (await res.json()) as T };
  } catch (err) {
    console.warn('[community-route] api unreachable', path, err);
    return { status: 'unavailable' };
  }
}

function galleryPage(shell: Response, options: CommunityRouteOptions): Response {
  if (!shell.ok || !isHtml(shell)) return shell;
  return withGalleryHead(shell, galleryHead(options.site));
}

async function postPage(
  shell: Response,
  url: URL,
  options: CommunityRouteOptions,
): Promise<Response> {
  const id = url.searchParams.get('id');
  if (!id || !shell.ok || !isHtml(shell)) return shell;
  const post = await api<CommunityPostResponse>(options, `/posts/${encodeURIComponent(id)}`);
  if (post.status === 'unavailable') return shell;
  if (post.status === 'missing') {
    // The page still renders its friendly not-found; the status tells crawlers there is no page here.
    return new Response(shell.body, { status: 404, headers: shell.headers });
  }
  return withPostHead(shell, postHead(options.site, post.body.post));
}

async function sitemap(options: CommunityRouteOptions): Promise<Response> {
  const result = await api<CommunitySitemapResponse>(options, '/sitemap');
  // Switched off, or nothing to list: an empty sitemap is still a valid one.
  if (result.status === 'unavailable') {
    return new Response('Sitemap unavailable', {
      status: 503,
      headers: { 'Retry-After': '3600' },
    });
  }
  const posts = result.status === 'ok' ? result.body.posts : [];
  return new Response(sitemapXml(options.site, posts), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
