import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
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
