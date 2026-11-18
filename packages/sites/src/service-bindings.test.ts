// A router reaches liveworkspace's Workers over service bindings when it has them, and the public route otherwise
// (Work Tracker 1069; liveworkspace/docs/specs/002-architecture/blueprints/architecture.md "Which Worker a forward
// reaches"). Each target: the binding gets the very request the public route would, and without one nothing changes.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_NAMES } from './index';
import {
  FORWARD_DEADLINE_MS,
  WORKSPACE_CLIENT_IP_HEADER,
  WORKSPACE_PROXY_HEADER,
  WORKSPACE_PROXY_SECRET_HEADER,
  forwardToDrive,
  forwardToIndex,
  routeToPreviews,
  routeToWorkspace,
  viaBinding,
  workspaceBindingFor,
  type ServiceBinding,
  type WorkspaceBindings,
} from './workspace-proxy';

type Call = {
  url: string;
  headers: Headers;
  method: string;
  body: string | null;
  signal?: AbortSignal;
};

// A binding (or a public fetch) that records each request it is handed and answers `status`.
function recorder(status = 200) {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    calls.push({
      url: request.url,
      headers: request.headers,
      method: request.method,
      body: request.body ? await request.text() : null,
      signal: init?.signal ?? undefined,
    });
    return new Response('ok', { status });
  }) as typeof fetch;
  const binding: ServiceBinding = { fetch: fetchFn };
  return { calls, binding, fetch: fetchFn };
}

const APP = 'https://www.livediagram.app';
const visitor = (path: string, init?: RequestInit) =>
  new Request(`${APP}${path}`, {
    ...init,
    headers: { 'CF-Connecting-IP': '203.0.113.7', Cookie: 'app=1', ...init?.headers },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('viaBinding', () => {
  it("uses the binding's fetch when there is one", async () => {
    const bound = recorder();
    const fallback = recorder();
    await viaBinding(bound.binding, fallback.fetch)('https://www.liveworkspace.app/explorer');
    expect(bound.calls.map((c) => c.url)).toEqual(['https://www.liveworkspace.app/explorer']);
    expect(fallback.calls).toEqual([]);
  });

  it('falls back to the given fetch without a binding', async () => {
    const fallback = recorder();
    await viaBinding(undefined, fallback.fetch)('https://www.liveworkspace.app/explorer');
    expect(fallback.calls).toHaveLength(1);
  });

  it('falls back to the global fetch, looked up when called, without either', async () => {
    const global = recorder();
    const doFetch = viaBinding(undefined);
    vi.stubGlobal('fetch', global.fetch);
    await doFetch('https://www.liveworkspace.app/explorer');
    expect(global.calls).toHaveLength(1);
  });
});

describe('workspaceBindingFor', () => {
  const site = recorder().binding;
  const accounts = recorder().binding;
  const bindings: WorkspaceBindings = { WORKSPACE_SITE: site, WORKSPACE_ACCOUNTS: accounts };

  it.each([
    ['/api/auth', accounts],
    ['/api/auth/token', accounts],
    ['/api/account', accounts],
    ['/api/account/workbench/pair', accounts],
    ['/explorer/recent', site],
    ['/_liveworkspace/_next/x.js', site],
    ['/sign-in', site],
    ['/community', site],
    ['/api/authors', site],
    ['/api/accounts', site],
  ])('sends %s where the zone would', (path, expected) => {
    expect(workspaceBindingFor(path, bindings)).toBe(expected);
  });

  it('names none when the router has no bindings', () => {
    expect(workspaceBindingFor('/api/auth/token', undefined)).toBeUndefined();
    expect(workspaceBindingFor('/explorer', undefined)).toBeUndefined();
  });
});

describe('routeToWorkspace over its bindings', () => {
  function setup() {
    const site = recorder();
    const accounts = recorder();
    const publicRoute = recorder();
    const bindings: WorkspaceBindings = {
      WORKSPACE_SITE: site.binding,
      WORKSPACE_ACCOUNTS: accounts.binding,
    };
    return { site, accounts, publicRoute, bindings };
  }

  it('sends the Explorer to the site binding, as the public route would see it', async () => {
    const { site, accounts, publicRoute, bindings } = setup();
    const res = await routeToWorkspace(visitor('/explorer/recent?x=1'), {
      app: 'livediagram',
      bindings,
      proxySecret: 's3cret',
      fetch: publicRoute.fetch,
    });
    expect(res!.status).toBe(200);
    expect(publicRoute.calls).toEqual([]);
    expect(accounts.calls).toEqual([]);
    const [call] = site.calls;
    expect(call!.url).toBe('https://www.liveworkspace.app/explorer/recent?x=1');
    expect(call!.headers.get('X-Forwarded-Host')).toBe('www.livediagram.app');
    expect(call!.headers.get(WORKSPACE_PROXY_HEADER)).toBe('livediagram');
    expect(call!.headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe('203.0.113.7');
    expect(call!.headers.get(WORKSPACE_PROXY_SECRET_HEADER)).toBe('s3cret');
    expect(call!.headers.has('Cookie')).toBe(false);
  });

  it("sends the accounts API, the account reads and workbenches to accounts' binding, method and body kept", async () => {
    const { site, accounts, bindings } = setup();
    await routeToWorkspace(
      visitor('/api/workspace/auth/sign-in/email', { method: 'POST', body: '{"a":1}' }),
      { app: 'livediagram', bindings },
    );
    await routeToWorkspace(visitor('/api/workspace/account/settings'), {
      app: 'livediagram',
      bindings,
    });
    await routeToWorkspace(visitor('/api/workbench/pair'), { app: 'livediagram', bindings });
    expect(site.calls).toEqual([]);
    expect(accounts.calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', 'https://www.liveworkspace.app/api/auth/sign-in/email', '{"a":1}'],
      ['GET', 'https://www.liveworkspace.app/api/account/settings', null],
      ['GET', 'https://www.liveworkspace.app/api/account/workbench/pair', null],
    ]);
  });

  it("keeps the router's WORKSPACE_ORIGIN as the host the binding sees (staging)", async () => {
    const { site, bindings } = setup();
    await routeToWorkspace(visitor('/_liveworkspace/a.js'), {
      app: 'livediagram',
      origin: 'https://staging.liveworkspace.app',
      bindings,
    });
    expect(site.calls[0]!.url).toBe('https://staging.liveworkspace.app/_liveworkspace/a.js');
  });

  it('takes the public route without a binding (a local run, a fork)', async () => {
    const { publicRoute } = setup();
    await routeToWorkspace(visitor('/explorer'), {
      app: 'livediagram',
      bindings: {},
      fetch: publicRoute.fetch,
    });
    await routeToWorkspace(visitor('/api/workspace/auth/token'), {
      app: 'livediagram',
      fetch: publicRoute.fetch,
    });
    expect(publicRoute.calls.map((c) => c.url)).toEqual([
      'https://www.liveworkspace.app/explorer',
      'https://www.liveworkspace.app/api/auth/token',
    ]);
  });

  it('answers 504 at the deadline on a stalled binding too', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const stalled: ServiceBinding = {
      fetch: (_input, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      },
    };
    const pending = routeToWorkspace(visitor('/api/workspace/account/settings'), {
      app: 'livediagram',
      bindings: { WORKSPACE_ACCOUNTS: stalled },
    })!;
    await vi.advanceTimersByTimeAsync(FORWARD_DEADLINE_MS);
    const res = await pending;
    expect(res.status).toBe(504);
    expect(signal?.aborted).toBe(true);
  });

  it('answers 502 when the binding throws, never retrying over the public route', async () => {
    const publicRoute = recorder();
    const broken: ServiceBinding = { fetch: () => Promise.reject(new Error('no Worker')) };
    const res = await routeToWorkspace(
      visitor('/api/workspace/auth/token', { method: 'POST', body: 'x' }),
      { app: 'livediagram', bindings: { WORKSPACE_ACCOUNTS: broken }, fetch: publicRoute.fetch },
    );
    expect(res!.status).toBe(502);
    expect(publicRoute.calls).toEqual([]);
  });
});

describe('the index, Drive and previews over their bindings', () => {
  it('the index: its binding gets the same request, secret and visitor address', async () => {
    const index = recorder();
    const url = new URL(`${APP}/api/index/items?q=1`);
    await forwardToIndex(visitor('/api/index/items?q=1'), url, 'https://www.liveworkspace.app', {
      proxySecret: 's3cret',
      fetch: viaBinding(index.binding),
    });
    const [call] = index.calls;
    expect(call!.url).toBe('https://www.liveworkspace.app/api/index/items?q=1');
    expect(call!.headers.get(WORKSPACE_PROXY_SECRET_HEADER)).toBe('s3cret');
    expect(call!.headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe('203.0.113.7');
    expect(call!.headers.has('Cookie')).toBe(false);
    expect(call!.signal).toBeDefined();
  });

  it('the index: the public route without a binding', async () => {
    const publicRoute = recorder();
    const url = new URL(`${APP}/api/index/items`);
    await forwardToIndex(visitor('/api/index/items'), url, 'https://www.liveworkspace.app', {
      fetch: viaBinding(undefined, publicRoute.fetch),
    });
    expect(publicRoute.calls).toHaveLength(1);
  });

  it('Drive: its binding gets the same request', async () => {
    const drive = recorder();
    const url = new URL(`${APP}/api/drive/sync`);
    await forwardToDrive(
      visitor('/api/drive/sync', { method: 'POST', body: '{}' }),
      url,
      'https://www.liveworkspace.app',
      viaBinding(drive.binding),
    );
    expect(drive.calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', 'https://www.liveworkspace.app/api/drive/sync', '{}'],
    ]);
    expect(drive.calls[0]!.headers.has('Cookie')).toBe(false);
  });

  it('Drive: the public route without a binding', async () => {
    const publicRoute = recorder();
    const url = new URL(`${APP}/api/drive/sync`);
    await forwardToDrive(
      visitor('/api/drive/sync'),
      url,
      'https://www.liveworkspace.app',
      viaBinding(undefined, publicRoute.fetch),
    );
    expect(publicRoute.calls).toHaveLength(1);
  });

  it("previews: media's binding gets the share door at its previews path", async () => {
    const media = recorder();
    await routeToPreviews(
      visitor('/api/share/abc/image.png'),
      'https://staging.liveworkspace.app',
      viaBinding(media.binding),
    );
    expect(media.calls.map((c) => c.url)).toEqual([
      'https://staging.liveworkspace.app/api/previews/share/abc/image.png',
    ]);
  });

  it('previews: the public route without a binding', async () => {
    const publicRoute = recorder();
    await routeToPreviews(
      visitor('/api/previews/items/1'),
      undefined,
      viaBinding(undefined, publicRoute.fetch),
    );
    expect(publicRoute.calls.map((c) => c.url)).toEqual([
      'https://www.liveworkspace.app/api/previews/items/1',
    ]);
  });
});

// Each router's wrangler.toml binds the six Workers, by the names their own wrangler.toml deploys them as: a binding to
// a Worker that doesn't exist fails the deploy, and a staging router bound to production's would read production.
describe("each router's bindings to liveworkspace", () => {
  const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const WORKERS = {
    WORKSPACE_SITE: 'site',
    WORKSPACE_ACCOUNTS: 'accounts',
    WORKSPACE_INDEX: 'index',
    WORKSPACE_DRIVE: 'drive',
    WORKSPACE_MEDIA: 'media',
    WORKSPACE_COMMUNITY: 'community',
  } satisfies Record<keyof WorkspaceBindings, string>;

  // Every `[[<env.>services]]` block's binding and service, keyed by binding, for one environment.
  const servicesIn = (toml: string, env: '' | 'env.staging.' | 'env.local.') => {
    const out: Record<string, string> = {};
    const block = /^\[\[(env\.\w+\.)?services\]\]\nbinding = "(\w+)"\nservice = "([^"]+)"/gm;
    for (const [, prefix = '', binding, service] of toml.matchAll(block)) {
      if (prefix === env) out[binding!] = service!;
    }
    return out;
  };
  // A liveworkspace Worker's deployed names: its top-level `name` and its `[env.staging]` one.
  const deployedNames = (worker: string) => {
    const toml = read(`liveworkspace/apps/${worker}/wrangler.toml`);
    const production = /^name = "([^"]+)"/m.exec(toml)?.[1];
    const staging = /^\[env\.staging\]\nname = "([^"]+)"/m.exec(toml)?.[1];
    return { production, staging };
  };

  it.each(APP_NAMES)(
    '%s: production and staging bind each Worker by its deployed name; local binds none',
    (app) => {
      const toml = read(`${app}/apps/router/wrangler.toml`);
      const production = servicesIn(toml, '');
      const staging = servicesIn(toml, 'env.staging.');
      for (const [binding, worker] of Object.entries(WORKERS)) {
        const names = deployedNames(worker);
        expect(names.production).toBe(`liveworkspace-${worker}`);
        expect(names.staging).toBe(`liveworkspace-${worker}-staging`);
        expect(production[binding]).toBe(names.production);
        expect(staging[binding]).toBe(names.staging);
      }
      expect(servicesIn(toml, 'env.local.')).toEqual({});
    },
  );
});
