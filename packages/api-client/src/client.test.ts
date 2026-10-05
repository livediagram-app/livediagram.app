import { describe, expect, it } from 'vitest';
import { API_ERROR_BODY_MAX, ApiError, createApiClient, postEvents } from './client';

function recorder(answer: (request: Request) => Response | Promise<Response>) {
  const seen: Request[] = [];
  const fetch = async (request: Request) => {
    seen.push(request);
    return answer(request);
  };
  return { seen, fetch };
}

const base = 'https://livediagram-api/api';

describe('createApiClient', () => {
  it('sends the caller headers, JSON content type for a body, and parses JSON', async () => {
    const { seen, fetch } = recorder(() => Response.json({ ok: 1 }));
    const api = createApiClient({
      baseUrl: base,
      fetch,
      headers: () => ({ Authorization: 'Bearer lvd_x' }),
    });
    expect(await api.json('/documents', { method: 'POST', body: '{}' })).toEqual({ ok: 1 });
    expect(seen[0]!.url).toBe(`${base}/documents`);
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer lvd_x');
    expect(seen[0]!.headers.get('Content-Type')).toBe('application/json');
    await api.fetch('/plain', {
      method: 'PUT',
      body: 'x',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(seen[1]!.headers.get('Content-Type')).toBe('text/plain');
    await api.fetch('/nobody');
    expect(seen[2]!.headers.has('Content-Type')).toBe(false);
  });

  it('answers text with its ETag', async () => {
    const { fetch } = recorder(() => new Response('outline', { headers: { ETag: 'W/"3"' } }));
    const api = createApiClient({ baseUrl: base, fetch, headers: () => ({}) });
    expect(await api.text('/x')).toEqual({ body: 'outline', etag: 'W/"3"' });
  });

  it('throws an ApiError with the status, the cut body and its error code; reports only 5xx', async () => {
    const failures: string[] = [];
    const status = { value: 404, body: JSON.stringify({ error: 'not_found' }) };
    const { fetch } = recorder(() => new Response(status.body, { status: status.value }));
    const api = createApiClient({
      baseUrl: base,
      fetch,
      headers: () => ({}),
      onFailure: (k) => failures.push(k),
    });
    const err = await api.json('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'api 404: {"error":"not_found"}',
    });
    status.value = 503;
    status.body = 'x'.repeat(API_ERROR_BODY_MAX + 10);
    const down = (await api.text('/x').catch((e: unknown) => e)) as ApiError;
    expect(down.code).toBeNull();
    expect(down.body).toHaveLength(API_ERROR_BODY_MAX + 10);
    expect(down.message).toBe(`api 503: ${'x'.repeat(API_ERROR_BODY_MAX)}…`);
    status.value = 422;
    const long = JSON.stringify({ error: 'invalid_value', text: 'y'.repeat(API_ERROR_BODY_MAX) });
    status.body = long;
    const refused = (await api.json('/x').catch((e: unknown) => e)) as ApiError;
    expect(refused.code).toBe('invalid_value');
    expect(refused.body).toBe(long);
    status.value = 503;
    expect(failures).toEqual(['Http503']);
    status.body = 'null';
    expect(((await api.json('/x').catch((e: unknown) => e)) as ApiError).code).toBeNull();
    status.body = '[1]';
    expect(((await api.json('/x').catch((e: unknown) => e)) as ApiError).code).toBeNull();
    status.body = '{"error":4}';
    expect(((await api.json('/x').catch((e: unknown) => e)) as ApiError).code).toBeNull();
  });

  it('reads an unreadable error body as empty', async () => {
    const broken = new Response('x', { status: 500 });
    Object.defineProperty(broken, 'text', { value: () => Promise.reject(new Error('gone')) });
    const api = createApiClient({ baseUrl: base, fetch: async () => broken, headers: () => ({}) });
    expect(((await api.json('/x').catch((e: unknown) => e)) as ApiError).body).toBe('');
  });

  it('reports a request that never completed as Internal and rethrows', async () => {
    const failures: string[] = [];
    const api = createApiClient({
      baseUrl: base,
      fetch: () => Promise.reject(new Error('offline')),
      headers: () => ({}),
      onFailure: (k) => failures.push(k),
    });
    await expect(api.json('/x')).rejects.toThrow('offline');
    expect(failures).toEqual(['Internal']);
    const quiet = createApiClient({
      baseUrl: base,
      fetch: () => Promise.reject(new Error('offline')),
      headers: () => ({}),
    });
    await expect(quiet.text('/x')).rejects.toThrow('offline');
  });

  it('times out a slow answer', async () => {
    const api = createApiClient({
      baseUrl: base,
      fetch: (request) =>
        new Promise((_, reject) =>
          request.signal.addEventListener('abort', () => reject(request.signal.reason)),
        ),
      headers: () => ({}),
      timeoutMs: 5,
    });
    await expect(api.json('/x')).rejects.toThrow();
  });
});

describe('postEvents', () => {
  it('posts the events without credentials, and never throws', async () => {
    const { seen, fetch } = recorder(() => new Response(null, { status: 204 }));
    await postEvents(base, fetch, [{ category: 'Cli', action: 'Used', type: 'TabView' }], {
      'X-K': '1',
    });
    expect(seen[0]!.url).toBe(`${base}/events`);
    expect(seen[0]!.headers.get('Authorization')).toBeNull();
    expect(seen[0]!.headers.get('X-K')).toBe('1');
    expect(await seen[0]!.json()).toEqual({
      events: [{ category: 'Cli', action: 'Used', type: 'TabView' }],
    });
    await expect(
      postEvents(base, () => Promise.reject(new Error('down')), []),
    ).resolves.toBeUndefined();
    await postEvents(base, fetch, []);
    expect(seen[1]!.headers.get('Content-Type')).toBe('application/json');
  });

  it('carries an abort signal, so a caller can bound the send', async () => {
    const { seen, fetch } = recorder(() => new Response(null, { status: 204 }));
    const controller = new AbortController();
    await postEvents(base, fetch, [], {}, controller.signal);
    controller.abort();
    expect(seen[0]!.signal.aborted).toBe(true);
  });
});
