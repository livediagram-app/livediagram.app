import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiJson } from './api';
import type { Env } from './env';

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
    await apiFetch(env, 'lvd_abc', '/diagrams');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer lvd_abc');
    expect(new URL(calls[0]!.url).pathname).toBe('/api/diagrams');
  });

  it('sets a JSON content-type when a body is present', async () => {
    const { env, calls } = envWith(() => new Response('{}'));
    await apiFetch(env, 't', '/diagrams', { method: 'POST', body: '{}' });
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
