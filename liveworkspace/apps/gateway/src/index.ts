// liveworkspace's stand-in origin until liveworkspace.app is on this account (liveworkspace/docs/gateway.md):
// one workers.dev Worker that does what the zone's path routes do, forwarding each request unchanged to the
// Worker that owns its path, so liveworkspace stays one origin.

export type Target =
  'ACCOUNTS' | 'INDEX' | 'MEDIA' | 'TELEMETRY' | 'COMMUNITY' | 'STATUS' | 'DRIVE' | 'SITE';

// DRIVE is optional: its binding stays off until liveworkspace-drive is deployed (wrangler.toml), and /api/drive is
// missing meanwhile.
export type Env = Record<Exclude<Target, 'DRIVE'>, Fetcher> & { DRIVE?: Fetcher };

// The zone's routes, most specific first; anything else is the static site's.
const ROUTES: ReadonlyArray<readonly [prefix: string, target: Target]> = [
  ['/api/auth/', 'ACCOUNTS'],
  ['/api/account/', 'ACCOUNTS'],
  ['/.well-known/openid-configuration', 'ACCOUNTS'],
  ['/.well-known/oauth-authorization-server', 'ACCOUNTS'],
  ['/api/index', 'INDEX'],
  ['/api/media', 'MEDIA'],
  ['/api/previews', 'MEDIA'],
  ['/api/telemetry', 'TELEMETRY'],
  ['/api/community', 'COMMUNITY'],
  ['/api/status', 'STATUS'],
  ['/api/drive', 'DRIVE'],
];

export function targetFor(pathname: string): Target {
  for (const [prefix, target] of ROUTES) if (pathname.startsWith(prefix)) return target;
  return 'SITE';
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const owner = env[targetFor(new URL(request.url).pathname)];
    return owner ? owner.fetch(request) : new Response('Not found', { status: 404 });
  },
};

export default worker;
