import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../types';

// Clerk JWT verifier — ports the MT pattern (apps/api/src/auth/clerk.ts
// in /Users/thomasmcclean/Code/managers-toolkit-frontend) into
// livediagram's vanilla-fetch Worker. MT's version uses Hono's
// Context; we just take an Env binding + the Request directly because
// livediagram doesn't have Hono.
//
// One JWKS instance per URL is cached at module scope. jose's
// createRemoteJWKSet handles its own HTTP-level key refresh on
// rotation; the cache is purely so a single Worker isolate doesn't
// allocate a new fetcher per request.

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(url: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, jwks);
  }
  return jwks;
}

// The identity a verified Clerk session token asserts. `email` is the
// optional `email` claim (spec/32): present only when the deployment
// has added it to the Clerk SESSION TOKEN (dashboard → Sessions →
// Customize session token → `{"email": "{{user.primary_email_address}}"}`).
// It must be on the session token specifically because the frontend
// authenticates with `getToken()` (no template) — a named JWT template
// is never requested, so configuring one has no effect. It is the ONLY
// email the worker ever trusts — never a client-supplied value —
// because it rides inside the JWKS-verified payload. Null when the
// session token doesn't carry it; teams' invite auto-connection
// degrades gracefully in that case.
export type ClerkIdentity = {
  userId: string;
  email: string | null;
};

// Verify a Clerk session token from `Authorization: Bearer <token>`
// against the JWKS at `env.CLERK_JWKS_URL`. Returns:
//
//   - the identity ({ userId: sub, email: claim-or-null }) on success
//   - null when:
//       * `CLERK_JWKS_URL` is unset (Clerk not configured for this
//         environment — fall through to X-Owner-Id),
//       * no Bearer header was sent (guest request),
//       * the token failed verification (caller falls through to
//         X-Owner-Id — spec/04 keeps the guest path always-available).
//
// Returning null instead of throwing keeps the hybrid model simple:
// callers just `clerkUserId ?? ownerOf(request)` and never see a
// special-case error path.
export async function getClerkIdentity(env: Env, request: Request): Promise<ClerkIdentity | null> {
  const jwksUrl = env.CLERK_JWKS_URL;
  if (!jwksUrl) return null;

  const auth = request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    // jose enforces the JWKS signature (rejecting alg:none / unsigned)
    // and exp/nbf by default. When CLERK_ISSUER / CLERK_AUDIENCE are
    // configured we also assert the `iss` / `aud` claims, so a validly-signed
    // token from a different Clerk instance/tenant sharing the JWKS host — or
    // one minted for a different audience/app — can't be replayed here. Both
    // are left optional (unset → current behaviour) so self-host keeps working;
    // production should set CLERK_ISSUER (and CLERK_AUDIENCE if configured in
    // Clerk).
    const verifyOptions: { issuer?: string; audience?: string } = {};
    if (env.CLERK_ISSUER) verifyOptions.issuer = env.CLERK_ISSUER;
    if (env.CLERK_AUDIENCE) verifyOptions.audience = env.CLERK_AUDIENCE;
    const { payload } = await jwtVerify(token, getJWKS(jwksUrl), verifyOptions);
    if (typeof payload.sub !== 'string') return null;
    const email =
      typeof payload.email === 'string' && payload.email.length > 0
        ? payload.email.trim().toLowerCase()
        : null;
    return { userId: payload.sub, email };
  } catch {
    return null;
  }
}
