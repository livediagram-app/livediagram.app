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
    const target = isLivePath(url.pathname) ? env.LIVE : env.MARKETING;
    return target.fetch(request);
  },
} satisfies ExportedHandler<Env>;
