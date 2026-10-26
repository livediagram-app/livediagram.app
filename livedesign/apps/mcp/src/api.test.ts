import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiJson, apiText, postTelemetry } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { runInTool } from './tool-scope';

// The api's binding and the central telemetry service (plain fetch) both record into `calls`.
function envWith(handler: (req: Request) => Response): { env: Env; calls: Request[] } {
  const calls: Request[] = [];
  const record = vi.fn(async (input: Request | string, init?: RequestInit) => {
    const req = typeof input === 'string' ? new Request(input, init) : input;
    calls.push(req);
    return handler(req);
  });
  vi.stubGlobal('fetch', record);
  const env = {
    API: { fetch: record } as unknown as Fetcher,
    OAUTH_KV: {} as KVNamespace,
    TELEMETRY_KEY: 'k',
  };
  return { env, calls };
}

afterEach(() => vi.unstubAllGlobals());

const isEventsPost = (req: Request) =>
  req.url === 'https://www.liveworkspace.app/api/telemetry/events';

describe('apiFetch', () => {
  it('forwards the bearer token and the /api path to the service binding', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 'lwt_abc', '/designs');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer lwt_abc');
    expect(new URL(calls[0]!.url).pathname).toBe('/api/designs');
  });

  it('sets a JSON content-type when a body is present', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 't', '/designs', { method: 'POST', body: '{}' });
    expect(calls[0]!.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('apiJson', () => {
  it('parses JSON on a 2xx', async () => {
    const { env } = envWith(
      () =>
        new Response(JSON.stringify({ ok: 1 }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(await apiJson(env, 't', '/x')).toEqual({ ok: 1 });
  });

  it('throws ApiError on a non-2xx', async () => {
    const { env } = envWith(() => new Response('nope', { status: 403 }));
    await expect(apiJson(env, 't', '/x')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiJson error telemetry (docs/specs/015-api/mcp-server.md §4.12)', () => {
  function eventsPosted(calls: Request[]): boolean {
    return calls.some(isEventsPost);
  }

  it('reports a 5xx to the Error telemetry category, then throws', async () => {
    const { env, calls } = envWith((req) =>
      isEventsPost(req)
        ? new Response(null, { status: 204 })
        : new Response('boom', { status: 503 }),
    );
    await expect(apiJson(env, 't', '/designs')).rejects.toBeInstanceOf(ApiError);
    expect(eventsPosted(calls)).toBe(true);
  });

  it('does NOT report a 4xx (expected, model-correctable)', async () => {
    const { env, calls } = envWith(() => new Response('nope', { status: 404 }));
    await expect(apiJson(env, 't', '/designs/bad')).rejects.toBeInstanceOf(ApiError);
    expect(eventsPosted(calls)).toBe(false);
  });

  // docs/specs/017-telemetry/telemetry.md: a bare `Http503` can't say which tool broke. The label comes
  // from the tool scope registerTool sets up, not from each call site.
  it('labels the failure with the running tool', async () => {
    const { env, calls } = envWith((req) =>
      isEventsPost(req)
        ? new Response(null, { status: 204 })
        : new Response('boom', { status: 503 }),
    );
    await expect(
      runInTool('update_design', () => apiJson(env, 't', '/designs/x/tabs/y')),
    ).rejects.toBeInstanceOf(ApiError);
    const event = calls.find(isEventsPost)!;
    const body = (await event.json()) as { events: Array<{ type: string }> };
    expect(body.events[0]!.type).toBe('Http503.UpdateDesign');
  });

  it('reports a network failure (binding threw) as Internal, then rethrows', async () => {
    const { env, calls } = envWith((req) => {
      if (isEventsPost(req)) return new Response(null, { status: 204 });
      throw new Error('network down');
    });
    await expect(apiJson(env, 't', '/designs')).rejects.toThrow('network down');
    expect(calls.some(isEventsPost)).toBe(true);
  });
});

describe('postTelemetry', () => {
  it('never throws into the tool, even when fetch throws at once', () => {
    const { env } = envWith(() => {
      throw new Error('fetch gone');
    });
    expect(() => postTelemetry(env, 'Mcp', 'Used', 'ReadDesign')).not.toThrow();
  });

  it('speaks for livedesign.app with its Worker key, and swallows a failed post', async () => {
    const { env, calls } = envWith(() => {
      throw new Error('post failed');
    });
    postTelemetry(env, 'Mcp', 'Used', 'ReadDesign');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls[0]!.headers.get('X-Telemetry-Key')).toBe('k');
    expect(await calls[0]!.json()).toEqual({
      app: 'livedesign.app',
      events: [{ category: 'Mcp', action: 'Used', type: 'ReadDesign' }],
    });
  });

  it('sends nothing without a Worker key', () => {
    const { env, calls } = envWith(() => new Response(null, { status: 204 }));
    postTelemetry({ ...env, TELEMETRY_KEY: undefined }, 'Mcp', 'Used', 'ReadDesign');
    expect(calls).toHaveLength(0);
  });
});

describe('apiText', () => {
  it('returns the body and the ETag, and fails like apiJson', async () => {
    const ok = envWith(() => new Response('tab t1', { headers: { ETag: 'W/"2"' } }));
    expect(await apiText(ok.env, 't', '/designs/d/tabs/t?view=outline')).toEqual({
      text: 'tab t1',
      etag: 'W/"2"',
    });
    const bad = envWith(() => new Response('nope', { status: 404 }));
    await expect(apiText(bad.env, 't', '/x')).rejects.toBeInstanceOf(ApiError);
  });
});
