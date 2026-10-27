// Checks a liveworkspace access token inside an app's own Worker. This replaces the
// `CLERK_JWKS_URL` check: same shape (a JWT checked against a published key set), so
// verifying stays a local signature check with no call to the accounts Worker per request.
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { withWwwTwin } from '@liveworkspace/sites/www';
import { readTeamsClaim, type TeamClaim } from './account';

export interface VerifierOptions {
  // The accounts Worker's issuer, e.g. `https://www.liveworkspace.app/api/auth`. Its bare or www. twin is accepted
  // too while the move to www. lasts (@liveworkspace/sites/www BARE_WWW_TRANSITION), and so is each audience's.
  issuer: string;
  // The resource this app's API was registered as, e.g. `https://livediagram.app/api`.
  // A token minted for another app carries that app's audience and is refused here. A service
  // that serves every app (the One Explorer index) passes each app's resource.
  audience: string | string[];
  // Defaults to `${issuer}/jwks`. Tests pass a local key set instead.
  keys?: JWTVerifyGetKey;
}

export interface AccountClaims {
  // The account id. Accounts carried over from Clerk keep their `user_…` id.
  userId: string;
  email: string | null;
  emailVerified: boolean;
  scopes: string[];
  // The teams the account is in, as liveworkspace minted them into the token; null from a token
  // minted before teams were in it. Up to an hour old, so an app reads it as a sign its own copy may
  // be behind, never as who may see what (liveworkspace/docs/specs/003-accounts/accounts.md "Teams").
  teams: TeamClaim[] | null;
}

// A guest token (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests"): signed with the same keys and
// addressed to the same API resources as an access token, told apart by `kind: "guest"`.
export interface GuestClaims {
  // `guest_<uuid>`, the same in every app.
  guestId: string;
}

export type PersonClaims =
  ({ kind: 'account' } & AccountClaims) | ({ kind: 'guest' } & GuestClaims);

function readAccount(payload: JWTPayload): AccountClaims | null {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
  return {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    scopes: typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
    teams: readTeamsClaim(payload.teams),
  };
}

const isGuestPayload = (payload: JWTPayload) => payload.kind === 'guest';

// The accounts key set, from the issuer's host, else from its twin's: the same keys on both while the move to www.
// lasts, so a check pointed at www. works before www. routes to accounts, and the other way round. The twin is asked
// only when the first fails (an unknown key is retried after jose's own cooldown, so a forged `kid` stays cheap).
export function remoteKeySet(issuer: string): JWTVerifyGetKey {
  return remoteKeySetAt(`${issuer}/jwks`);
}

/** As remoteKeySet, for a key set's own URL (the index's grant keys, say). */
export function remoteKeySetAt(jwksUrl: string): JWTVerifyGetKey {
  const [first, second] = withWwwTwin(jwksUrl).map((at) => createRemoteJWKSet(new URL(at)));
  if (!second) return first!;
  return async (header, token) => {
    try {
      return await first!(header, token);
    } catch (error) {
      try {
        return await second(header, token);
      } catch {
        throw error;
      }
    }
  };
}

function payloadVerifier(options: VerifierOptions) {
  const keys = options.keys ?? remoteKeySet(options.issuer);
  // Worked out once per verifier, not per token: a token minted before the move names the bare host
  // (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www.").
  const issuer = withWwwTwin(options.issuer);
  const audience = [options.audience].flat().flatMap(withWwwTwin);
  return async (token: string): Promise<JWTPayload | null> => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience });
      return payload;
    } catch {
      return null;
    }
  };
}

// One verifier per isolate: `createRemoteJWKSet` caches the key set and refetches only
// on an unknown `kid` (with a cooldown), so build this once at module scope, not per request.
export function createVerifier(options: VerifierOptions) {
  const verifyPayload = payloadVerifier(options);

  // The caller's account, or null for a missing, expired, forged or misaddressed token. A guest
  // token is not an account, so it is refused here too.
  return async function verify(token: string): Promise<AccountClaims | null> {
    const payload = await verifyPayload(token);
    if (!payload || isGuestPayload(payload)) return null;
    return readAccount(payload);
  };
}

// As createVerifier, but a guest token is let in as a guest: for a service that serves guests and
// accounts alike by the same bearer.
export function createPersonVerifier(options: VerifierOptions) {
  const verifyPayload = payloadVerifier(options);

  return async function verifyPerson(token: string): Promise<PersonClaims | null> {
    const payload = await verifyPayload(token);
    if (!payload) return null;
    if (isGuestPayload(payload)) {
      const sub = payload.sub;
      return typeof sub === 'string' && /^guest_[A-Za-z0-9-]{1,100}$/.test(sub)
        ? { kind: 'guest', guestId: sub }
        : null;
    }
    const account = readAccount(payload);
    return account ? { kind: 'account', ...account } : null;
  };
}

/** A key set already in hand (the accounts Worker's own, which it can't fetch from itself), for `keys`. */
export function localKeySet(jwks: JSONWebKeySet): JWTVerifyGetKey {
  return createLocalJWKSet(jwks);
}
