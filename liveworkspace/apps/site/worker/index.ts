// liveworkspace.app's Worker (liveworkspace/docs/specs/010-site/markdown-for-agents.md "Where it runs"): it runs first
// only on the pages that answer Markdown (wrangler.toml's run_worker_first), answering a page's Markdown to a request
// that prefers it and its HTML otherwise, both with Vary: Accept. Every other path is served from the static assets
// without it. Exports only its default handler (a named export stops workerd).
import { negotiatePage, requestFor } from '@liveworkspace/agent-markdown/negotiate';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return negotiatePage(
      request,
      new URL(request.url).pathname,
      (path) => env.ASSETS.fetch(requestFor(request, path)),
      () => env.ASSETS.fetch(request),
    );
  },
};
