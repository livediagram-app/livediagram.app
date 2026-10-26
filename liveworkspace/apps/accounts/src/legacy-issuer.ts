// Introspecting an app's access token minted under the bare issuer (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www.").
// Better Auth's introspection only knows its own issuer (BASE_URL + /api/auth), so for the hour after the move an
// access token minted on the bare domain answers inactive there, and the account API's vouching and closing an account
// would refuse it. Such a token is checked again here, as the provider would have: this Worker's own keys, the twin
// issuer, an app audience, the asking client and a live session. Any other inactive answer stays inactive.

import { createLocalJWKSet, decodeJwt, jwtVerify, type JSONWebKeySet } from 'jose';
import { wwwTwin } from '@liveworkspace/sites/www';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';

/** What the introspection gave, or what this check found instead. */
export interface Introspected {
  active?: boolean;
  sub?: unknown;
  client_id?: unknown;
}

/** The twin of this Worker's issuer, the one tokens from before the move carry; null where there is none. */
export function legacyIssuer(env: Pick<Env, 'BASE_URL'>): string | null {
  return wwwTwin(`${env.BASE_URL.replace(/\/+$/, '')}${AUTH_BASE_PATH}`);
}

/** `token` as introspection would have answered it under the twin issuer, for `clientId`, or null when it is not one. */
export async function introspectLegacy(
  token: string,
  clientId: string,
  env: Pick<Env, 'BASE_URL' | 'ENVIRONMENT'>,
  auth: Auth,
): Promise<Introspected | null> {
  const issuer = legacyIssuer(env);
  if (!issuer) return null;
  let claimed: string | undefined;
  try {
    claimed = decodeJwt(token).iss;
  } catch {
    return null;
  }
  // Only a token that says it is from the twin costs a check.
  if (claimed !== issuer) return null;
  try {
    const jwks = (await auth.api.getJwks()) as JSONWebKeySet;
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer,
      audience: RESOURCES[env.ENVIRONMENT],
    });
    if (typeof payload.sub !== 'string' || payload.azp !== clientId) return null;
    if (typeof payload.sid === 'string') {
      const ctx = await auth.$context;
      const session = await ctx.adapter.findOne<{ expiresAt: Date | string }>({
        model: 'session',
        where: [{ field: 'id', value: payload.sid }],
      });
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
    }
    return { active: true, sub: payload.sub, client_id: payload.azp };
  } catch {
    return null;
  }
}

/** Introspection's answer for an app's access token, with the twin issuer's tokens checked here when it says inactive.
 *  `introspect` is the provider's own call; a 401 (a wrong client secret) is never second-guessed. */
export async function introspectWithLegacy(
  introspect: () => Promise<Response>,
  token: string,
  clientId: string,
  env: Pick<Env, 'BASE_URL' | 'ENVIRONMENT'>,
  auth: Auth,
): Promise<{ status: number; result: Introspected }> {
  const checked = await introspect();
  const result = (await checked.json().catch(() => ({}))) as Introspected;
  if (checked.status === 401 || (checked.ok && result.active === true)) {
    return { status: checked.status, result };
  }
  const legacy = await introspectLegacy(token, clientId, env, auth);
  return legacy ? { status: 200, result: legacy } : { status: checked.status, result };
}
