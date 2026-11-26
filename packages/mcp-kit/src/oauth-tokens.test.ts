// The one MCP's own tokens (liveworkspace/docs/specs/021-mcp/mcp.md "Tokens"; Work Tracker 1447, 1448): issue,
// rotate, reuse, expiry, audience and the seal.
import { describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TTL_S,
  REFRESH_TOKEN_TTL_S,
  REUSE_GRACE_MS,
  issueTokens,
  isMcpAccessToken,
  refreshTokens,
  resolveAccessToken,
  revokeSignIn,
  seal,
  tokenHash,
  unseal,
  type TokenAnswer,
} from './oauth-tokens';

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

const AUD = 'https://mcp.liveworkspace.test/mcp';
const NOW = Date.UTC(2026, 10, 26, 12);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function signedIn(kv: KVNamespace, upstreamEndsAt = NOW + 180 * DAY) {
  return issueTokens(
    kv,
    { aud: AUD, clientId: 'client-1', upstream: 'lwt_account', upstreamEndsAt },
    NOW,
  );
}

const ok = (answer: TokenAnswer | { error: string }): TokenAnswer => {
  if ('error' in answer) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer;
};

describe('issueTokens', () => {
  it('hands out an hour’s access token and a refresh token, never the account token', async () => {
    const { kv, m } = memoryKV();
    const answer = await signedIn(kv);
    expect(answer.token_type).toBe('Bearer');
    expect(answer.expires_in).toBe(ACCESS_TOKEN_TTL_S);
    expect(isMcpAccessToken(answer.access_token)).toBe(true);
    expect(answer.refresh_token).toMatch(/^lwr_[0-9a-f]{32}/);
    // The store keeps hashes and sealed values: neither token nor the account token is in it.
    const stored = [...m.entries()].map(([k, v]) => `${k} ${v.value}`).join('\n');
    expect(stored).not.toContain('lwt_account');
    expect(stored).not.toContain(answer.access_token);
    expect(stored).not.toContain(answer.refresh_token);
    // Each record expires with its token.
    const ttls = Object.fromEntries([...m.entries()].map(([k, v]) => [k.split(':')[0], v.ttl]));
    expect(ttls).toEqual({ 'mcp-fam': REFRESH_TOKEN_TTL_S, 'mcp-at': ACCESS_TOKEN_TTL_S });
  });

  it('never outlives the account token behind it', async () => {
    const { kv, m } = memoryKV();
    const answer = await signedIn(kv, NOW + 30 * 60 * 1000);
    expect(answer.expires_in).toBe(30 * 60);
    const family = [...m.entries()].find(([k]) => k.startsWith('mcp-fam:'))!;
    expect(family[1].ttl).toBe(30 * 60);
  });

  it('defaults the account token’s end to six months when none was sent', async () => {
    const { kv } = memoryKV();
    const answer = await issueTokens(kv, { aud: AUD, clientId: 'c', upstream: 'lwt_x' }, NOW);
    expect(answer.expires_in).toBe(ACCESS_TOKEN_TTL_S);
  });
});

describe('resolveAccessToken', () => {
  it('opens the account token for its own audience only', async () => {
    const { kv } = memoryKV();
    const { access_token } = await signedIn(kv);
    expect(await resolveAccessToken(kv, access_token, AUD, NOW)).toEqual({
      ok: true,
      upstream: 'lwt_account',
      family: expect.stringMatching(/^[0-9a-f]{32}$/),
      clientId: 'client-1',
    });
    expect(
      await resolveAccessToken(kv, access_token, 'https://mcp.livediagram.app/mcp', NOW),
    ).toEqual({
      ok: false,
      reason: 'audience',
    });
  });

  it('refuses a made-up token, an account token and an expired one', async () => {
    const { kv } = memoryKV();
    const { access_token } = await signedIn(kv);
    expect(await resolveAccessToken(kv, 'lwm_madeup', AUD, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await resolveAccessToken(kv, 'lwt_account', AUD, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await resolveAccessToken(kv, access_token, AUD, NOW + HOUR)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('refuses a token whose seal another token wrote', async () => {
    const { kv, m } = memoryKV();
    const first = await signedIn(kv);
    const second = await signedIn(kv);
    const firstKey = `mcp-at:${await tokenHash(first.access_token)}`;
    const secondKey = `mcp-at:${await tokenHash(second.access_token)}`;
    const swapped = JSON.parse(m.get(firstKey)!.value) as { sealed: string };
    swapped.sealed = (JSON.parse(m.get(secondKey)!.value) as { sealed: string }).sealed;
    m.set(firstKey, { value: JSON.stringify(swapped) });
    expect(await resolveAccessToken(kv, first.access_token, AUD, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});

describe('refreshTokens', () => {
  it('rotates: a new pair, the old refresh token spent, the old access token good to its hour', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    const second = ok(
      await refreshTokens(
        kv,
        { refreshToken: first.refresh_token, clientId: 'client-1' },
        NOW + HOUR,
      ),
    );
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(second.access_token).not.toBe(first.access_token);
    // The same sign-in: its id leads the refresh token.
    expect(second.refresh_token.slice(0, 36)).toBe(first.refresh_token.slice(0, 36));
    expect(await resolveAccessToken(kv, second.access_token, AUD, NOW + HOUR)).toMatchObject({
      ok: true,
      upstream: 'lwt_account',
    });
    const third = ok(
      await refreshTokens(
        kv,
        { refreshToken: second.refresh_token, clientId: 'client-1' },
        NOW + 2 * HOUR,
      ),
    );
    expect(await resolveAccessToken(kv, third.access_token, AUD, NOW + 2 * HOUR)).toMatchObject({
      ok: true,
    });
  });

  it('ends the whole sign-in when a spent refresh token comes back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    const second = ok(
      await refreshTokens(
        kv,
        { refreshToken: first.refresh_token, clientId: 'client-1' },
        NOW + 1000,
      ),
    );
    const replay = await refreshTokens(
      kv,
      { refreshToken: first.refresh_token, clientId: 'client-1' },
      NOW + REUSE_GRACE_MS + 2000,
    );
    expect(replay).toEqual({
      error: 'invalid_grant',
      error_description:
        'This refresh token was already used, so this sign-in has ended. Sign in again.',
    });
    // The chain is gone: the current refresh token, the current and the earlier access tokens.
    expect(
      await refreshTokens(
        kv,
        { refreshToken: second.refresh_token, clientId: 'client-1' },
        NOW + REUSE_GRACE_MS + 3000,
      ),
    ).toMatchObject({ error: 'invalid_grant' });
    expect(
      await resolveAccessToken(kv, second.access_token, AUD, NOW + REUSE_GRACE_MS + 3000),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await resolveAccessToken(kv, first.access_token, AUD, NOW + REUSE_GRACE_MS + 3000),
    ).toMatchObject({
      ok: false,
    });
    expect(warn).toHaveBeenCalledWith(
      '[oauth] spent refresh token presented: ending the sign-in',
      expect.any(Object),
    );
  });

  it('refuses the same token twice at once without ending the sign-in', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    const second = ok(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'client-1' }, NOW),
    );
    expect(
      await refreshTokens(
        kv,
        { refreshToken: first.refresh_token, clientId: 'client-1' },
        NOW + REUSE_GRACE_MS - 1,
      ),
    ).toEqual({
      error: 'invalid_grant',
      error_description: 'This refresh token was just used. Use the tokens that call returned.',
    });
    expect(await resolveAccessToken(kv, second.access_token, AUD, NOW + 1000)).toMatchObject({
      ok: true,
    });
  });

  it('refuses another client’s use without ending the sign-in', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    expect(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'thief' }, NOW),
    ).toEqual({
      error: 'invalid_grant',
      error_description: 'This refresh token was issued to another client.',
    });
    expect(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'client-1' }, NOW),
    ).toHaveProperty('access_token');
  });

  it('expires after 90 days, and with the account token', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    expect(
      await refreshTokens(
        kv,
        { refreshToken: first.refresh_token, clientId: 'client-1' },
        NOW + REFRESH_TOKEN_TTL_S * 1000,
      ),
    ).toEqual({
      error: 'invalid_grant',
      error_description: 'This sign-in has expired. Sign in again.',
    });
    const { kv: kv2 } = memoryKV();
    const short = await signedIn(kv2, NOW + 2 * DAY);
    expect(
      await refreshTokens(
        kv2,
        { refreshToken: short.refresh_token, clientId: 'client-1' },
        NOW + 2 * DAY,
      ),
    ).toMatchObject({ error: 'invalid_grant' });
  });

  it('keeps each refresh good for 90 days from its own issue, within the account token’s life', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    const later = NOW + 80 * DAY;
    const second = ok(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'client-1' }, later),
    );
    expect(
      await refreshTokens(
        kv,
        { refreshToken: second.refresh_token, clientId: 'client-1' },
        later + 85 * DAY,
      ),
    ).toHaveProperty('access_token');
  });

  it('refuses a made-up, malformed or revoked refresh token', async () => {
    const { kv } = memoryKV();
    const first = await signedIn(kv);
    for (const refreshToken of [
      'lwr_',
      'lwr_zz',
      `lwr_${'0'.repeat(32)}abc`,
      'rt_old',
      'lwt_account',
    ])
      expect(await refreshTokens(kv, { refreshToken, clientId: 'client-1' }, NOW)).toMatchObject({
        error: 'invalid_grant',
      });
    const family = first.refresh_token.slice(4, 36);
    await revokeSignIn(kv, family);
    expect(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'client-1' }, NOW),
    ).toMatchObject({ error: 'invalid_grant' });
    expect(await resolveAccessToken(kv, first.access_token, AUD, NOW)).toMatchObject({ ok: false });
  });
});

describe('a damaged sign-in record', () => {
  it('ends the sign-in rather than refreshing into nothing', async () => {
    const { kv, m } = memoryKV();
    const first = await signedIn(kv);
    const key = `mcp-fam:${first.refresh_token.slice(4, 36)}`;
    const record = JSON.parse(m.get(key)!.value) as { sealed: string };
    record.sealed = 'AAAAAAAAAAAAAAAAAAAAAAAA';
    m.set(key, { value: JSON.stringify(record) });
    expect(
      await refreshTokens(kv, { refreshToken: first.refresh_token, clientId: 'client-1' }, NOW),
    ).toEqual({
      error: 'invalid_grant',
      error_description: 'This sign-in can no longer be read. Sign in again.',
    });
    expect(m.has(key)).toBe(false);
  });
});

describe('the seal', () => {
  it('opens only with the token that sealed it', async () => {
    const sealed = await seal('lwt_secret', 'lwm_one');
    expect(await unseal(sealed, 'lwm_one')).toBe('lwt_secret');
    expect(await unseal(sealed, 'lwm_two')).toBeNull();
    expect(await unseal('not base64!', 'lwm_one')).toBeNull();
    expect(await unseal('AAAA', 'lwm_one')).toBeNull();
  });
});
