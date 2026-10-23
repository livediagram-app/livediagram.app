// Checks a grant inside an app (its api Worker or an item's Durable Object): an ES256 JWT the index
// signed, saying who may open which item at what level. The check is offline, against the index's
// published keys, as `@liveworkspace/auth-client` checks access tokens: `createRemoteJWKSet` caches the
// key set and refetches only on an unknown `kid`, so build one verifier per isolate, not per request.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { GRANT_ALG, isApp, isLevel, type App } from './constants';
import type { GrantClaims } from './types';

export interface GrantVerifierOptions {
  // The index's key set, e.g. `https://liveworkspace.app/api/index/jwks` (GRANT_JWKS_URL).
  jwksUrl: string;
  // This app: a grant for another app's item is refused.
  audience: App;
  // The index's issuer, e.g. `https://liveworkspace.app/api/index`. Checked when given.
  issuer?: string;
  // Tests pass a local key set instead of fetching one.
  keys?: JWTVerifyGetKey;
}

const nullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

export function createGrantVerifier(options: GrantVerifierOptions) {
  const keys = options.keys ?? createRemoteJWKSet(new URL(options.jwksUrl));

  // The grant's claims, or null for a missing, expired, forged, malformed or misaddressed one.
  return async function verifyGrant(token: string): Promise<GrantClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: [GRANT_ALG],
        audience: options.audience,
        ...(options.issuer ? { issuer: options.issuer } : {}),
        requiredClaims: ['iss', 'sub', 'exp', 'iat', 'jti'],
      });
      const { iss, aud, sub, item, level, tab, team, iat, exp, jti } = payload as Record<
        string,
        unknown
      >;
      if (
        typeof iss !== 'string' ||
        !isApp(aud) ||
        typeof sub !== 'string' ||
        sub.length === 0 ||
        typeof item !== 'string' ||
        item.length === 0 ||
        !isLevel(level) ||
        !nullableString(tab) ||
        !nullableString(team) ||
        typeof iat !== 'number' ||
        typeof exp !== 'number' ||
        typeof jti !== 'string'
      ) {
        return null;
      }
      return { iss, aud, sub, item, level, tab, team, iat, exp, jti };
    } catch {
      return null;
    }
  };
}

export type GrantVerifier = ReturnType<typeof createGrantVerifier>;
