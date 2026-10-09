import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../types';
import { exchangeCode, GoogleOAuthError, refreshAccessToken, revokeToken } from './google-oauth';

// The three calls the broker makes to Google's OAuth endpoint
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Google OAuth").

const env = {
  GOOGLE_CLIENT_ID: 'client-1',
  GOOGLE_CLIENT_SECRET: 'secret-1',
  GOOGLE_OAUTH_BASE_URL: 'https://oauth.test',
} as unknown as Runtime;

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, form: new URLSearchParams(String(init.body)) });
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exchangeCode', () => {
  it('posts the code, client credentials and redirect URI, and returns the tokens', async () => {
    const calls = stubFetch(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3599 });
    const out = await exchangeCode(env, 'code-1', 'https://x/drive/connected', 1000);
    expect(out).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: 1000 + 3599 * 1000 });
    expect(calls[0]!.url).toBe('https://oauth.test/token');
    expect(Object.fromEntries(calls[0]!.form)).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      client_id: 'client-1',
      client_secret: 'secret-1',
      redirect_uri: 'https://x/drive/connected',
    });
  });

  it('answers a null refresh token when Google sends none', async () => {
    stubFetch(200, { access_token: 'at', expires_in: 3600 });
    expect((await exchangeCode(env, 'c', 'https://x/drive/connected', 0)).refreshToken).toBeNull();
  });

  it('throws failed on an error answer', async () => {
    stubFetch(400, { error: 'invalid_request' });
    await expect(exchangeCode(env, 'c', 'u', 0)).rejects.toMatchObject({ kind: 'failed' });
  });
});

describe('refreshAccessToken', () => {
  it('mints an access token from the refresh token', async () => {
    const calls = stubFetch(200, { access_token: 'fresh', expires_in: 60 });
    expect(await refreshAccessToken(env, 'rt', 5000)).toEqual({
      accessToken: 'fresh',
      expiresAt: 65_000,
    });
    expect(calls[0]!.form.get('grant_type')).toBe('refresh_token');
    expect(calls[0]!.form.get('refresh_token')).toBe('rt');
  });

  it('names invalid_grant, the revoked or expired grant', async () => {
    stubFetch(400, {
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.',
    });
    const err = await refreshAccessToken(env, 'rt', 0).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleOAuthError);
    expect((err as GoogleOAuthError).kind).toBe('invalid_grant');
  });

  it('treats a network failure as failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(refreshAccessToken(env, 'rt', 0)).rejects.toMatchObject({ kind: 'failed' });
  });
});

describe('revokeToken', () => {
  it('posts the token to the revoke endpoint and reports success', async () => {
    const calls = stubFetch(200, {});
    expect(await revokeToken(env, 'rt')).toBe(true);
    expect(calls[0]!.url).toBe('https://oauth.test/revoke');
    expect(calls[0]!.form.get('token')).toBe('rt');
  });

  it('never throws, logging and reporting false instead', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await revokeToken(env, 'rt')).toBe(false);
    stubFetch(400, { error: 'invalid_token' });
    expect(await revokeToken(env, 'rt')).toBe(false);
  });
});
