// Routes URL paths to the right downstream app via service bindings.
// See specs/08-router-app.md.

export interface Env {
  MARKETING: Fetcher;
  LIVE: Fetcher;
}

const LIVE_PATH = '/live';

function isLivePath(pathname: string): boolean {
  return pathname === LIVE_PATH || pathname.startsWith(`${LIVE_PATH}/`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (isLivePath(url.pathname)) {
      // Strip the `/live` prefix before forwarding. Next.js's basePath
      // option rewrites the URLs in the emitted HTML/JS (so the live app's
      // links and asset references include `/live/`) but it does NOT shift
      // the file layout — files still live at the root of `out/`. The
      // router therefore presents `/live/foo` as `/foo` to the live worker.
      const stripped = url.pathname.slice(LIVE_PATH.length) || '/';
      const rewritten = new URL(url.toString());
      rewritten.pathname = stripped;
      return env.LIVE.fetch(new Request(rewritten.toString(), request));
    }
    return env.MARKETING.fetch(request);
  },
} satisfies ExportedHandler<Env>;
