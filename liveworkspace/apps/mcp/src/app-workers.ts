// Each app's MCP package, run in this Worker (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"). The
// router calls an app as it always has, JSON-RPC to `https://<app>.internal/mcp` on the app's binding name; here that
// binding is the app's own Hono app, called in process with the env it was written for: its api, its editor's
// origin for links, the scratch KV and its telemetry key.
import type { Env as AppEnv } from '@liveworkspace/mcp-kit/env';
import { APPS, type AppId, type Binding } from './apps';
import type { Env, WorkerEnv } from './env';

type AppWorker = {
  fetch: (request: Request, env: AppEnv, ctx: ExecutionContext) => Response | Promise<Response>;
};

// Loaded on an app's first call, not at startup: the bundle still holds every package, but each one's module code
// (its tools, schemas, templates) runs only when that app is first reached, so a cold isolate starts with the router
// alone (`wrangler check startup`, locally: 55 to 119 ms, against 189 to 365 ms loading all five up front).
const PACKAGES: Record<AppId, () => Promise<AppWorker>> = {
  livediagram: () => import('@livediagram/mcp').then((m) => m.default),
  livedocuments: () => import('@livedocuments/mcp').then((m) => m.default),
  liveplanner: () => import('@liveplanner/mcp').then((m) => m.default),
  livedesign: () => import('@livedesign/mcp').then((m) => m.default),
  liveknowledge: () => import('@liveknowledge/mcp').then((m) => m.default),
};

/** The env one app's package runs with, from this Worker's. */
export function appEnv(env: WorkerEnv, binding: Binding): AppEnv {
  return {
    API: env[`${binding}_API`],
    OAUTH_KV: env.OAUTH_KV,
    // Unset falls back to the hosted editor, as each package's own default does.
    ...(env[`${binding}_BASE_URL`] ? { CONSENT_BASE_URL: env[`${binding}_BASE_URL`] } : {}),
    ...(env[`${binding}_TELEMETRY_KEY`] ? { TELEMETRY_KEY: env[`${binding}_TELEMETRY_KEY`] } : {}),
    ...(env.TELEMETRY_URL ? { TELEMETRY_URL: env.TELEMETRY_URL } : {}),
  };
}

/** One app's package as a `Fetcher`, as a service binding would be. */
export function appFetcher(app: AppId, env: AppEnv, ctx: ExecutionContext): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
      (await PACKAGES[app]()).fetch(new Request(input, init), env, ctx),
    connect: () => {
      throw new Error(`${app}'s MCP package takes no sockets`);
    },
  };
}

/** The router's env: every app's package under its binding name, with this Worker's OAuth state. */
export function routerEnv(env: WorkerEnv, ctx: ExecutionContext): Env {
  const fetchers = Object.fromEntries(
    APPS.map((spec) => [spec.binding, appFetcher(spec.app, appEnv(env, spec.binding), ctx)]),
  ) as Record<Binding, Fetcher>;
  return {
    ...fetchers,
    OAUTH_KV: env.OAUTH_KV,
    // Any app api answers for an account token (liveworkspace made it); livediagram's, as the first app.
    TOKEN_API: env.LIVEDIAGRAM_API,
    ...(env.CONSENT_BASE_URL ? { CONSENT_BASE_URL: env.CONSENT_BASE_URL } : {}),
  };
}

const PACKAGE_PATH = /^\/(livediagram|livedocuments|liveplanner|livedesign|liveknowledge)\/mcp$/;

/**
 * Local development only (`SERVE_APP_PACKAGES`): `/<app>/mcp` is that app's package as it is, so the apps' evals
 * call their own tool names. Null for any other request, and always in production and staging.
 */
export function packageRequest(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
): Promise<Response> | null {
  if (env.SERVE_APP_PACKAGES !== 'true') return null;
  const url = new URL(request.url);
  const app = url.pathname.match(PACKAGE_PATH)?.[1] as AppId | undefined;
  if (!app) return null;
  const spec = APPS.find((s) => s.app === app)!;
  url.pathname = '/mcp';
  return PACKAGES[app]().then((pkg) =>
    pkg.fetch(new Request(url, request), appEnv(env, spec.binding), ctx),
  );
}
