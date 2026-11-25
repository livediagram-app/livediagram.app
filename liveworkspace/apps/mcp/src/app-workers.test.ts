// Each app's MCP package as this Worker runs it (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): the
// env it is handed, and the local-only direct path the apps' evals use.
import { describe, expect, it, vi } from 'vitest';

// The packages themselves are tested in their apps; here each is a stub that says which app answered, with what env.
const { stub } = vi.hoisted(() => ({
  stub: (app: string) => ({
    default: {
      fetch: async (request: Request, env: { CONSENT_BASE_URL?: string }) =>
        Response.json({
          app,
          path: new URL(request.url).pathname,
          base: env.CONSENT_BASE_URL ?? null,
        }),
    },
  }),
}));
vi.mock('@livediagram/mcp', () => stub('livediagram'));
vi.mock('@livedocuments/mcp', () => stub('livedocuments'));
vi.mock('@liveplanner/mcp', () => stub('liveplanner'));
vi.mock('@livedesign/mcp', () => stub('livedesign'));
vi.mock('@liveknowledge/mcp', () => stub('liveknowledge'));

import { appEnv, appFetcher, packageRequest, routerEnv } from './app-workers';
import type { WorkerEnv } from './env';

const api = (name: string) => ({ name }) as unknown as Fetcher;
const KV = {} as KVNamespace;
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

const env = {
  LIVEDIAGRAM_API: api('diagram'),
  LIVEDOCUMENTS_API: api('docs'),
  LIVEPLANNER_API: api('planner'),
  LIVEDESIGN_API: api('design'),
  LIVEKNOWLEDGE_API: api('knowledge'),
  OAUTH_KV: KV,
  LIVEDIAGRAM_BASE_URL: 'https://staging.livediagram.app',
  LIVEDIAGRAM_TELEMETRY_KEY: 'key-diagram',
  TELEMETRY_URL: 'https://staging.liveworkspace.app/api/telemetry',
} satisfies WorkerEnv;

describe('appEnv', () => {
  it('hands an app its own api, editor origin, telemetry key and the shared scratch KV', () => {
    expect(appEnv(env, 'LIVEDIAGRAM')).toEqual({
      API: env.LIVEDIAGRAM_API,
      OAUTH_KV: KV,
      CONSENT_BASE_URL: 'https://staging.livediagram.app',
      TELEMETRY_KEY: 'key-diagram',
      TELEMETRY_URL: 'https://staging.liveworkspace.app/api/telemetry',
    });
  });

  it('leaves out what is unset, so the app falls back to its hosted editor and sends no telemetry', () => {
    const planner = appEnv({ ...env, TELEMETRY_URL: undefined }, 'LIVEPLANNER');
    expect(planner).toEqual({ API: env.LIVEPLANNER_API, OAUTH_KV: KV });
  });
});

describe('packageRequest', () => {
  it('serves nothing unless local development turned it on', () => {
    expect(packageRequest(new Request('https://x.test/livediagram/mcp'), env, ctx)).toBeNull();
  });

  it('serves an app’s own package at /<app>/mcp when turned on, and nothing else', async () => {
    const local = { ...env, SERVE_APP_PACKAGES: 'true' };
    expect(packageRequest(new Request('https://x.test/mcp'), local, ctx)).toBeNull();
    expect(packageRequest(new Request('https://x.test/livehuddle/mcp'), local, ctx)).toBeNull();
    expect(packageRequest(new Request('https://x.test/livediagram/health'), local, ctx)).toBeNull();
    const response = await packageRequest(
      new Request('https://x.test/livediagram/mcp'),
      local,
      ctx,
    )!;
    expect(await response.json()).toEqual({
      app: 'livediagram',
      path: '/mcp',
      base: 'https://staging.livediagram.app',
    });
  });
});

describe('routerEnv', () => {
  it('puts each app’s package under its binding name, with its own env', async () => {
    const routed = routerEnv(env, ctx);
    const answer = await routed.LIVEDESIGN.fetch('https://livedesign.internal/mcp', {
      method: 'POST',
    });
    expect(await answer.json()).toEqual({ app: 'livedesign', path: '/mcp', base: null });
    expect(routed.OAUTH_KV).toBe(KV);
  });

  it('turns a URL and init into the package’s request', async () => {
    const fetcher = appFetcher('liveknowledge', appEnv(env, 'LIVEKNOWLEDGE'), ctx);
    const answer = await fetcher.fetch(new URL('https://liveknowledge.internal/mcp'));
    expect(await answer.json()).toMatchObject({ app: 'liveknowledge', path: '/mcp' });
  });
});
