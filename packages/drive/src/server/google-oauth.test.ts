import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeGoogle } from '@liveworkspace/fake-google';
import { sentForm, sentUrl } from '@liveworkspace/vitest-config/sent-request';
import { GOOGLE_CALL_TIMEOUT_MS } from '../constants';
import { googleApiBase, googleOAuthBase, type GoogleConfig } from './google';
import {
  exchangeCode,
  fetchGoogleAccountId,
  GoogleOAuthError,
  refreshAccessToken,
  revokeToken,
} from './google-oauth';

// The service's calls to Google's OAuth endpoint and `about` (liveworkspace/docs/drive.md "Tokens").

function stubbed(status: number, body: unknown) {
  const calls: { url: string; form: URLSearchParams; init: RequestInit }[] = [];
  const config: GoogleConfig = {
    clientId: 'client-1',
    clientSecret: 'secret-1',
    baseUrl: 'https://oauth.test/',
    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: sentUrl(input),
        form: init?.body ? sentForm(init) : new URLSearchParams(),
        init: init ?? {},
      });
      return new Response(JSON.stringify(body), { status });
    }),
  };
  return { config, calls };
}

const failing = (error: unknown): GoogleConfig => ({
  clientId: 'client-1',
  clientSecret: 'secret-1',
  baseUrl: 'https://oauth.test',
  fetch: vi.fn().mockRejectedValue(error),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('google bases', () => {
  it('points at Google by default, and at one base URL for the fake, without trailing slashes', () => {
    expect(googleOAuthBase({})).toBe('https://oauth2.googleapis.com');
    expect(googleApiBase({})).toBe('https://www.googleapis.com');
    expect(googleOAuthBase({ baseUrl: '' })).toBe('https://oauth2.googleapis.com');
    expect(googleOAuthBase({ baseUrl: 'http://localhost:3010///' })).toBe('http://localhost:3010');
    expect(googleApiBase({ baseUrl: 'http://localhost:3010/' })).toBe('http://localhost:3010');
  });

  it('strips a long run of slashes in linear time', () => {
    const base = `http://x${'/'.repeat(100_000)}`;
    const started = performance.now();
    expect(googleApiBase({ baseUrl: base })).toBe('http://x');
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('exchangeCode', () => {
  it('posts the code, client credentials and redirect URI, and returns the tokens', async () => {
    const { config, calls } = stubbed(200, {
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3599,
    });
    const out = await exchangeCode(config, 'code-1', 'https://x/drive/connected', 1000);
    expect(out).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: 1000 + 3599 * 1000 });
    expect(calls[0]!.url).toBe('https://oauth.test/token');
    expect(calls[0]!.init.method).toBe('POST');
    expect(Object.fromEntries(calls[0]!.form)).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      client_id: 'client-1',
      client_secret: 'secret-1',
      redirect_uri: 'https://x/drive/connected',
    });
  });

  it('answers a null refresh token when Google sends none', async () => {
    const { config } = stubbed(200, { access_token: 'at', expires_in: 3600 });
    expect(
      (await exchangeCode(config, 'c', 'https://x/drive/connected', 0)).refreshToken,
    ).toBeNull();
  });

  it('throws failed on an error answer, and invalid_grant for a spent code', async () => {
    await expect(
      exchangeCode(stubbed(400, { error: 'invalid_request' }).config, 'c', 'u', 0),
    ).rejects.toMatchObject({
      kind: 'failed',
    });
    await expect(
      exchangeCode(stubbed(400, { error: 'invalid_grant' }).config, 'c', 'u', 0),
    ).rejects.toMatchObject({
      kind: 'invalid_grant',
    });
  });

  it('throws failed on a malformed success or a body that is not JSON', async () => {
    await expect(
      exchangeCode(stubbed(200, { access_token: 'at' }).config, 'c', 'u', 0),
    ).rejects.toMatchObject({
      kind: 'failed',
    });
    await expect(
      exchangeCode(stubbed(200, { expires_in: 5 }).config, 'c', 'u', 0),
    ).rejects.toMatchObject({
      kind: 'failed',
    });
    const config: GoogleConfig = {
      clientId: 'c',
      clientSecret: 's',
      fetch: async () => new Response('<html>oops</html>', { status: 502 }),
    };
    await expect(exchangeCode(config, 'c', 'u', 0)).rejects.toMatchObject({ kind: 'failed' });
  });

  it('redeems a real consent against the fake Google, once', async () => {
    const google = new FakeGoogle();
    const config: GoogleConfig = { clientId: 'c', clientSecret: 's', fetch: google.fetch };
    const code = google.consent('alice');
    const out = await exchangeCode(config, code, 'https://x/drive/connected', 0);
    expect(out.accessToken).toMatch(/^ya29\./);
    expect(out.refreshToken).toMatch(/^1\/\//);
    expect(out.expiresAt).toBe(3600 * 1000);
    await expect(exchangeCode(config, code, 'https://x/drive/connected', 0)).rejects.toMatchObject({
      kind: 'invalid_grant',
    });
  });
});

describe('refreshAccessToken', () => {
  it('mints an access token from the refresh token', async () => {
    const { config, calls } = stubbed(200, { access_token: 'fresh', expires_in: 60 });
    expect(await refreshAccessToken(config, 'rt', 5000)).toEqual({
      accessToken: 'fresh',
      expiresAt: 65_000,
    });
    expect(calls[0]!.url).toBe('https://oauth.test/token');
    expect(calls[0]!.form.get('grant_type')).toBe('refresh_token');
    expect(calls[0]!.form.get('refresh_token')).toBe('rt');
    expect(calls[0]!.form.get('client_secret')).toBe('secret-1');
  });

  it('names invalid_grant, the revoked or expired grant', async () => {
    const { config } = stubbed(400, {
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.',
    });
    const err = await refreshAccessToken(config, 'rt', 0).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleOAuthError);
    expect((err as GoogleOAuthError).kind).toBe('invalid_grant');
    expect((err as GoogleOAuthError).name).toBe('GoogleOAuthError');
  });

  it('treats a network failure as failed', async () => {
    await expect(refreshAccessToken(failing(new Error('offline')), 'rt', 0)).rejects.toMatchObject({
      kind: 'failed',
      message: expect.stringContaining('offline'),
    });
  });

  it('refreshes against the fake Google until the grant is revoked', async () => {
    const google = new FakeGoogle();
    const config: GoogleConfig = { clientId: 'c', clientSecret: 's', fetch: google.fetch };
    const { refreshToken } = await exchangeCode(
      config,
      google.consent('alice'),
      'https://x/drive/connected',
      0,
    );
    expect((await refreshAccessToken(config, refreshToken!, 0)).accessToken).toMatch(/^ya29\./);
    google.revokeGrant('alice');
    await expect(refreshAccessToken(config, refreshToken!, 0)).rejects.toMatchObject({
      kind: 'invalid_grant',
    });
  });
});

describe('revokeToken', () => {
  it('posts the token to the revoke endpoint and reports success', async () => {
    const { config, calls } = stubbed(200, {});
    expect(await revokeToken(config, 'rt')).toBe(true);
    expect(calls[0]!.url).toBe('https://oauth.test/revoke');
    expect(calls[0]!.form.get('token')).toBe('rt');
  });

  it('never throws, logging and reporting false instead', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await revokeToken(failing(new Error('offline')), 'rt')).toBe(false);
    expect(await revokeToken(stubbed(400, { error: 'invalid_token' }).config, 'rt')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('revokes the grant at the fake Google, so the refresh token stops working', async () => {
    const google = new FakeGoogle();
    const config: GoogleConfig = { clientId: 'c', clientSecret: 's', fetch: google.fetch };
    const { refreshToken } = await exchangeCode(
      config,
      google.consent('alice'),
      'https://x/drive/connected',
      0,
    );
    expect(await revokeToken(config, refreshToken!)).toBe(true);
    await expect(refreshAccessToken(config, refreshToken!, 0)).rejects.toMatchObject({
      kind: 'invalid_grant',
    });
  });
});

describe('fetchGoogleAccountId', () => {
  it('answers the permissionId of the account the token acts for', async () => {
    const google = new FakeGoogle();
    const config: GoogleConfig = { clientId: 'c', clientSecret: 's', fetch: google.fetch };
    expect(await fetchGoogleAccountId(config, google.issueAccessToken('alice'))).toBe('alice');
    expect(await fetchGoogleAccountId(config, google.issueAccessToken('bob'))).toBe('bob');
  });

  it('asks about with the bearer token and only the field it needs', async () => {
    const { config, calls } = stubbed(200, { user: { permissionId: 'p-1' } });
    expect(await fetchGoogleAccountId(config, 'at')).toBe('p-1');
    expect(calls[0]!.url).toBe('https://oauth.test/drive/v3/about?fields=user(permissionId)');
    expect(new Headers(calls[0]!.init.headers).get('Authorization')).toBe('Bearer at');
  });

  it('throws failed on an error answer, a missing id, or a network failure', async () => {
    const google = new FakeGoogle();
    const config: GoogleConfig = { clientId: 'c', clientSecret: 's', fetch: google.fetch };
    await expect(fetchGoogleAccountId(config, 'not-a-token')).rejects.toMatchObject({
      kind: 'failed',
    });
    await expect(
      fetchGoogleAccountId(stubbed(200, { user: {} }).config, 'at'),
    ).rejects.toMatchObject({
      kind: 'failed',
    });
    await expect(
      fetchGoogleAccountId(stubbed(200, { user: { permissionId: '' } }).config, 'at'),
    ).rejects.toMatchObject({ kind: 'failed' });
    await expect(fetchGoogleAccountId(failing(new Error('offline')), 'at')).rejects.toBeInstanceOf(
      GoogleOAuthError,
    );
  });
});

// A Google endpoint that never answers fails the call as a network failure would, instead of holding a consent or a
// pass open.
describe('Google call timeout', () => {
  it('throws failed once GOOGLE_CALL_TIMEOUT_MS passes with no answer', async () => {
    // The bound itself is the platform's (AbortSignal.timeout); stand in an already-expired one.
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    const config: GoogleConfig = {
      clientId: 'c',
      clientSecret: 's',
      fetch: vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) throw init.signal.reason;
        return new Response('{}', { status: 200 });
      }),
    };
    await expect(refreshAccessToken(config, 'rt', 0)).rejects.toMatchObject({ kind: 'failed' });
    await expect(fetchGoogleAccountId(config, 'at')).rejects.toMatchObject({ kind: 'failed' });
    expect(timeout).toHaveBeenCalledWith(GOOGLE_CALL_TIMEOUT_MS);
  });
});
