// The Explorer served under an app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on each app's
// address") has no liveworkspace.app session: it is the app's page, signed in by the app's own session. It makes its
// account calls (people's names, their settings, and running their teams) with the bearer the app's session gives
// it, as the editors' Explorer panels do, which the app's router forwards here from `/api/workspace/account/*`: an access
// token this Worker minted for one of the app APIs, or a guest token. The token is checked against this Worker's own
// keys, read in-process (it cannot fetch its own /jwks), and kept for a few minutes per isolate.

import { createPersonVerifier, localKeySet, type PersonClaims } from '@liveworkspace/auth-client';
import type { Auth } from './auth.ts';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';

export type BearerVerify = (token: string) => Promise<PersonClaims | null>;

// How long a verifier keeps the key set before reading it again (a rotated key lands within this).
const KEYS_TTL_MS = 5 * 60_000;

let cached: { key: string; verify: BearerVerify; until: number } | null = null;
let override: ((env: Env) => BearerVerify) | null = null;

/** For tests: check bearers with this instead of the Worker's keys. */
export function __setBearerVerifier(make: ((env: Env) => BearerVerify) | null) {
  override = make;
  cached = null;
}

async function verifierFor(env: Env, auth: Auth, now: number): Promise<BearerVerify> {
  if (override) return override(env);
  const issuer = `${env.BASE_URL}${AUTH_BASE_PATH}`;
  const key = `${issuer} ${env.ENVIRONMENT}`;
  if (cached && cached.key === key && cached.until > now) return cached.verify;
  const jwks = (await auth.api.getJwks()) as Parameters<typeof localKeySet>[0];
  const verify = createPersonVerifier({
    issuer,
    audience: RESOURCES[env.ENVIRONMENT],
    keys: localKeySet(jwks),
  });
  cached = { key, verify, until: now + KEYS_TTL_MS };
  return verify;
}

/** The bearer a request carries, if any (not the index's merge key, which has its own door). */
export function bearerOf(request: Request): string | null {
  return request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

/** Who a bearer names: an account or a guest, or null for a missing, forged, expired or misaddressed one. */
export async function bearerPerson(
  token: string,
  env: Env,
  auth: Auth,
  now = Date.now(),
): Promise<PersonClaims | null> {
  try {
    return await (
      await verifierFor(env, auth, now)
    )(token);
  } catch {
    return null;
  }
}
