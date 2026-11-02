// Which handler a request is for (index.ts is the Worker around it). Kept apart from index.ts so tests import it
// without the Durable Object's `cloudflare:workers`.

import { DRIVE_API_PATH } from '@liveworkspace/drive';
import { under } from '@liveworkspace/index-app/worker-http';
import { handleApp, handlePush } from './app-routes';
import type { Env } from './env';
import { json } from './http';
import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';
import { createIndexApi } from './index-api';
import { handleBrowser, type MirrorApi, type RouteDeps } from './routes';

function splitPath(path: string): string[] | null {
  try {
    return path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
}

export function routeDeps(env: Env, ctx: ExecutionContext): RouteDeps {
  return {
    // The stub's RPC methods are the object's, each answering a promise of what it returns.
    mirrors: (personId) =>
      env.DRIVE_MIRROR.get(env.DRIVE_MIRROR.idFromName(personId)) as unknown as MirrorApi,
    index: createIndexApi(env),
    now: () => Date.now(),
    waitUntil: (promise) => ctx.waitUntil(promise),
  };
}

// The route words a failure is logged under (`Post.Drive.Open`). An app's doors at /app are Drive's too, so they are
// named under its path (`Post.Drive.App.People.Adopt`); never an id.
const routeLabel = createApiRouteLabel(
  new Set(['drive']),
  new Set([
    'config',
    'connection',
    'state',
    'connect',
    'account-switch',
    'check',
    'marks',
    'picker-token',
    'adopt',
    'open',
    'import',
    'push',
    'app',
    'changes',
    'people',
  ]),
);
const routeOf = (request: Request): string => {
  const { pathname } = new URL(request.url);
  return routeLabel(
    request.method,
    under(pathname, '/app') ? `${DRIVE_API_PATH}${pathname}` : pathname,
  );
};

// One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails"): a
// mirror's Durable Object out of reach is a retryable 503, anything else a 500.
export function handle(request: Request, env: Env, deps: RouteDeps): Promise<Response> {
  return guardRequest(
    () => route(request, env, deps),
    () => ({ route: routeOf(request), json }),
  );
}

async function route(request: Request, env: Env, deps: RouteDeps): Promise<Response> {
  const url = new URL(request.url);
  if (under(url.pathname, DRIVE_API_PATH)) {
    const segments = splitPath(url.pathname.slice(DRIVE_API_PATH.length));
    if (!segments || segments.length !== 1) return new Response('Not found', { status: 404 });
    if (segments[0] === 'push') return handlePush(request, env, deps);
    return handleBrowser(request, env, segments[0]!, deps);
  }
  if (under(url.pathname, '/app')) {
    const segments = splitPath(url.pathname);
    return segments
      ? handleApp(request, env, segments, deps)
      : new Response('Not found', { status: 404 });
  }
  return new Response('Not found', { status: 404 });
}
