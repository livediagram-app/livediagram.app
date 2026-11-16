import { statusGroups, workerServices, type WorkerProbe } from '@liveworkspace/status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fetch } from './probe';
import { mintGuestToken, type SignedInOptions, signedInCheck, signedInTarget } from './signed-in';
import { testEnv } from './test-env';

// liveworkspace/docs/specs/009-status/status.md "The signed-in check": a fresh guest token through the app's door and
// accounts' hand-off, then an index call with it, judged with its own 5 s timeout.

const PLATFORM = 'https://lw.example';
const APP = 'https://www.livediagram.app';
const COOKIE = 'guest_test.not-a-real-signature';
const index = workerServices(statusGroups('production'))[0]!;
const probe: WorkerProbe = index.worker;

type Handlers = {
  door?: (r: Request) => Response | Promise<Response>;
  accounts?: (r: Request) => Response | Promise<Response>;
  index?: (r: Request) => Response | Promise<Response>;
};

// The three hops: the app's /api/auth/guest, accounts' hand-off, the index call. Records every request.
function world(handlers: Handlers = {}) {
  const seen: Request[] = [];
  const fetchImpl: Fetch = async (r) => {
    seen.push(r);
    const url = new URL(r.url);
    if (url.origin === APP && url.pathname === '/api/auth/guest') {
      if (handlers.door) return handlers.door(r);
      const next = new URL('/api/auth/guest', PLATFORM);
      next.searchParams.set('client_id', 'livediagram');
      next.searchParams.set('state', url.searchParams.get('state')!);
      return new Response(null, { status: 302, headers: { Location: next.toString() } });
    }
    if (url.origin === PLATFORM && url.pathname === '/api/auth/guest') {
      if (handlers.accounts) return handlers.accounts(r);
      const back = new URLSearchParams({
        guest_token: 'fresh-guest-token',
        state: url.searchParams.get('state')!,
      });
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP}/auth/guest#${back.toString()}` },
      });
    }
    if (url.origin === PLATFORM && url.pathname === '/api/index/placement-defaults') {
      if (handlers.index) return handlers.index(r);
      return Response.json({ defaults: [] });
    }
    return new Response('not found', { status: 404 });
  };
  const options: SignedInOptions = {
    platformOrigin: PLATFORM,
    handoffOrigin: APP,
    cookie: COOKIE,
    fetch: fetchImpl,
  };
  return { seen, options };
}

// A clock that moves `step` ms per reading.
const clock = (step: number) => {
  let t = 0;
  return () => (t += step);
};

afterEach(() => {
  vi.useRealTimers();
});

describe('signedInCheck', () => {
  it('mints a fresh guest token and calls the index with it: up, with the call’s code and time', async () => {
    const { seen, options } = world();
    const result = await signedInCheck(probe, options);
    expect(result).toMatchObject({ state: 'up', code: 200, error: null });
    expect(seen.map((r) => new URL(r.url).origin + new URL(r.url).pathname)).toEqual([
      `${APP}/api/auth/guest`,
      `${PLATFORM}/api/auth/guest`,
      `${PLATFORM}/api/index/placement-defaults`,
    ]);
    expect(seen[2]!.headers.get('Authorization')).toBe('Bearer fresh-guest-token');
    // Every hop says who is asking; the hand-off's redirects are read, never followed.
    for (const r of seen) expect(r.headers.get('User-Agent')).toMatch(/^liveworkspace-status\//);
    expect(seen[0]!.redirect).toBe('manual');
  });

  it('sends the guest’s cookie to accounts’ hand-off alone, never the app or the index', async () => {
    const { seen, options } = world();
    await signedInCheck(probe, options);
    expect(seen.map((r) => r.headers.get('Cookie'))).toEqual([null, `lw_guest=${COOKIE}`, null]);
  });

  it('never sends the cookie when the app’s door points anywhere but liveworkspace.app', async () => {
    const { seen, options } = world({
      door: () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://evil.example/api/auth/guest?state=x' },
        }),
    });
    expect(await signedInCheck(probe, options)).toMatchObject({
      state: 'down',
      code: null,
      error: 'sign_in',
    });
    expect(seen).toHaveLength(1);
    expect(seen.some((r) => r.headers.get('Cookie'))).toBe(false);
  });

  it('is down with sign_in when the hand-off gives no token, and never calls the index', async () => {
    const refusals: Handlers[] = [
      { door: () => Response.json({ error: 'invalid_state' }, { status: 400 }) },
      { door: () => new Response(null, { status: 302 }) },
      { door: () => new Response(null, { status: 302, headers: { Location: 'http://[bad' } }) },
      { accounts: () => Response.json({ error: 'invalid_client' }, { status: 400 }) },
      // Someone else's state, or no token.
      {
        accounts: () =>
          new Response(null, {
            status: 302,
            headers: { Location: `${APP}/auth/guest#guest_token=t&state=other` },
          }),
      },
      {
        accounts: (r) =>
          new Response(null, {
            status: 302,
            headers: {
              Location: `${APP}/auth/guest#error=server_error&state=${new URL(r.url).searchParams.get('state')}`,
            },
          }),
      },
      {
        accounts: () => {
          throw new TypeError('network connection lost');
        },
      },
    ];
    for (const handlers of refusals) {
      const { seen, options } = world(handlers);
      const result = await signedInCheck(probe, { ...options, now: clock(7) });
      expect(result).toEqual({ state: 'down', code: null, ms: 7, error: 'sign_in' });
      expect(seen.some((r) => r.url.includes('/api/index/'))).toBe(false);
    }
  });

  it('would have gone red on 2026-11-13: a stalled key fetch holds the index call, and at 5 s it is down', async () => {
    vi.useFakeTimers();
    // The index waits on accounts' key set, which never comes: the call never answers.
    const { options } = world({ index: () => new Promise<Response>(() => {}) });
    const pending = signedInCheck(probe, options);
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ state: 'down', code: null, error: 'timeout' });
    expect((await pending).ms).toBeLessThanOrEqual(5_000);
  });

  it('is down on the 401 the index gave that day, and slow past 1.5 s', async () => {
    const refused = world({
      index: () => Response.json({ error: 'unauthorized' }, { status: 401 }),
    });
    expect(await signedInCheck(probe, refused.options)).toMatchObject({
      state: 'down',
      code: 401,
      error: 'status',
    });
    const slow = world();
    expect(await signedInCheck(probe, { ...slow.options, now: clock(1_600) })).toMatchObject({
      state: 'slow',
      code: 200,
      ms: 1_600,
    });
  });

  it('gives up on a hand-off step that stalls, after 5 s', async () => {
    vi.useFakeTimers();
    const { options } = world({ accounts: () => new Promise<Response>(() => {}) });
    const pending = signedInCheck(probe, options);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toMatchObject({ state: 'down', error: 'sign_in' });
  });
});

describe('mintGuestToken', () => {
  it('starts at the app’s door with a fresh state each time', async () => {
    const { seen, options } = world();
    expect(await mintGuestToken(options)).toBe('fresh-guest-token');
    expect(await mintGuestToken(options)).toBe('fresh-guest-token');
    const states = seen
      .filter((r) => r.url.startsWith(APP))
      .map((r) => new URL(r.url).searchParams.get('state'));
    expect(states[0]).toMatch(/^[A-Za-z0-9_-]{8,200}$/);
    expect(states[0]).not.toBe(states[1]);
  });
});

describe('signedInTarget', () => {
  it('is no target without the secret, so the check is skipped rather than red', () => {
    expect(signedInTarget(testEnv(), index, async () => new Response())).toBeNull();
  });

  it('checks the index on PLATFORM_ORIGIN, starting at the app’s door in the environment', async () => {
    const env = testEnv({ STATUS_GUEST_COOKIE: COOKIE, PLATFORM_ORIGIN: PLATFORM });
    const { seen, options } = world();
    const target = signedInTarget(env, index, options.fetch)!;
    expect(target.url).toBe(`${PLATFORM}/api/index/placement-defaults`);
    expect(await target.run!()).toMatchObject({ state: 'up' });
    expect(seen[0]!.url.startsWith(`${APP}/api/auth/guest?state=`)).toBe(true);
  });
});
