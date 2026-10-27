import { describe, expect, it, vi } from 'vitest';
import {
  authorizeUrl,
  closeAccount,
  createPkcePair,
  endAccountsSession,
  endSessionUrl,
  exchangeCode,
  guestHandoffUrl,
  isGuestHandoffState,
  randomState,
  refreshTokens,
  signOutEverywhere,
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
        redirectUri: 'https://www.livediagram.app/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram.app/api',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://liveworkspace.app/api/auth/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://www.livediagram.app/auth/callback',
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
        redirectUri: 'https://www.livediagram.app/auth/callback',
        state: 'st',
        codeChallenge: 'ch',
        resource: 'https://livediagram.app/api',
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
        redirectUri: 'https://www.livediagram.app/auth/guest',
        state: 'abcdefgh',
        resource: 'https://api.livediagram.app',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://liveworkspace.app/api/auth/guest');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      redirect_uri: 'https://www.livediagram.app/auth/guest',
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

  it('drops any run of trailing slashes on the accounts URL, in linear time', () => {
    const at = (accountsUrl: string) =>
      new URL(
        guestHandoffUrl({
          accountsUrl,
          clientId: 'client-1',
          redirectUri: 'https://www.livediagram.app/auth/guest',
          state: 'abcdefgh',
          resource: 'https://api.livediagram.app',
        }),
      ).pathname;
    expect(at('https://liveworkspace.app///')).toBe('/api/auth/guest');
    // A pattern like /\/+$/ backtracks quadratically here; the scan finishes well inside the test's timeout.
    expect(at(`https://liveworkspace.app/a${'/'.repeat(50_000)}`)).toBe('/a/api/auth/guest');
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
        redirectUri: 'https://www.livediagram.app/auth/callback',
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
    expect(String(url)).toBe('https://liveworkspace.app/api/auth/oauth2/token');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('client-1:s3cret')}`,
    );
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      redirect_uri: 'https://www.livediagram.app/auth/callback',
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
      {
        refreshToken: 'rt',
        resource: 'https://livediagram.app/api',
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

describe('signing out everywhere', () => {
  it('ends the session with basic client auth and the refresh token, answering the ticket', async () => {
    const fetchImpl = tokenResponse({ ended: true, ticket: 't1' });
    expect(await endAccountsSession(credentials, 'rt', fetchImpl)).toBe('t1');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://liveworkspace.app/api/auth/end-session');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('client-1:s3cret')}`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'rt' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers null for a refusal, a body without a ticket, or no answer at all', async () => {
    expect(
      await endAccountsSession(credentials, 'rt', tokenResponse({ error: 'invalid_token' }, 401)),
    ).toBeNull();
    expect(await endAccountsSession(credentials, 'rt', tokenResponse({ ended: false }))).toBeNull();
    expect(await endAccountsSession(credentials, 'rt', tokenResponse({ ticket: '' }))).toBeNull();
    const nullBody = vi.fn<typeof fetch>(async () => new Response('null'));
    expect(await endAccountsSession(credentials, 'rt', nullBody)).toBeNull();
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError('network');
    });
    expect(await endAccountsSession(credentials, 'rt', down)).toBeNull();
  });

  it('builds the hop under any path the accounts URL carries', () => {
    const url = new URL(
      endSessionUrl({
        accountsUrl: 'http://localhost:3101/e2e/accounts/',
        clientId: 'client-1',
        postLogoutRedirectUri: 'https://livediagram.app/',
        ticket: 'a.b+c',
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'http://localhost:3101/e2e/accounts/api/auth/end-session',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      post_logout_redirect_uri: 'https://livediagram.app/',
      ticket: 'a.b+c',
    });
  });

  it('answers the hop once the session ended, and nothing without a refresh token or a ticket', async () => {
    const back = 'https://livediagram.app/explorer';
    const fetchImpl = tokenResponse({ ticket: 't1' });
    const next = await signOutEverywhere(
      credentials,
      { refreshToken: 'rt', postLogoutRedirectUri: back },
      fetchImpl,
    );
    expect(new URL(next!).searchParams.get('post_logout_redirect_uri')).toBe(back);
    expect(new URL(next!).searchParams.get('ticket')).toBe('t1');

    const unused = tokenResponse({ ticket: 't1' });
    expect(
      await signOutEverywhere(
        credentials,
        { refreshToken: null, postLogoutRedirectUri: back },
        unused,
      ),
    ).toBeNull();
    expect(unused).not.toHaveBeenCalled();
    expect(
      await signOutEverywhere(
        credentials,
        { refreshToken: 'rt', postLogoutRedirectUri: back },
        tokenResponse({}, 502),
      ),
    ).toBeNull();
  });
});
