import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// jose does the cryptography; what needs covering here is what this worker
// does with its verdict. Stubbed so the verified branch is reachable without
// a live JWKS host — the early-exit cases below never reach it either way.
type VerifyOptions = { issuer?: string; audience?: string };
type VerifyResult = Promise<{ payload: Record<string, unknown> }>;
const jwtVerifyMock =
  vi.fn<(token: string, jwks: unknown, options: VerifyOptions) => VerifyResult>();
const createRemoteJWKSetMock = vi.fn<(url: URL) => string>(() => 'jwks-handle');
vi.mock('jose', () => ({
  jwtVerify: (token: string, jwks: unknown, options: VerifyOptions) =>
    jwtVerifyMock(token, jwks, options),
  createRemoteJWKSet: (url: URL) => createRemoteJWKSetMock(url),
}));

import { getClerkIdentity } from './clerk';

// `getClerkIdentity` is the spec/04 hybrid identity gate on the api
// worker side: when it returns null, the caller falls through to the
// legacy `X-Owner-Id` header so the guest path keeps serving. The
// "valid token" branch hits a remote JWKS via `jose` and lives in
// integration territory, but every "fall through to guest" branch
// here is a critical, easy-to-pin early exit. A regression in any of
// these would either lock guests out (if a stricter branch started
// throwing) or quietly accept malformed Bearer headers (if the parser
// drifted away from the "Bearer " prefix), and the guest path is the
// editor's promise to never require auth (spec/03 + spec/04).

function makeEnv(jwksUrl: string | undefined): Env {
  // Cast through unknown so the test only fills the fields the helper
  // actually reads; binding shapes for D1 / R2 / Durable Objects are
  // immaterial to the auth path.
  return { CLERK_JWKS_URL: jwksUrl } as unknown as Env;
}

function makeRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('Authorization', authHeader);
  return new Request('https://api.example/whatever', { headers });
}

describe('getClerkIdentity (guest fall-through gate, spec/04)', () => {
  it('returns null when CLERK_JWKS_URL is unset (Clerk not configured for this env)', async () => {
    // Self-host path: a deployment without Clerk leaves the var
    // unset, every request is treated as guest, X-Owner-Id is the
    // only identity signal the api worker honours. spec/03's
    // "don't break self-hosting" rule depends on this branch.
    const result = await getClerkIdentity(makeEnv(undefined), makeRequest('Bearer anything'));
    expect(result).toBeNull();
  });

  it('returns null when the request has no Authorization header', async () => {
    // The guest path: a browser without a Clerk session sends only
    // X-Owner-Id. The helper must not throw or attempt a JWKS fetch
    // here, both would be wasted work on every guest request.
    const result = await getClerkIdentity(
      makeEnv('https://clerk.example/.well-known/jwks.json'),
      makeRequest(null),
    );
    expect(result).toBeNull();
  });

  it('returns null when Authorization is present but missing the "Bearer " prefix', async () => {
    // Defensive against a future client that accidentally sends
    // `Authorization: <token>` (no scheme) or a different scheme
    // like Basic. Anything that isn't a Bearer scheme must fall
    // through to the guest path rather than be interpreted as a
    // raw token.
    const env = makeEnv('https://clerk.example/.well-known/jwks.json');
    expect(await getClerkIdentity(env, makeRequest('jwt-without-scheme'))).toBeNull();
    expect(await getClerkIdentity(env, makeRequest('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(await getClerkIdentity(env, makeRequest('bearer lowercase'))).toBeNull();
  });

  it('returns null when the Bearer prefix is present but the token is empty', async () => {
    // `Bearer ` with no token shouldn't reach jose (it would throw
    // a less helpful error there). The guard at the prefix-strip
    // step keeps the failure quiet and falls through to guest.
    const env = makeEnv('https://clerk.example/.well-known/jwks.json');
    const result = await getClerkIdentity(env, makeRequest('Bearer '));
    expect(result).toBeNull();
  });
});

// The other half: what a token that DOES verify is allowed to assert. Every
// case here decides an identity the rest of the worker then trusts as the
// owner of the request, so a drift means acting as the wrong account.
describe('getClerkIdentity (verified session, spec/04 + spec/32)', () => {
  const JWKS_URL = 'https://clerk.example/.well-known/jwks.json';

  beforeEach(() => {
    jwtVerifyMock.mockReset();
    createRemoteJWKSetMock.mockClear();
  });

  function verifiedWith(payload: Record<string, unknown>) {
    jwtVerifyMock.mockResolvedValue({ payload });
    return makeRequest('Bearer good-token');
  }

  it('asserts the sub claim as the user id', async () => {
    const request = verifiedWith({ sub: 'user_abc' });
    expect(await getClerkIdentity(makeEnv(JWKS_URL), request)).toEqual({
      userId: 'user_abc',
      email: null,
    });
  });

  it('refuses a token whose sub is not a string, however well signed', async () => {
    // A payload without a usable subject identifies nobody; falling through to
    // the guest path is the only safe reading of it.
    const request = verifiedWith({ sub: 12345 });
    expect(await getClerkIdentity(makeEnv(JWKS_URL), request)).toBeNull();
  });

  it('normalises the email claim to trimmed lowercase', async () => {
    // Team invites match on email (spec/32); the session token is the only
    // email the worker trusts, and it has to compare equal to the stored one.
    const request = verifiedWith({ sub: 'user_abc', email: '  Ada@Example.COM ' });
    expect(await getClerkIdentity(makeEnv(JWKS_URL), request)).toEqual({
      userId: 'user_abc',
      email: 'ada@example.com',
    });
  });

  it('treats an empty or non-string email claim as absent', async () => {
    // Deployments that never customised the session token send no email at
    // all; invite auto-connection degrades rather than breaking sign-in.
    const env = makeEnv(JWKS_URL);
    expect(await getClerkIdentity(env, verifiedWith({ sub: 'u', email: '' }))).toEqual({
      userId: 'u',
      email: null,
    });
    expect(await getClerkIdentity(env, verifiedWith({ sub: 'u', email: 42 }))).toEqual({
      userId: 'u',
      email: null,
    });
  });

  it('asserts iss and aud only when the deployment configures them', async () => {
    // Unset is the self-host default and must stay permissive; set, they stop
    // a validly-signed token from another Clerk tenant being replayed here.
    await getClerkIdentity(makeEnv(JWKS_URL), verifiedWith({ sub: 'u' }));
    expect(jwtVerifyMock.mock.calls[0]?.[2]).toEqual({});

    const strict = {
      CLERK_JWKS_URL: JWKS_URL,
      CLERK_ISSUER: 'https://clerk.example',
      CLERK_AUDIENCE: 'livediagram',
    } as unknown as Env;
    await getClerkIdentity(strict, verifiedWith({ sub: 'u' }));
    expect(jwtVerifyMock.mock.calls[1]?.[2]).toEqual({
      issuer: 'https://clerk.example',
      audience: 'livediagram',
    });
  });

  it('falls through to guest when verification throws', async () => {
    // Expired, tampered, wrong key: all the same answer. Returning null rather
    // than throwing is what keeps the guest path always-available.
    jwtVerifyMock.mockRejectedValue(new Error('signature verification failed'));
    const result = await getClerkIdentity(makeEnv(JWKS_URL), makeRequest('Bearer bad-token'));
    expect(result).toBeNull();
  });

  it('builds one JWKS fetcher per URL and reuses it', async () => {
    // Module-scope cache: a new fetcher per request would re-download the key
    // set on every authenticated call.
    const env = makeEnv('https://cache-probe.example/.well-known/jwks.json');
    await getClerkIdentity(env, verifiedWith({ sub: 'u' }));
    await getClerkIdentity(env, verifiedWith({ sub: 'u' }));
    const forThisUrl = createRemoteJWKSetMock.mock.calls.filter(
      ([url]) => url.href === 'https://cache-probe.example/.well-known/jwks.json',
    );
    expect(forThisUrl).toHaveLength(1);
  });
});
