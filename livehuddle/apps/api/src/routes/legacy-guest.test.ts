// The browser's one-time door of the move (routes/legacy-guest.ts): the legacy guest claim's forwarding and answers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { handleLegacyGuestClaim } from './legacy-guest';
import { makeTestRouteContext } from './test-route-context';

const CALLER = 'guest_caller';
const LEGACY = '0b5f0d8e-7f7c-4c35-9a0e-2f3c1d4e5a6b';

type Call = { url: string; auth: string | null; person: string | null; body: unknown };

function envOf(extra: Partial<Env> = {}): Env {
  return {
    ACCOUNTS_URL: 'https://accounts.test',
    ACCOUNTS_CLIENT_ID: 'livehuddle',
    ACCOUNTS_CLIENT_SECRET: 'secret',
    INDEX_ORIGIN: 'https://index.test',
    INDEX_KEY: 'idx',
    ...extra,
  } as unknown as Env;
}

function stubFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const call = {
      url: req.url,
      auth: req.headers.get('Authorization'),
      person: req.headers.get('X-Index-Person'),
      body: await req.json().catch(() => null),
    };
    calls.push(call);
    return answer(call);
  });
  return calls;
}

const ctxOf = (
  path: string,
  body: unknown,
  opts: Parameters<typeof makeTestRouteContext>[2] = {},
) => makeTestRouteContext('POST', path, { owner: CALLER, env: envOf(), body, ...opts });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('POST /api/legacy-guest/claim', () => {
  const claim = (body: unknown, opts: Parameters<typeof makeTestRouteContext>[2] = {}) =>
    handleLegacyGuestClaim(ctxOf('/api/legacy-guest/claim', body, opts));

  it('forwards the claim with the api’s client credentials, into the caller', async () => {
    const calls = stubFetch(() => Response.json({ merged: true }));
    const res = await claim({ legacyId: LEGACY, signature: 'a'.repeat(43) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ merged: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://accounts.test/api/account/internal/legacy-guests/claim');
    expect(calls[0]!.auth).toMatch(/^Basic /);
    expect(calls[0]!.body).toEqual({ legacyId: LEGACY, signature: 'a'.repeat(43), into: CALLER });
  });

  it('answers 200 merged: false for a refusal that never clears, so the editor forgets the old keys', async () => {
    for (const [status, reason] of [
      [403, 'unknown'],
      [404, 'unknown'],
      [410, 'unknown'],
      [409, 'claimed'],
    ] as const) {
      stubFetch(() => Response.json({ error: 'x' }, { status }));
      const res = await claim({ legacyId: LEGACY, signature: null });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ merged: false, reason });
    }
    // Malformed ids and signatures are never sent on.
    const calls = stubFetch(() => Response.json({ merged: true }));
    for (const body of [
      { legacyId: 'not-a-uuid', signature: null },
      { legacyId: LEGACY.toUpperCase(), signature: null },
      { legacyId: LEGACY, signature: 'short' },
      { legacyId: LEGACY, signature: 7 },
    ]) {
      const res = await claim(body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ merged: false, reason: 'unknown' });
    }
    expect(calls).toHaveLength(0);
  });

  it('answers 503 for a refusal that may clear: accounts down or unreachable', async () => {
    stubFetch(() => new Response('down', { status: 500 }));
    expect((await claim({ legacyId: LEGACY, signature: null })).status).toBe(503);
    stubFetch(() => {
      throw new Error('unreachable');
    });
    expect((await claim({ legacyId: LEGACY, signature: null })).status).toBe(503);
  });

  it('takes only a browser’s guest or account, and limits per network and per caller', async () => {
    stubFetch(() => Response.json({ merged: true }));
    expect((await claim({ legacyId: LEGACY, signature: null }, { owner: null })).status).toBe(401);
    expect(
      (await claim({ legacyId: LEGACY, signature: null }, { token: { id: 't', readOnly: false } }))
        .status,
    ).toBe(401);
    const keys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: !key.startsWith('legacy-claim:') };
      },
    };
    const res = await claim(
      { legacyId: LEGACY, signature: null },
      { env: envOf({ SHARE_RATE_LIMITER: limiter }) },
    );
    expect(res.status).toBe(429);
    expect(keys[0]).toMatch(/^legacy-claim-ip:/);
    expect(keys[1]).toBe(`legacy-claim:${CALLER}`);
  });
});
