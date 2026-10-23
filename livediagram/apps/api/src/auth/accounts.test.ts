import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountClaims, VerifierOptions } from '@liveworkspace/auth-client';
import type { Env } from '../types';

// @liveworkspace/auth-client does the cryptography and has its own tests; what needs covering here
// is what this worker does with the verdict, and which tokens it never hands over at all.
const verifyMock = vi.fn<(token: string) => Promise<AccountClaims | null>>();
const createVerifierMock = vi.fn((_options: VerifierOptions) => verifyMock);
vi.mock('@liveworkspace/auth-client', () => ({
  createVerifier: (options: VerifierOptions) => createVerifierMock(options),
}));

import { accountCredentials, accountsIssuer, getAccountIdentity } from './accounts';

const CONFIGURED = {
  ACCOUNTS_URL: 'https://accounts.example',
  API_RESOURCE: 'https://livediagram.example/api',
} as unknown as Env;

function request(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('Authorization', authHeader);
  return new Request('https://api.example/whatever', { headers });
}

function claims(over: Partial<AccountClaims> = {}): AccountClaims {
  return {
    userId: 'user_abc',
    email: null,
    emailVerified: false,
    scopes: [],
    teams: null,
    ...over,
  };
}

beforeEach(() => {
  verifyMock.mockReset();
  createVerifierMock.mockClear();
});

// When it returns null the caller falls through to the legacy `X-Owner-Id` header, so the guest
// path keeps serving (docs/specs/014-identity/auth-and-guest-access.md): none of these may throw.
describe('getAccountIdentity (guest fall-through)', () => {
  it('returns null when sign-in is not configured', async () => {
    expect(await getAccountIdentity({} as Env, request('Bearer anything'))).toBeNull();
    expect(
      await getAccountIdentity({ ACCOUNTS_URL: 'https://a' } as Env, request('Bearer t')),
    ).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns null without a Bearer header, never verifying', async () => {
    expect(await getAccountIdentity(CONFIGURED, request(null))).toBeNull();
    expect(await getAccountIdentity(CONFIGURED, request('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(await getAccountIdentity(CONFIGURED, request('Bearer '))).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an API token', `lwt_${'a'.repeat(43)}`],
    ['a workbench session', `lvw_${'w'.repeat(43)}.${'0f'.repeat(32)}`],
  ])('passes %s through to the token paths without verifying', async (_kind, bearer) => {
    expect(await getAccountIdentity(CONFIGURED, request(`Bearer ${bearer}`))).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns null, and logs without the token, when verification fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyMock.mockResolvedValue(null);
    expect(await getAccountIdentity(CONFIGURED, request('Bearer secret-token'))).toBeNull();
    expect(warn).toHaveBeenCalledWith('[auth] access_token_rejected');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
    warn.mockRestore();
  });
});

// Every case here decides an identity the rest of the worker trusts as the owner of the request.
describe('accountCredentials', () => {
  it('is this app’s client at the accounts Worker, or null when any part is unset', () => {
    const env = {
      ACCOUNTS_URL: 'https://accounts.test',
      ACCOUNTS_CLIENT_ID: 'livediagram',
      ACCOUNTS_CLIENT_SECRET: 'secret',
    };
    expect(accountCredentials(env)).toEqual({
      accountsUrl: 'https://accounts.test',
      clientId: 'livediagram',
      clientSecret: 'secret',
    });
    expect(accountCredentials({ ...env, ACCOUNTS_URL: undefined })).toBeNull();
    expect(accountCredentials({ ...env, ACCOUNTS_CLIENT_ID: undefined })).toBeNull();
    expect(accountCredentials({ ...env, ACCOUNTS_CLIENT_SECRET: undefined })).toBeNull();
  });
});

describe('getAccountIdentity (verified token)', () => {
  it('checks the issuer and this API as the audience', async () => {
    verifyMock.mockResolvedValue(claims());
    await getAccountIdentity(
      { ACCOUNTS_URL: 'https://issuer-probe.example/', API_RESOURCE: 'https://lp/api' } as Env,
      request('Bearer t'),
    );
    expect(createVerifierMock).toHaveBeenCalledWith({
      issuer: 'https://issuer-probe.example/api/auth',
      audience: 'https://lp/api',
    });
  });

  it('asserts the account id', async () => {
    verifyMock.mockResolvedValue(claims());
    expect(await getAccountIdentity(CONFIGURED, request('Bearer t'))).toEqual({
      userId: 'user_abc',
      email: null,
      teams: null,
    });
  });

  it('carries the teams claim through, for the teams mirror', async () => {
    const teams = [{ id: 'team1', name: 'Design', role: 'admin' as const }];
    verifyMock.mockResolvedValue(claims({ teams }));
    expect(await getAccountIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({ teams });
  });

  it('trusts the email only once verified, as trimmed lowercase', async () => {
    // Team invites match on it (docs/specs/013-workspace/teams.md).
    verifyMock.mockResolvedValue(claims({ email: '  Ada@Example.COM ', emailVerified: true }));
    expect(await getAccountIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: 'ada@example.com',
    });
    verifyMock.mockResolvedValue(claims({ email: 'ada@example.com', emailVerified: false }));
    expect(await getAccountIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: null,
    });
  });

  it('reads a verified email that is only whitespace as no email', async () => {
    verifyMock.mockResolvedValue(claims({ email: '   ', emailVerified: true }));
    expect(await getAccountIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: null,
    });
  });

  it('builds one verifier per issuer and audience and reuses it', async () => {
    // A verifier per request would refetch the key set on every signed-in call.
    const env = { ACCOUNTS_URL: 'https://cache-probe.example', API_RESOURCE: 'r' } as Env;
    verifyMock.mockResolvedValue(claims());
    await getAccountIdentity(env, request('Bearer t'));
    await getAccountIdentity(env, request('Bearer t'));
    const forThis = createVerifierMock.mock.calls.filter(
      ([o]) => o.issuer === 'https://cache-probe.example/api/auth',
    );
    expect(forThis).toHaveLength(1);
  });
});

describe('accountsIssuer', () => {
  it('is the accounts origin plus /api/auth, or null when unset', () => {
    expect(accountsIssuer({ ACCOUNTS_URL: 'https://a.example' })).toBe(
      'https://a.example/api/auth',
    );
    expect(accountsIssuer({})).toBeNull();
  });
});
