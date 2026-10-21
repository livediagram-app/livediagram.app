import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiJson, apiText, postTelemetry } from './api';
import type { Env } from './env';
import { runInTool } from './tool-scope';

function envWith(handler: (req: Request) => Response): { env: Env; calls: Request[] } {
  const calls: Request[] = [];
  const env = {
    API: {
      fetch: vi.fn(async (req: Request) => {
        calls.push(req);
        return handler(req);
      }),
    } as unknown as Fetcher,
    OAUTH_KV: {} as KVNamespace,
  };
  return { env, calls };
}

describe('apiFetch', () => {
  it('forwards the bearer token and the /api path to the service binding', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 'lvd_abc', '/documents');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer lvd_abc');
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
    return calls.some((r) => new URL(r.url).pathname === '/api/events');
  }

  it('reports a 5xx to the Error telemetry category, then throws', async () => {
    const { env, calls } = envWith((req) =>
      new URL(req.url).pathname === '/api/events'
        ? new Response(null, { status: 204 })
        : new Response('boom', { status: 503 }),
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
      new URL(req.url).pathname === '/api/events'
        ? new Response(null, { status: 204 })
        : new Response('boom', { status: 503 }),
    );
    await expect(
      runInTool('update_document', () => apiJson(env, 't', '/documents/x/tabs/y')),
    ).rejects.toBeInstanceOf(ApiError);
    const event = calls.find((r) => new URL(r.url).pathname === '/api/events')!;
    const body = (await event.json()) as { events: Array<{ type: string }> };
    expect(body.events[0]!.type).toBe('Http503.UpdateDocument');
  });

  it('reports a network failure (binding threw) as Internal, then rethrows', async () => {
    const calls: Request[] = [];
    const env = {
      API: {
        fetch: vi.fn(async (req: Request) => {
          calls.push(req);
          if (new URL(req.url).pathname === '/api/events')
            return new Response(null, { status: 204 });
          throw new Error('network down');
        }),
      } as unknown as Fetcher,
      OAUTH_KV: {} as KVNamespace,
    };
    await expect(apiJson(env, 't', '/documents')).rejects.toThrow('network down');
    expect(calls.some((r) => new URL(r.url).pathname === '/api/events')).toBe(true);
  });
});

describe('postTelemetry', () => {
  it('never throws into the tool, even when the binding throws at once', () => {
    const env = {
      API: {
        fetch: () => {
          throw new Error('binding gone');
        },
      } as unknown as Fetcher,
      OAUTH_KV: {} as KVNamespace,
    };
    expect(() => postTelemetry(env, 'Mcp', 'Used', 'ReadDocument')).not.toThrow();
  });

  it('names itself as internal when the key is set, and swallows a failed post', async () => {
    const calls: Request[] = [];
    const env = {
      API: {
        fetch: async (req: Request) => {
          calls.push(req);
          throw new Error('post failed');
        },
      } as unknown as Fetcher,
      OAUTH_KV: {} as KVNamespace,
      INTERNAL_EVENTS_KEY: 'k',
    };
    postTelemetry(env, 'Mcp', 'Used', 'ReadDocument');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls[0]!.headers.get('X-Internal-Events-Key')).toBe('k');
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
