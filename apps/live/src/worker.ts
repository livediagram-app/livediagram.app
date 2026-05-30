// Live app worker. Wraps the static-export assets binding with a
// single path rewrite: any `/diagram/<anything>` request serves the
// single placeholder HTML built by Next.js, and the client extracts
// the real diagram id from `window.location.pathname`. See spec/14
// for why we can't enumerate user-minted ids at build time.

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };
type Env = { ASSETS: AssetsBinding };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // `/diagram` and everything under it shares one HTML file. We
    // rewrite the request rather than redirect so the browser URL
    // stays `/diagram/<id>` — that's the whole point of the path
    // scheme.
    if (url.pathname === '/diagram' || url.pathname.startsWith('/diagram/')) {
      // Skip if the request already points at the placeholder asset
      // (otherwise we'd loop). Static Assets resolves the extension.
      if (url.pathname !== '/diagram/placeholder') {
        const rewritten = new URL(request.url);
        rewritten.pathname = '/diagram/placeholder';
        return env.ASSETS.fetch(new Request(rewritten.toString(), request));
      }
    }
    return env.ASSETS.fetch(request);
  },
};
