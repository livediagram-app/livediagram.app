import { bearerTokenOf, isApiTokenFormat, isWorkbenchSessionFormat } from '@liveplanner/api-schema';
import { createVerifier, type ClientCredentials, type TeamClaim } from '@liveworkspace/auth-client';
import type { Env } from '../types';

// Checks the access token a signed-in browser sends, minted by the liveworkspace accounts Worker
// (liveworkspace.app, docs/specs/014-identity/auth-and-guest-access.md). The check is local:
// a signature against the accounts Worker's published key set, plus its issuer and this API's own
// audience, so a token minted for livediagram is refused here. No call to the accounts Worker per
// request.

// The issuer is the accounts Worker's Better Auth base path, which is also where its keys live.
export function accountsIssuer(env: Pick<Env, 'ACCOUNTS_URL'>): string | null {
  return env.ACCOUNTS_URL ? `${env.ACCOUNTS_URL.replace(/\/+$/, '')}/api/auth` : null;
}

// The identity a verified access token asserts. `email` is only ever the token's own claim, and only
// once the accounts Worker has verified it (signing in by code is what verifies it): it is the ONLY
// email the worker trusts, because Teams invites match on it (docs/specs/013-workspace/teams.md).
export type AccountIdentity = {
  userId: string;
  email: string | null;
  // The account's teams as liveworkspace saw them when it minted the token (null from an older
  // token): a nudge to catch the teams mirror up (db/team-sync.ts), never what decides access.
  teams: TeamClaim[] | null;
};

// This app's client at the accounts Worker, for the account API (liveworkspace/docs/accounts.md):
// checking API tokens and following teams. Null on a guest-only deployment.
export function accountCredentials(
  env: Pick<Env, 'ACCOUNTS_URL' | 'ACCOUNTS_CLIENT_ID' | 'ACCOUNTS_CLIENT_SECRET'>,
): ClientCredentials | null {
  const { ACCOUNTS_URL, ACCOUNTS_CLIENT_ID, ACCOUNTS_CLIENT_SECRET } = env;
  if (!ACCOUNTS_URL || !ACCOUNTS_CLIENT_ID || !ACCOUNTS_CLIENT_SECRET) return null;
  return {
    accountsUrl: ACCOUNTS_URL,
    clientId: ACCOUNTS_CLIENT_ID,
    clientSecret: ACCOUNTS_CLIENT_SECRET,
  };
}

type Verify = ReturnType<typeof createVerifier>;

// One verifier per issuer + audience for the life of the isolate: `createVerifier` caches the key
// set, so building one per request would refetch it every time.
const verifiers = new Map<string, Verify>();

function verifierFor(issuer: string, audience: string): Verify {
  const key = `${issuer} ${audience}`;
  let verify = verifiers.get(key);
  if (!verify) {
    verify = createVerifier({ issuer, audience });
    verifiers.set(key, verify);
  }
  return verify;
}

// The caller's account from `Authorization: Bearer <token>`, or null when:
//   - sign-in isn't configured (ACCOUNTS_URL or API_RESOURCE unset: a guest-only deployment),
//   - no Bearer was sent (a guest),
//   - the bearer is an API token or a workbench session (their own paths resolve it),
//   - the token failed verification (expired, forged, or minted for another app).
// Null rather than a throw, so callers fall through to X-Owner-Id and the guest path always serves.
export async function getAccountIdentity(
  env: Env,
  request: Request,
): Promise<AccountIdentity | null> {
  const issuer = accountsIssuer(env);
  if (!issuer || !env.API_RESOURCE) return null;

  const token = bearerTokenOf(request.headers.get('Authorization'));
  if (!token) return null;
  if (isApiTokenFormat(token) || isWorkbenchSessionFormat(token)) return null;

  const claims = await verifierFor(issuer, env.API_RESOURCE)(token);
  if (!claims) {
    console.warn('[auth] access_token_rejected');
    return null;
  }
  const email =
    claims.emailVerified && claims.email ? claims.email.trim().toLowerCase() || null : null;
  return { userId: claims.userId, email, teams: claims.teams };
}
