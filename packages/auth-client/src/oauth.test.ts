import { describe, expect, it, vi } from 'vitest';
import { authorizeUrl, createPkcePair, exchangeCode, randomState, refreshTokens } from './oauth';

const credentials = {
  accountsUrl: 'https://accounts.liveworkspace.app',
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
        redirectUri: 'https://livediagram.app/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram.app/api',
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://accounts.liveworkspace.app/api/auth/oauth2/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://livediagram.app/auth/callback',
      scope: 'openid email profile offline_access',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
      resource: 'https://livediagram.app/api',
    });
  });

  it('asks for the registration page with prompt=create', () => {
    const url = new URL(
      authorizeUrl({
        accountsUrl: credentials.accountsUrl,
        clientId: 'client-1',
        redirectUri: 'https://livediagram.app/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram.app/api',
        prompt: 'create',
      }),
    );
    expect(url.searchParams.get('prompt')).toBe('create');
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
        redirectUri: 'https://livediagram.app/auth/callback',
        codeVerifier: 'v',
        resource: 'https://livediagram.app/api',
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
    expect(String(url)).toBe('https://accounts.liveworkspace.app/api/auth/oauth2/token');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('client-1:s3cret')}`,
    );
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      redirect_uri: 'https://livediagram.app/auth/callback',
      code_verifier: 'v',
      resource: 'https://livediagram.app/api',
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
      { refreshToken: 'rt', resource: 'https://livediagram.app/api' },
      fetchImpl,
    );
    expect(tokens.accessToken).toBe('at2');
    expect(tokens.refreshToken).toBeNull();
    const body = new URLSearchParams(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt');
  });
});
