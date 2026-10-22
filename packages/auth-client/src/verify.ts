// Checks a liveworkspace access token inside an app's own Worker. This replaces the
// `CLERK_JWKS_URL` check: same shape (a JWT checked against a published key set), so
// verifying stays a local signature check with no call to the accounts Worker per request.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface VerifierOptions {
  // The accounts Worker's issuer, e.g. `https://accounts.liveworkspace.app/api/auth`.
  issuer: string;
  // The resource this app's API was registered as, e.g. `https://livediagram.app/api`.
  // A token minted for another app carries that app's audience and is refused here.
  audience: string;
  // Defaults to `${issuer}/jwks`. Tests pass a local key set instead.
  keys?: JWTVerifyGetKey;
}

export interface AccountClaims {
  // The account id. Accounts carried over from Clerk keep their `user_…` id.
  userId: string;
  email: string | null;
  emailVerified: boolean;
  scopes: string[];
}

// One verifier per isolate: `createRemoteJWKSet` caches the key set and refetches only
// on an unknown `kid` (with a cooldown), so build this once at module scope, not per request.
export function createVerifier(options: VerifierOptions) {
  const keys = options.keys ?? createRemoteJWKSet(new URL(`${options.issuer}/jwks`));

  // The caller's account, or null for a missing, expired, forged or misaddressed token.
  return async function verify(token: string): Promise<AccountClaims | null> {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: options.issuer,
        audience: options.audience,
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
      return {
        userId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified: payload.email_verified === true,
        scopes: typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  };
}
