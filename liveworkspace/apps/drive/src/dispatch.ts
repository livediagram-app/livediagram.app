// Which handler a request is for (index.ts is the Worker around it). Kept apart from index.ts so tests import it
// without the Durable Object's `cloudflare:workers`.

import { DRIVE_API_PATH } from '@liveworkspace/drive';
import { under } from '@liveworkspace/index-app/worker-http';
import { handleApp, handlePush } from './app-routes';
import type { Env } from './env';
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

export async function handle(request: Request, env: Env, deps: RouteDeps): Promise<Response> {
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
