import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiJson, apiText, postTelemetry } from './api';
import type { Env } from './env';
import { runInTool } from './tool-scope';

// Telemetry leaves by the global fetch, to the liveworkspace service; it lands in the same `calls`.
function stubTelemetryFetch(calls: Request[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return new Response(null, { status: 204 });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const isEvents = (r: Request) => new URL(r.url).pathname === '/api/telemetry/events';

function envWith(handler: (req: Request) => Response): { env: Env; calls: Request[] } {
  const calls: Request[] = [];
  stubTelemetryFetch(calls);
  const env = {
    API: {
      fetch: vi.fn(async (req: Request) => {
        calls.push(req);
        return handler(req);
      }),
    } as unknown as Fetcher,
    OAUTH_KV: {} as KVNamespace,
    TELEMETRY_KEY: 'k',
  };
  return { env, calls };
}

describe('apiFetch', () => {
  it('forwards the bearer token and the /api path to the service binding', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 'lwt_abc', '/documents');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer lwt_abc');
    expect(new URL(calls[0]!.url).pathname).toBe('/api/documents');
  });

  it('sets a JSON content-type when a body is present', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 't', '/documents', { method: 'POST', body: '{}' });
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
    return calls.some(isEvents);
  }

  it('reports a 5xx to the Error telemetry category, then throws', async () => {
    const { env, calls } = envWith((req) =>
      isEvents(req) ? new Response(null, { status: 204 }) : new Response('boom', { status: 503 }),
    );
    await expect(apiJson(env, 't', '/documents')).rejects.toBeInstanceOf(ApiError);
    expect(eventsPosted(calls)).toBe(true);
  });

  it('does NOT report a 4xx (expected, model-correctable)', async () => {
    const { env, calls } = envWith(() => new Response('nope', { status: 404 }));
    await expect(apiJson(env, 't', '/documents/bad')).rejects.toBeInstanceOf(ApiError);
    expect(eventsPosted(calls)).toBe(false);
  });

  // docs/specs/017-telemetry/telemetry.md: a bare `Http503` can't say which tool broke. The label comes
  // from the tool scope registerTool sets up, not from each call site.
  it('labels the failure with the running tool', async () => {
    const { env, calls } = envWith((req) =>
      isEvents(req) ? new Response(null, { status: 204 }) : new Response('boom', { status: 503 }),
    );
    await expect(
      runInTool('update_document', () => apiJson(env, 't', '/documents/x/tabs/y')),
    ).rejects.toBeInstanceOf(ApiError);
    const event = calls.find(isEvents)!;
    const body = (await event.json()) as { events: Array<{ type: string }> };
    expect(body.events[0]!.type).toBe('Http503.UpdateDocument');
  });

  it('reports a network failure (binding threw) as Internal, then rethrows', async () => {
    const calls: Request[] = [];
    stubTelemetryFetch(calls);
    const env = {
      API: {
        fetch: vi.fn(async (req: Request) => {
          calls.push(req);
          throw new Error('network down');
        }),
      } as unknown as Fetcher,
      OAUTH_KV: {} as KVNamespace,
      TELEMETRY_KEY: 'k',
    };
    await expect(apiJson(env, 't', '/documents')).rejects.toThrow('network down');
    expect(calls.some(isEvents)).toBe(true);
  });
});

describe('postTelemetry', () => {
  it('never throws into the tool, even when fetch throws at once', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch gone');
    });
    const env = { API: {} as Fetcher, OAUTH_KV: {} as KVNamespace, TELEMETRY_KEY: 'k' };
    expect(() => postTelemetry(env, 'Mcp', 'Used', 'ReadDocument')).not.toThrow();
  });

  it('sends nothing without a key', () => {
    const calls: Request[] = [];
    stubTelemetryFetch(calls);
    postTelemetry(
      { API: {} as Fetcher, OAUTH_KV: {} as KVNamespace },
      'Mcp',
      'Used',
      'ReadDocument',
    );
    expect(calls).toHaveLength(0);
  });

  it("posts livediagram's batch to the service with its key", async () => {
    const calls: Request[] = [];
    stubTelemetryFetch(calls);
    const env = {
      API: {} as Fetcher,
      OAUTH_KV: {} as KVNamespace,
      TELEMETRY_KEY: 'k',
      TELEMETRY_URL: 'https://telemetry.test',
    };
    postTelemetry(env, 'Mcp', 'Used', 'ReadDocument');
    expect(calls[0]!.url).toBe('https://telemetry.test/events');
    expect(calls[0]!.headers.get('X-Telemetry-Key')).toBe('k');
    expect(await calls[0]!.json()).toEqual({
      app: 'livediagram.app',
      events: [{ category: 'Mcp', action: 'Used', type: 'ReadDocument' }],
    });
  });
});

describe('apiText', () => {
  it('returns the body and the ETag, and fails like apiJson', async () => {
    const ok = envWith(() => new Response('tab t1', { headers: { ETag: 'W/"2"' } }));
    expect(await apiText(ok.env, 't', '/documents/d/tabs/t?view=outline')).toEqual({
      text: 'tab t1',
      etag: 'W/"2"',
    });
    const bad = envWith(() => new Response('nope', { status: 404 }));
    await expect(apiText(bad.env, 't', '/x')).rejects.toBeInstanceOf(ApiError);
  });
});
