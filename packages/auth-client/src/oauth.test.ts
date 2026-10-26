import { describe, expect, it, vi } from 'vitest';
import {
  authorizeUrl,
  closeAccount,
  createPkcePair,
  exchangeCode,
  guestHandoffUrl,
  isGuestHandoffState,
  randomState,
  refreshTokens,
} from './oauth';

const credentials = {
  accountsUrl: 'https://liveworkspace.app',
  clientId: 'client-1',
  clientSecret: 's3cret',
};

function tokenResponse(body: Record<string, unknown>, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe('createPkcePair', () => {
  it('derives the S256 challenge from the verifier', async () => {
    const { verifier, challenge } = await createPkcePair();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = Buffer.from(digest).toString('base64url');
    expect(challenge).toBe(expected);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('differs every time', async () => {
    const [a, b] = await Promise.all([createPkcePair(), createPkcePair()]);
    expect(a.verifier).not.toBe(b.verifier);
    expect(randomState()).not.toBe(randomState());
  });
});

describe('authorizeUrl', () => {
  it('builds the authorize request', () => {
    const url = new URL(
      authorizeUrl({
        accountsUrl: credentials.accountsUrl,
        clientId: 'client-1',
        redirectUri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://liveworkspace.app/api/auth/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/callback',
      scope: 'openid email profile offline_access',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
      resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
    });
  });

  it('asks for the registration page with prompt=create', () => {
    const url = new URL(
      authorizeUrl({
        accountsUrl: credentials.accountsUrl,
        clientId: 'client-1',
        redirectUri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
        prompt: 'create',
      }),
    );
    expect(url.searchParams.get('prompt')).toBe('create');
  });
});

describe('guestHandoffUrl', () => {
  it("names the app's client, where to come back and the state", () => {
    const url = new URL(
      guestHandoffUrl({
        accountsUrl: 'https://liveworkspace.app/',
        clientId: 'client-1',
        redirectUri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/guest',
        state: 'abcdefgh',
        resource: 'https://api.livediagram.app',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://liveworkspace.app/api/auth/guest');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      redirect_uri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/guest',
      state: 'abcdefgh',
      resource: 'https://api.livediagram.app',
    });
  });

  it('keeps a path the accounts URL carries (a stand-in served under one)', () => {
    const url = new URL(
      guestHandoffUrl({
        accountsUrl: 'http://127.0.0.1:3132/e2e/accounts',
        clientId: 'client-1',
        redirectUri: 'http://127.0.0.1:3132/auth/guest',
        state: 'abcdefgh',
        resource: 'http://127.0.0.1:8732',
      }),
    );
    expect(url.origin + url.pathname).toBe('http://127.0.0.1:3132/e2e/accounts/api/auth/guest');
  });

  it('takes only a state shaped like one the editor makes', () => {
    expect(isGuestHandoffState(randomState())).toBe(true);
    expect(isGuestHandoffState('short')).toBe(false);
    expect(isGuestHandoffState('has space in it')).toBe(false);
    expect(isGuestHandoffState('x'.repeat(201))).toBe(false);
    expect(isGuestHandoffState(null)).toBe(false);
  });
});

describe('exchangeCode', () => {
  it('posts the code with basic client auth and maps the tokens', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const fetchImpl = tokenResponse({
      access_token: 'at',
      refresh_token: 'rt',
      id_token: 'it',
      expires_in: 3600,
      scope: 'openid email',
    });
    const tokens = await exchangeCode(
      credentials,
      {
        code: 'c',
        redirectUri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/callback',
        codeVerifier: 'v',
        resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
      },
      fetchImpl,
    );
    expect(tokens).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      idToken: 'it',
      expiresAt: 3_601_000,
      scope: 'openid email',
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://liveworkspace.app/api/auth/oauth2/token');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('client-1:s3cret')}`,
    );
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      redirect_uri: 'https://livediagram-router.liveworkspace-easing509.workers.dev/auth/callback',
      code_verifier: 'v',
      resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
    });
  });

  it('throws on an error response', async () => {
    await expect(
      exchangeCode(
        credentials,
        {
          code: 'c',
          redirectUri: 'https://x.app/cb',
          codeVerifier: 'v',
          resource: 'https://x.app/api',
        },
        tokenResponse({ error: 'invalid_grant' }, 400),
      ),
    ).rejects.toThrow('token request failed (400)');
  });

  it('throws when the response has no access token', async () => {
    await expect(
      exchangeCode(
        credentials,
        {
          code: 'c',
          redirectUri: 'https://x.app/cb',
          codeVerifier: 'v',
          resource: 'https://x.app/api',
        },
        tokenResponse({}),
      ),
    ).rejects.toThrow('no access_token');
  });
});

describe('refreshTokens', () => {
  it('sends the refresh grant', async () => {
    const fetchImpl = tokenResponse({ access_token: 'at2' });
    const tokens = await refreshTokens(
      credentials,
      {
        refreshToken: 'rt',
        resource: 'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
      },
      fetchImpl,
    );
    expect(tokens.accessToken).toBe('at2');
    expect(tokens.refreshToken).toBeNull();
    const body = new URLSearchParams(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt');
  });
});

describe('closeAccount', () => {
  it('sends the access token with basic client auth', async () => {
    const fetchImpl = tokenResponse({ deleted: true });
    await closeAccount(credentials, 'at', fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://liveworkspace.app/api/auth/delete-account');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('client-1:s3cret')}`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'at' });
  });

  it('throws when the account was not closed', async () => {
    await expect(
      closeAccount(credentials, 'at', tokenResponse({ error: 'invalid_token' }, 401)),
    ).rejects.toThrow('closing the account failed (401)');
  });
});
