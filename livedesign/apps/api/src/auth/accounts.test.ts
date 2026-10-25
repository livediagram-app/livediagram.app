import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountClaims, PersonClaims, VerifierOptions } from '@liveworkspace/auth-client';
import type { Env } from '../types';

// @liveworkspace/auth-client does the cryptography and has its own tests; what needs covering here
// is what this worker does with the verdict, and which tokens it never hands over at all.
const verifyMock = vi.fn<(token: string) => Promise<PersonClaims | null>>();
const createVerifierMock = vi.fn((_options: VerifierOptions) => verifyMock);
vi.mock('@liveworkspace/auth-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client')>()),
  createPersonVerifier: (options: VerifierOptions) => createVerifierMock(options),
}));

import { accountsIssuer, getPersonIdentity } from './accounts';

const CONFIGURED = {
  ACCOUNTS_URL: 'https://accounts.example',
  API_RESOURCE: 'https://livedesign.example/api',
} as unknown as Env;

function request(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('Authorization', authHeader);
  return new Request('https://api.example/whatever', { headers });
}

function claims(over: Partial<AccountClaims> = {}): PersonClaims {
  return {
    kind: 'account',
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

// When it returns null the caller has no identity (a link visitor, or a token the token paths resolve): none of
// these may throw.
describe('getPersonIdentity (guest fall-through)', () => {
  it('returns null when sign-in is not configured', async () => {
    expect(await getPersonIdentity({} as Env, request('Bearer anything'))).toBeNull();
    expect(
      await getPersonIdentity({ ACCOUNTS_URL: 'https://a' } as Env, request('Bearer t')),
    ).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns null without a Bearer header, never verifying', async () => {
    expect(await getPersonIdentity(CONFIGURED, request(null))).toBeNull();
    expect(await getPersonIdentity(CONFIGURED, request('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(await getPersonIdentity(CONFIGURED, request('Bearer '))).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an API token', `lwt_${'a'.repeat(43)}`],
    ['a workbench session', `lvw_${'w'.repeat(43)}.${'0f'.repeat(32)}`],
  ])('passes %s through to the token paths without verifying', async (_kind, bearer) => {
    expect(await getPersonIdentity(CONFIGURED, request(`Bearer ${bearer}`))).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns null, and logs without the token, when verification fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyMock.mockResolvedValue(null);
    expect(await getPersonIdentity(CONFIGURED, request('Bearer secret-token'))).toBeNull();
    expect(warn).toHaveBeenCalledWith('[auth] access_token_rejected');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
    warn.mockRestore();
  });
});

// Every case here decides an identity the rest of the worker trusts as the owner of the request.
describe('getPersonIdentity (verified token)', () => {
  it('checks the issuer and this API as the audience', async () => {
    verifyMock.mockResolvedValue(claims());
    await getPersonIdentity(
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
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toEqual({
      kind: 'account',
      userId: 'user_abc',
      email: null,
      teams: null,
    });
  });

  it("asserts a guest's id from liveworkspace's guest token", async () => {
    verifyMock.mockResolvedValue({ kind: 'guest', guestId: 'guest_abc' });
    expect(await getPersonIdentity(CONFIGURED, request('Bearer g'))).toEqual({
      kind: 'guest',
      guestId: 'guest_abc',
    });
  });

  it('carries the teams claim through, for the grants asked on its behalf', async () => {
    const teams = [{ id: 'team1', name: 'Design', role: 'admin' as const }];
    verifyMock.mockResolvedValue(claims({ teams }));
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({ teams });
  });

  it('trusts the email only once verified, as trimmed lowercase', async () => {
    // Team invites match on it (docs/specs/013-workspace/teams.md).
    verifyMock.mockResolvedValue(claims({ email: '  Ada@Example.COM ', emailVerified: true }));
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: 'ada@example.com',
    });
    verifyMock.mockResolvedValue(claims({ email: 'ada@example.com', emailVerified: false }));
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: null,
    });
    verifyMock.mockResolvedValue(claims({ email: '   ', emailVerified: true }));
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: null,
    });
  });

  it('reads a verified email that is only whitespace as no email', async () => {
    verifyMock.mockResolvedValue(claims({ email: '   ', emailVerified: true }));
    expect(await getPersonIdentity(CONFIGURED, request('Bearer t'))).toMatchObject({
      email: null,
    });
  });

  it('builds one verifier per issuer and audience and reuses it', async () => {
    // A verifier per request would refetch the key set on every signed-in call.
    const env = { ACCOUNTS_URL: 'https://cache-probe.example', API_RESOURCE: 'r' } as Env;
    verifyMock.mockResolvedValue(claims());
    await getPersonIdentity(env, request('Bearer t'));
    await getPersonIdentity(env, request('Bearer t'));
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

// On another app's address the Explorer asks as that app (@liveworkspace/auth-client explorer-reads.ts).
describe('getPersonIdentity (the Explorer’s reads)', () => {
  const LIVE = { ...CONFIGURED, API_RESOURCE: 'https://livedesign.app/api' } as unknown as Env;
  const at = (path: string, method = 'GET') =>
    new Request(`https://www.livedesign.app${path}`, {
      method,
      headers: { Authorization: 'Bearer t' },
    });

  it('takes any app’s token for an item’s tabs', async () => {
    verifyMock.mockResolvedValue(claims());
    await getPersonIdentity(LIVE, at('/api/designs/x1/tabs'));
    const audiences = createVerifierMock.mock.calls.map(([o]) => o.audience);
    expect(audiences).toContainEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
      'https://liveplanner.app/api',
      'https://livedocuments.app/api',
      'https://livedesign.app/api',
    ]);
  });

  it('takes only its own for anything else, a write to the tabs included', async () => {
    verifyMock.mockResolvedValue(claims());
    await getPersonIdentity(LIVE, at('/api/designs/x2'));
    await getPersonIdentity(LIVE, at('/api/designs/x2/tabs', 'PUT'));
    expect(createVerifierMock.mock.calls.map(([o]) => o.audience)).toEqual([
      'https://livedesign.app/api',
    ]);
    expect(verifyMock).toHaveBeenCalledTimes(2);
  });
});
