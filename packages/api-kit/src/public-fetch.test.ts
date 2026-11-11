// A fetch of a URL someone else chose: https to public addresses only, every redirect checked, bounded in time and
// bytes (public-fetch.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicBytes, PUBLIC_URL_MAX, type PublicFetchOptions } from './public-fetch';

const PUBLIC = async () => ['93.184.216.34'];
const opts = (more: Partial<PublicFetchOptions> = {}): PublicFetchOptions => ({
  maxBytes: 16,
  resolve: PUBLIC,
  fetch: async () => new Response(new Uint8Array([1, 2, 3])),
  ...more,
});

// A body that never ends: a chunk every read.
const endless = () =>
  new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe('fetchPublicBytes', () => {
  it('asks the runtime’s own fetch by default', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([5])));
    expect(
      await fetchPublicBytes('https://a.example.com/', { maxBytes: 4, resolve: PUBLIC }),
    ).toMatchObject({ ok: true, bytes: new Uint8Array([5]) });
  });

  it('answers the bytes of a public https URL, asking with the given headers and no automatic redirects', async () => {
    const seen: Request[] = [];
    const got = await fetchPublicBytes(
      'https://img.example.com/a.png',
      opts({
        headers: { 'User-Agent': 'test' },
        fetch: async (request) => {
          seen.push(request);
          return new Response(new Uint8Array([1, 2, 3]));
        },
      }),
    );
    expect(got).toEqual({
      ok: true,
      bytes: new Uint8Array([1, 2, 3]),
      url: 'https://img.example.com/a.png',
    });
    expect(seen[0]!.redirect).toBe('manual');
    expect(seen[0]!.headers.get('User-Agent')).toBe('test');
  });

  it.each([
    ['not a url', 'invalid_url'],
    ['https://user:pw@example.com/a.png', 'invalid_url'],
    [`https://example.com/${'a'.repeat(PUBLIC_URL_MAX)}`, 'invalid_url'],
    ['http://example.com/a.png', 'not_https'],
    ['file:///etc/passwd', 'not_https'],
    ['https://example.com:8443/a.png', 'not_https'],
    ['https://127.0.0.1/a.png', 'private_address'],
    ['https://169.254.169.254/latest/meta-data', 'private_address'],
    ['https://10.0.0.5/a.png', 'private_address'],
    ['https://[::1]/a.png', 'private_address'],
    ['https://[fe80::1]/a.png', 'private_address'],
    ['https://[::ffff:7f00:1]/a.png', 'private_address'],
    ['https://localhost/a.png', 'private_address'],
    ['https://printer.local/a.png', 'private_address'],
    ['https://metadata.google.internal/a', 'private_address'],
    ['https://intranet/a.png', 'private_address'],
  ])('refuses %s before any request (%s)', async (url, reason) => {
    let asked = false;
    const got = await fetchPublicBytes(
      url,
      opts({
        fetch: async () => {
          asked = true;
          return new Response('x');
        },
      }),
    );
    expect(got).toMatchObject({ ok: false, reason });
    expect(asked).toBe(false);
  });

  it('takes a public address typed as one', async () => {
    expect(await fetchPublicBytes('https://93.184.216.34/a.png', opts())).toMatchObject({
      ok: true,
    });
  });

  it('refuses a name that resolves to a private address, or to none', async () => {
    const rebinding = opts({ resolve: async () => ['8.8.8.8', '127.0.0.1'] });
    expect(await fetchPublicBytes('https://evil.example.com/a.png', rebinding)).toMatchObject({
      ok: false,
      reason: 'private_address',
    });
    expect(
      await fetchPublicBytes('https://gone.example.com/a.png', opts({ resolve: async () => null })),
    ).toMatchObject({ ok: false, reason: 'unresolved' });
  });

  it('follows a redirect, checking where it goes the same way', async () => {
    const hops = new Map<string, Response | (() => Response)>([
      [
        'https://a.example.com/x',
        () => new Response(null, { status: 302, headers: { Location: '/y' } }),
      ],
      ['https://a.example.com/y', () => new Response(new Uint8Array([7]))],
    ]);
    const fetch = async (r: Request) => (hops.get(r.url) as () => Response)();
    expect(await fetchPublicBytes('https://a.example.com/x', opts({ fetch }))).toEqual({
      ok: true,
      bytes: new Uint8Array([7]),
      url: 'https://a.example.com/y',
    });
    const inward = async () =>
      new Response(null, { status: 301, headers: { Location: 'https://169.254.169.254/' } });
    expect(await fetchPublicBytes('https://a.example.com/x', opts({ fetch: inward }))).toEqual({
      ok: false,
      reason: 'private_address',
      url: 'https://169.254.169.254/',
    });
    const downgrade = async () =>
      new Response(null, { status: 307, headers: { Location: 'http://a.example.com/' } });
    expect(
      await fetchPublicBytes('https://a.example.com/x', opts({ fetch: downgrade })),
    ).toMatchObject({ ok: false, reason: 'not_https' });
  });

  it('stops after the redirect limit, and on a redirect that names nowhere', async () => {
    let n = 0;
    const loop = async () =>
      new Response(null, { status: 302, headers: { Location: `/hop${(n += 1)}` } });
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: loop, maxRedirects: 2 })),
    ).toMatchObject({ ok: false, reason: 'too_many_redirects' });
    expect(n).toBe(3);
    // A redirect whose body will not let go is still left behind.
    const nowhere = async () =>
      new Response(
        new ReadableStream({
          cancel() {
            throw new Error('stuck');
          },
        }),
        { status: 302 },
      );
    expect(await fetchPublicBytes('https://a.example.com/', opts({ fetch: nowhere }))).toEqual({
      ok: false,
      reason: 'http_status',
      status: 302,
      url: 'https://a.example.com/',
    });
  });

  it('refuses an answer that is not a 2xx, or has no body', async () => {
    const missing = async () => new Response('nope', { status: 404 });
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: missing })),
    ).toMatchObject({ ok: false, reason: 'http_status', status: 404 });
    const empty = async () => new Response(null, { status: 204 });
    expect(await fetchPublicBytes('https://a.example.com/', opts({ fetch: empty }))).toMatchObject({
      ok: false,
      reason: 'http_status',
      status: 204,
    });
  });

  it('refuses a body over the cap by its length, or cuts an endless one off at the cap', async () => {
    let cancelled = false;
    const declared = async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Length': '17' } },
      );
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: declared })),
    ).toMatchObject({ ok: false, reason: 'too_large' });
    expect(cancelled).toBe(true);
    const unending = async () => new Response(endless());
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: unending })),
    ).toMatchObject({ ok: false, reason: 'too_large' });
  });

  it('answers unreachable when the connection fails or the body breaks off', async () => {
    const down = async (): Promise<Response> => {
      throw new TypeError('network');
    };
    expect(await fetchPublicBytes('https://a.example.com/', opts({ fetch: down }))).toMatchObject({
      ok: false,
      reason: 'unreachable',
    });
    const broken = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error('reset'));
          },
        }),
      );
    expect(await fetchPublicBytes('https://a.example.com/', opts({ fetch: broken }))).toMatchObject(
      { ok: false, reason: 'unreachable' },
    );
  });

  it('gives up at the deadline, whether the answer or its body is slow', async () => {
    const hang = (request: Request) =>
      new Promise<Response>((_, reject) =>
        request.signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: hang, timeoutMs: 20 })),
    ).toMatchObject({ ok: false, reason: 'timeout' });
    // A body that trickles nothing, whose stream ignores the abort.
    const trickle = async () =>
      new Response(new ReadableStream({ pull: () => new Promise(() => {}) }));
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: trickle, timeoutMs: 20 })),
    ).toMatchObject({ ok: false, reason: 'timeout' });
    // A fetch that fails after the deadline aborted it reads as the timeout too.
    const late = (request: Request) =>
      new Promise<Response>((_, reject) => {
        request.signal.addEventListener('abort', () => setTimeout(() => reject(new Error('x')), 0));
      });
    expect(
      await fetchPublicBytes('https://a.example.com/', opts({ fetch: late, timeoutMs: 10 })),
    ).toMatchObject({ ok: false, reason: 'timeout' });
  });
});
