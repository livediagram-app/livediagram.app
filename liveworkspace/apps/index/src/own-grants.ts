// A grant the index itself signed (grants.ts), checked on the index: connected tabs' doors take the host's grant
// (liveworkspace/docs/specs/004-index/blueprints/connected-tabs.md "Checking the host's grant"). The check is offline,
// against the index's own public key, which is imported once per key id.

import { GRANT_ALG, isApp, isLevel, type App, type Level } from '@liveworkspace/index-client';
import { importJWK, jwtVerify } from 'jose';
import type { Env } from './env';
import { grantIssuer, signingKey } from './grants';

export type OwnGrant = {
  // The item's app (the grant's audience).
  app: App;
  // `user_…`, `guest_…` or `link:<code>`.
  sub: string;
  item: string;
  level: Level;
  tab: string | null;
  // The share code the access came through, or null for the owner and the team.
  link: string | null;
};

// The public key for a key id: one entry, replaced when the signing key rotates.
let verifying: { kid: string; key: Promise<CryptoKey> } | null = null;

// The grant's claims, or null for a missing, expired, forged or malformed one, or where the index signs none.
export async function verifyOwnGrant(
  env: Env,
  token: string | null | undefined,
): Promise<OwnGrant | null> {
  if (!token) return null;
  const signing = await signingKey(env);
  if (!signing) return null;
  if (verifying?.kid !== signing.kid) {
    verifying = {
      kid: signing.kid,
      key: importJWK(signing.publicJwk, GRANT_ALG) as Promise<CryptoKey>,
    };
  }
  try {
    const { payload } = await jwtVerify(token, await verifying.key, {
      algorithms: [GRANT_ALG],
      issuer: grantIssuer(env),
      requiredClaims: ['iss', 'sub', 'exp', 'iat', 'jti'],
    });
    const { aud, sub, item, level, tab, link } = payload as Record<string, unknown>;
    if (
      !isApp(aud) ||
      typeof sub !== 'string' ||
      typeof item !== 'string' ||
      !isLevel(level) ||
      (tab !== null && typeof tab !== 'string') ||
      (link !== undefined && typeof link !== 'string')
    ) {
      return null;
    }
    return { app: aud, sub, item, level, tab, link: link ?? null };
  } catch {
    return null;
  }
}
