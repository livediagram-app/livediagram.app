// The Community Worker (liveworkspace/docs/specs/007-community/community.md "Shared pieces"; each product's
// 025-community "Search engines"), as a factory each app's `apps/community/worker/index.ts` binds to its app and
// exports as its default. Everything else the Community serves is its static export, straight from the assets; this
// runs first for only two paths (the `run_worker_first` list in the app's wrangler.toml), both seen here without the
// `/community` prefix the router strips:
//
//   /post/        the post shell, its <head> filled in with the post named by `?id=` (./post-head.ts), or answered
//                 404 when there is no such public post, so a dead post link never indexes as a page;
//   /sitemap.xml  every public post, from the Community service's /sitemap.
//
// The posts are the liveworkspace Community service's, asked over HTTPS for the app's posts only: production's, or the
// one COMMUNITY_URL names. When it is slow or failing, the shell is served exactly as built: the page still works, it
// just names no post until its script runs.

import {
  communityServiceUrl,
  type CommunityPostResponse,
  type CommunitySitemapResponse,
} from '@liveworkspace/community';
import {
  API_TIMEOUT_MS,
  escapeHtml,
  jsonLdScript,
  postHead,
  sitemapXml,
  type CommunityWorkerSite,
  type PostHead,
} from './post-head';

export type { CommunityWorkerSite } from './post-head';

// The few runtime types used here, written out so an app's one DOM-lib typecheck covers this file too.
type Fetcher = { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> };
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

export interface CommunityWorkerEnv {
  ASSETS: Fetcher;
  // The Community service's API; unset means production's.
  COMMUNITY_URL?: string;
}

export type CommunityWorker = {
  fetch: (request: Request, env: CommunityWorkerEnv) => Promise<Response>;
};

type ApiResult<T> = { status: 'ok'; body: T } | { status: 'missing' } | { status: 'unavailable' };

// The shell's head, rewritten to name the post. The selectors match what the app's post page metadata emits.
function withPostHead(shell: Response, head: PostHead): Response {
  const set = (attr: string) => ({
    element(el: RewriterElement) {
      el.setAttribute('content', attr);
    },
  });
  return new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(head.title) })
    .on('meta[name="description"]', set(head.description))
    .on('meta[property="og:title"]', set(head.title))
    .on('meta[property="og:description"]', set(head.description))
    .on('meta[name="twitter:title"]', set(head.title))
    .on('meta[name="twitter:description"]', set(head.description))
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

export function createCommunityWorker(site: CommunityWorkerSite): CommunityWorker {
  async function api<T>(env: CommunityWorkerEnv, path: string): Promise<ApiResult<T>> {
    try {
      const url = communityServiceUrl(site.app, path, { base: env.COMMUNITY_URL });
      const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
      if (res.status === 404) return { status: 'missing' };
      if (!res.ok) {
        console.warn('[community-worker] api answered', res.status, path);
        return { status: 'unavailable' };
      }
      return { status: 'ok', body: (await res.json()) as T };
    } catch (err) {
      console.warn('[community-worker] api unreachable', path, err);
      return { status: 'unavailable' };
    }
  }

  async function postPage(request: Request, env: CommunityWorkerEnv, url: URL): Promise<Response> {
    const shell = await env.ASSETS.fetch(request);
    const id = url.searchParams.get('id');
    if (!id || !shell.ok || request.method !== 'GET') return shell;
    const post = await api<CommunityPostResponse>(env, `/posts/${encodeURIComponent(id)}`);
    if (post.status === 'unavailable') return shell;
    if (post.status === 'missing') {
      // The shell still renders its friendly not-found; the status tells crawlers there is no page here.
      return new Response(shell.body, { status: 404, headers: shell.headers });
    }
    return withPostHead(shell, postHead(site, post.body.post));
  }

  async function sitemap(env: CommunityWorkerEnv): Promise<Response> {
    const result = await api<CommunitySitemapResponse>(env, '/sitemap');
    // Switched off, or nothing to list: an empty sitemap is still a valid one.
    if (result.status === 'unavailable') {
      return new Response('Sitemap unavailable', { status: 503, headers: { 'Retry-After': '3600' } });
    }
    const posts = result.status === 'ok' ? result.body.posts : [];
    return new Response(sitemapXml(site, posts), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/sitemap.xml') return sitemap(env);
      if (url.pathname === '/post/' || url.pathname === '/post') return postPage(request, env, url);
      return env.ASSETS.fetch(request);
    },
  };
}
