// Client ID Metadata Documents (liveworkspace/docs/specs/021-mcp/mcp.md "Client ID Metadata Documents"; Work Tracker
// 1449): which URLs are fetched, the limits on the fetch (https, no redirects, 5 KB, 3 seconds, per-address count),
// what a document must say, and the cache.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  CIMD_CACHE_S,
  CIMD_FETCH_LIMIT,
  CIMD_MAX_BYTES,
  CIMD_REFETCH_AFTER_MS,
  CIMD_REFUSAL_CACHE_S,
  CIMD_TIMEOUT_MS,
  cimdClient,
  cimdRegistration,
  cimdUrl,
  isCimdClientId,
} from './oauth-cimd';
import { isAllowedRedirectUri, registeredName } from './oauth';

type Stored = { value: string; ttl?: number };
function memoryKV() {
  const m = new Map<string, Stored>();
  const kv = {
    get: async (k: string, type?: string): Promise<unknown> => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v.value) : v.value;
    },
    put: async (k: string, value: string, opts?: { expirationTtl?: number }) => {
      m.set(k, { value, ttl: opts?.expirationTtl });
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
  return { kv, m };
}

const URL_ID = 'https://client.example.com/oauth/client.json';
const CALLBACK = 'https://client.example.com/callback';
const doc = (over: Record<string, unknown> = {}) => ({
  client_id: URL_ID,
  client_name: 'Example Assistant',
  redirect_uris: [CALLBACK],
  token_endpoint_auth_method: 'none',
  ...over,
});

const request = (ip = '203.0.113.9') =>
  new Request('https://mcp.liveworkspace.test/oauth/authorize', {
    headers: { 'CF-Connecting-IP': ip },
  });

function served(body: unknown, init: ResponseInit = {}) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    typeof body === 'string' ? new Response(body, init) : Response.json(body, init),
  );
}

async function lookup(
  kv: KVNamespace,
  fetcher: typeof fetch,
  opts: { redirectUri?: string; now?: number; ip?: string; clientId?: string } = {},
) {
  return cimdClient({ OAUTH_KV: kv }, opts.clientId ?? URL_ID, {
    request: request(opts.ip),
    redirectUri: opts.redirectUri ?? CALLBACK,
    allowedRedirect: isAllowedRedirectUri,
    cleanName: registeredName,
    fetcher,
    now: opts.now,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('cimdUrl', () => {
  it('takes an https URL on a public host name with a path', () => {
    expect(isCimdClientId(URL_ID)).toBe(true);
    expect(isCimdClientId('a1b2c3')).toBe(false);
    expect(cimdUrl(URL_ID)?.href).toBe(URL_ID);
    expect(cimdUrl('https://claude.ai/oauth/claude-code-client-metadata')).not.toBeNull();
  });

  it.each([
    'http://client.example.com/oauth/client.json',
    'https://client.example.com/',
    'https://client.example.com',
    'https://127.0.0.1/client.json',
    'https://10.0.0.1/client.json',
    'https://0x7f000001/client.json',
    'https://[::1]/client.json',
    'https://localhost/client.json',
    'https://metadata.internal/client.json',
    'https://printer.local/client.json',
    'https://app.localhost/client.json',
    'https://intranet/client.json',
    'https://user:pw@client.example.com/client.json',
    'https://client.example.com:8443/client.json',
    'https://client.example.com/a/../client.json',
    'https://Client.Example.com/client.json',
    'https://client.example.com/client.json#x',
    `https://client.example.com/${'a'.repeat(250)}`,
    'not a url',
  ])('refuses %s', (id) => {
    expect(cimdUrl(id)).toBeNull();
  });
});

describe('cimdRegistration', () => {
  const read = (d: unknown) => cimdRegistration(URL_ID, d, isAllowedRedirectUri, registeredName);

  it('reads the client’s name and redirect URIs', () => {
    expect(read(doc())).toEqual({
      ok: true,
      reg: { clientName: 'Example Assistant', redirectUris: [CALLBACK] },
    });
    expect(read(doc({ client_name: undefined, token_endpoint_auth_method: undefined }))).toEqual({
      ok: true,
      reg: { clientName: 'MCP client', redirectUris: [CALLBACK] },
    });
    // An app scheme is a redirect like any other (Work Tracker 1450).
    expect(read(doc({ redirect_uris: ['cursor://anysphere.cursor-retrieval/cb'] }))).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ['not an object', []],
    ['a client_id that isn’t the URL', doc({ client_id: 'https://other.example.com/c.json' })],
    ['no redirect_uris', doc({ redirect_uris: [] })],
    ['a redirect_uri that isn’t a string', doc({ redirect_uris: [CALLBACK, 7] })],
    ['an http redirect off loopback', doc({ redirect_uris: ['http://evil.test/cb'] })],
    ['a javascript redirect', doc({ redirect_uris: ['javascript:alert(1)'] })],
    ['a confidential client', doc({ token_endpoint_auth_method: 'client_secret_basic' })],
    ['a reserved name', doc({ client_name: 'livediagram' })],
  ])('refuses %s', (_why, d) => {
    expect(read(d)).toMatchObject({ ok: false });
  });
});

describe('cimdClient', () => {
  it('fetches once with no redirects followed, then serves the cache for a day', async () => {
    const { kv, m } = memoryKV();
    const fetcher = served(doc());
    expect(await lookup(kv, fetcher)).toMatchObject({
      ok: true,
      reg: { clientName: 'Example Assistant' },
    });
    expect(await lookup(kv, fetcher)).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe(URL_ID);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
    const cached = [...m.entries()].find(([k]) => k.startsWith('cimd:'))!;
    expect(cached[1].ttl).toBe(CIMD_CACHE_S);
  });

  it('refuses a URL it won’t fetch without fetching it', async () => {
    const { kv } = memoryKV();
    const fetcher = served(doc());
    for (const clientId of [
      'https://127.0.0.1/c.json',
      'https://localhost/c.json',
      'http://client.example.com/c',
    ])
      expect(await lookup(kv, fetcher, { clientId })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a redirect, even to https, and an error status', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { kv } = memoryKV();
    const moved = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://other.example.com/c.json' },
        }),
    );
    expect(await lookup(kv, moved)).toEqual({
      ok: false,
      reason: 'The client metadata document redirects; it must be served at its own URL.',
    });
    const { kv: kv2 } = memoryKV();
    expect(await lookup(kv2, served('nope', { status: 404 }))).toMatchObject({ ok: false });
  });

  it('refuses an oversized document by its length, and by what it sends when the length lies', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const big = JSON.stringify(doc({ padding: 'x'.repeat(CIMD_MAX_BYTES) }));
    const { kv } = memoryKV();
    expect(
      await lookup(kv, served(big, { headers: { 'Content-Length': String(big.length) } })),
    ).toEqual({
      ok: false,
      reason: 'The client metadata document is larger than 5 KB.',
    });
    // No length header: a stream that keeps going is cut at the cap.
    const { kv: kv2 } = memoryKV();
    let pulled = 0;
    const endless = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulled += 1024;
              controller.enqueue(new Uint8Array(1024).fill(32));
            },
          }),
        ),
    );
    expect(await lookup(kv2, endless)).toMatchObject({ ok: false });
    expect(pulled).toBeLessThan(CIMD_MAX_BYTES * 3);
  });

  it('gives up on a slow document after 3 seconds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { kv } = memoryKV();
    let aborted = false;
    const slow = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        }),
    );
    const pending = lookup(kv, slow);
    // The cache read and the rate count come first; the clock starts with the fetch.
    while (slow.mock.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(CIMD_TIMEOUT_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({
      ok: false,
      reason: 'The client metadata document took too long to load.',
    });
    expect(aborted).toBe(true);
  });

  it('keeps a refusal five minutes, then tries again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { kv, m } = memoryKV();
    const broken = served('{not json');
    expect(await lookup(kv, broken, { now: 0 })).toMatchObject({ ok: false });
    expect(await lookup(kv, broken, { now: 1000 })).toMatchObject({ ok: false });
    expect(broken).toHaveBeenCalledTimes(1);
    const cached = [...m.entries()].find(([k]) => k.startsWith('cimd:'))!;
    expect(cached[1].ttl).toBe(CIMD_REFUSAL_CACHE_S);
  });

  it('fetches again for a redirect URI the kept copy lacks, once it is five minutes old', async () => {
    const { kv } = memoryKV();
    const NEW_CALLBACK = 'https://client.example.com/new-callback';
    const first = served(doc());
    await lookup(kv, first, { now: 0 });
    // Fresh copy: no refetch, the URI is simply not listed.
    const second = served(doc({ redirect_uris: [CALLBACK, NEW_CALLBACK] }));
    expect(await lookup(kv, second, { now: 1000, redirectUri: NEW_CALLBACK })).toEqual({
      ok: true,
      reg: { clientName: 'Example Assistant', redirectUris: [CALLBACK] },
    });
    expect(second).not.toHaveBeenCalled();
    const later = CIMD_REFETCH_AFTER_MS + 1;
    expect(await lookup(kv, second, { now: later, redirectUri: NEW_CALLBACK })).toEqual({
      ok: true,
      reg: { clientName: 'Example Assistant', redirectUris: [CALLBACK, NEW_CALLBACK] },
    });
    // A failed refetch keeps the good copy rather than locking the client out.
    const failing = vi.fn(async () => {
      throw new Error('down');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(
      await lookup(kv, failing, {
        now: later * 3,
        redirectUri: 'https://client.example.com/third',
      }),
    ).toMatchObject({ ok: true });
  });

  it('limits uncached fetches per address', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { kv } = memoryKV();
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      Response.json({ ...doc(), client_id: typeof url === 'string' ? url : '' }),
    );
    for (let i = 0; i < CIMD_FETCH_LIMIT.max; i++)
      expect(
        await lookup(kv, fetcher, { clientId: `https://client.example.com/c${i}.json`, now: 0 }),
      ).toMatchObject({ ok: true });
    expect(
      await lookup(kv, fetcher, { clientId: 'https://client.example.com/one-more.json', now: 0 }),
    ).toEqual({
      ok: false,
      reason: 'Too many client metadata documents loaded from this address. Try again later.',
    });
    expect(fetcher).toHaveBeenCalledTimes(CIMD_FETCH_LIMIT.max);
    // Anthropic's range has its own, larger budget.
    expect(
      await lookup(kv, fetcher, {
        clientId: 'https://client.example.com/one-more.json',
        now: 0,
        ip: '160.79.104.5',
      }),
    ).toMatchObject({ ok: true });
  });

  it('refuses an empty answer, and keeps serving a kept copy when the fetch limit is reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { kv: empty } = memoryKV();
    expect(
      await lookup(
        empty,
        vi.fn(async () => new Response(null)),
      ),
    ).toEqual({
      ok: false,
      reason: 'The client metadata document is not JSON.',
    });
    const { kv } = memoryKV();
    await lookup(kv, served(doc()), { now: 0 });
    // Use up this address's fetches on other documents.
    const other = vi.fn(async (url: RequestInfo | URL) =>
      Response.json({ ...doc(), client_id: typeof url === 'string' ? url : '' }),
    );
    for (let i = 1; i < CIMD_FETCH_LIMIT.max; i++)
      await lookup(kv, other, { clientId: `https://client.example.com/c${i}.json`, now: 0 });
    const later = served(doc());
    expect(
      await lookup(kv, later, {
        now: CIMD_REFETCH_AFTER_MS + 1,
        redirectUri: 'https://client.example.com/unlisted',
      }),
    ).toMatchObject({ ok: true, reg: { redirectUris: [CALLBACK] } });
    expect(later).not.toHaveBeenCalled();
  });

  it('reads a document at the size cap in little CPU', async () => {
    const padded = doc({ padding: 'x'.repeat(CIMD_MAX_BYTES - 200) });
    const text = JSON.stringify(padded);
    expect(text.length).toBeLessThanOrEqual(CIMD_MAX_BYTES);
    expect(
      cpuMsOf(() =>
        cimdRegistration(URL_ID, JSON.parse(text), isAllowedRedirectUri, registeredName),
      ),
    ).toBeLessThan(cpuBudgetMs(20));
  });
});
