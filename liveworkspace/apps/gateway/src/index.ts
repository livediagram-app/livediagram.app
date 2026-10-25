// liveworkspace's stand-in origin until liveworkspace.app is on this account (liveworkspace/docs/gateway.md):
// one workers.dev Worker that does what the zone's path routes do, forwarding each request unchanged to the
// Worker that owns its path, so liveworkspace stays one origin.

export type Target = 'ACCOUNTS' | 'INDEX' | 'MEDIA' | 'TELEMETRY' | 'COMMUNITY' | 'STATUS' | 'SITE';

export type Env = Record<Target, Fetcher>;

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
];

export function targetFor(pathname: string): Target {
  for (const [prefix, target] of ROUTES) if (pathname.startsWith(prefix)) return target;
  return 'SITE';
}

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return env[targetFor(new URL(request.url).pathname)].fetch(request);
  },
};

export default worker;
