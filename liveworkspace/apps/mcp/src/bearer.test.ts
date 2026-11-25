// The Bearer a request to `/mcp` carries (liveworkspace/docs/specs/021-mcp/mcp.md "Tokens", "Existing connections";
// Work Tracker 1447): this server's own token for its own audience, an account token inside the move-over window and
// not after, liveworkspace's check of the account token behind either, and its per-isolate cache.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueTokens, refreshTokens } from '@liveworkspace/mcp-kit/oauth-tokens';
import type { Binding } from './apps';
import { LEGACY_TOKENS_UNTIL, forgetBearers, resolveBearer } from './bearer';
import type { Env } from './env';

function mockKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string, type?: string): Promise<unknown> => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => {
      m.set(k, v);
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
}

const ORIGIN = 'https://mcp.liveworkspace.test';
const BEFORE = LEGACY_TOKENS_UNTIL - 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let revoked: Set<string>;
let checks: string[];
let answer: () => Response | Promise<Response>;
let env: Env;

function tokenApi(): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const token = request.headers.get('Authorization')!.slice('Bearer '.length);
      checks.push(`${new URL(request.url).pathname} ${token}`);
      if (revoked.has(token)) return Response.json({ error: 'invalid_token' }, { status: 401 });
      return answer();
    },
    connect: () => {
      throw new Error('no sockets');
    },
  };
}

beforeEach(() => {
  forgetBearers();
  revoked = new Set();
  checks = [];
  answer = () => Response.json({ tokenId: 't1' });
  env = {
    ...({} as Record<Binding, Fetcher>),
    OAUTH_KV: mockKV(),
    TOKEN_API: tokenApi(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const signIn = (aud = `${ORIGIN}/mcp`, upstream = 'lwt_account') =>
  issueTokens(env.OAUTH_KV, { aud, clientId: 'client-1', upstream }, BEFORE);

describe('this server’s own access token', () => {
  it('stands for the account token behind it, checked with liveworkspace', async () => {
    const { access_token } = await signIn();
    expect(await resolveBearer(env, access_token, ORIGIN, BEFORE)).toEqual({
      ok: true,
      upstream: 'lwt_account',
      family: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(checks).toEqual(['/api/tokens/current lwt_account']);
  });

  it('is refused on another server: another origin, an old address', async () => {
    const { access_token } = await signIn('https://mcp-staging.liveworkspace.app/mcp');
    expect(await resolveBearer(env, access_token, ORIGIN, BEFORE)).toEqual({
      ok: false,
      description: 'This token was issued for another server. Sign in again.',
    });
    const own = await signIn();
    expect(
      await resolveBearer(env, own.access_token, 'https://mcp.livediagram.app', BEFORE),
    ).toMatchObject({ ok: false });
    expect(checks).toEqual([]);
  });

  it('refuses a made-up one, and any other kind of string, without asking liveworkspace', async () => {
    for (const token of ['lwm_madeup', 'sk-abc', 'eyJhbGciOi.x.y', 'lwr_0123'])
      expect(await resolveBearer(env, token, ORIGIN, BEFORE)).toEqual({
        ok: false,
        description: 'This token is unknown, revoked or expired. Sign in again.',
      });
    expect(checks).toEqual([]);
  });

  it('is refused once its account token is revoked in Settings, and ends its sign-in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tokens = await signIn();
    revoked.add('lwt_account');
    expect(await resolveBearer(env, tokens.access_token, ORIGIN, BEFORE)).toEqual({
      ok: false,
      description: 'This token is no longer accepted (revoked or expired). Sign in again.',
    });
    // Its refresh token stopped too, so the client signs in again rather than refreshing into the same refusal.
    expect(
      await refreshTokens(
        env.OAUTH_KV,
        { refreshToken: tokens.refresh_token, clientId: 'client-1' },
        BEFORE,
      ),
    ).toMatchObject({ error: 'invalid_grant' });
    expect(warn).toHaveBeenCalledWith('[mcp] account token refused by liveworkspace');
  });
});

describe('an account token from before (the move-over window)', () => {
  it('works until the window closes, with a warning at most every ten minutes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE)).toEqual({
      ok: true,
      upstream: 'lwt_old',
      family: null,
    });
    await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE + MINUTE);
    const legacy = () => warn.mock.calls.filter((c) => c[0] === '[mcp] legacy token');
    expect(legacy()).toHaveLength(1);
    expect(legacy()[0]![1]).toEqual({
      token: expect.stringMatching(/^[0-9a-f]{8}$/),
      refusedFrom: '2026-12-27T00:00:00.000Z',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('lwt_old');
    await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE + 11 * MINUTE);
    expect(legacy()).toHaveLength(2);
  });

  it('takes one carried over from the old livediagram.app (`lvd_`) the same way', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await resolveBearer(env, 'lvd_carried', ORIGIN, BEFORE)).toEqual({
      ok: true,
      upstream: 'lvd_carried',
      family: null,
    });
    expect(await resolveBearer(env, 'lvd_carried', ORIGIN, LEGACY_TOKENS_UNTIL)).toMatchObject({
      ok: false,
    });
  });

  it('is refused from the window’s end, without asking liveworkspace', async () => {
    for (const at of [LEGACY_TOKENS_UNTIL, LEGACY_TOKENS_UNTIL + 365 * 24 * 60 * MINUTE])
      expect(await resolveBearer(env, 'lwt_old', ORIGIN, at)).toEqual({
        ok: false,
        description:
          'This connection was made before 2026-12-27 and its token is no longer accepted. Sign in again.',
      });
    expect(checks).toEqual([]);
  });

  it('is refused inside the window when revoked or made up', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    revoked.add('lwt_madeup');
    expect(await resolveBearer(env, 'lwt_madeup', ORIGIN, BEFORE)).toMatchObject({ ok: false });
  });
});

describe('liveworkspace’s check', () => {
  it('is kept a minute per isolate', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE);
    await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE + 30 * 1000);
    expect(checks).toHaveLength(1);
    await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE + MINUTE);
    expect(checks).toHaveLength(2);
  });

  it('lets the request on when liveworkspace can’t answer, for the app call to judge', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    answer = () => new Response('busy', { status: 503 });
    expect(await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE)).toMatchObject({ ok: true });
    forgetBearers();
    answer = () => {
      throw new Error('network connection lost');
    };
    expect(await resolveBearer(env, 'lwt_old', ORIGIN, BEFORE)).toMatchObject({ ok: true });
    expect(error).toHaveBeenCalledWith('[mcp] account token not checked', expect.any(Object));
  });

  it('is skipped where no api is bound (a test’s stubs)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { TOKEN_API: _unused, ...bare } = env;
    expect(await resolveBearer(bare as Env, 'lwt_old', ORIGIN, BEFORE)).toMatchObject({ ok: true });
  });
});
