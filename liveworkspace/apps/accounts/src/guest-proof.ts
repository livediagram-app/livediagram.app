// Renewing a guest without the cookie (liveworkspace/docs/specs/003-accounts/accounts.md "Renewing without the
// cookie"). Safari can clear `lw_guest`, so an app renewing a guest token it still holds presents that token by a
// form POST. The POST (guests.ts guestRenewal) checks it here and, when it passes, carries it to the hand-off's GET
// in a short `lw_guest_proof` cookie, since the browser leaves the SameSite=Lax `lw_guest` off a cross-site POST.
// The GET checks it here again; the cookie's guest always wins over it.
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import { withWwwTwin } from '@liveworkspace/sites/www';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { GUEST_ID } from './ids.ts';

export const GUEST_PROOF_COOKIE = 'lw_guest_proof';
// Long enough for the 303 from the POST to its GET, short enough that a proof left behind is soon gone.
export const GUEST_PROOF_COOKIE_MAX_AGE_SECONDS = 120;
// How far back a chain of renewals by token alone may reach: from when the cookie last vouched for the guest (or the
// guest was made), so a stolen token can't be renewed for ever (owner, 2026-11-15).
export const GUEST_PROOF_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
// An `oiat` this far ahead of this Worker's clock is still believed; any further is not ours.
export const GUEST_PROOF_CLOCK_SKEW_SECONDS = 60;

export type GuestProof = { guestId: string; oiat: number };

/** The guest a presented guest token proves, with the time its chain started (`oiat`), or null when it is not a guest
 *  token this Worker signed for `resource`, has lapsed, or its chain is older than GUEST_PROOF_MAX_AGE_SECONDS. */
export async function readGuestProof(
  token: string,
  env: Pick<Env, 'BASE_URL'>,
  auth: Auth,
  resource: string,
  now = Date.now(),
): Promise<GuestProof | null> {
  try {
    const jwks = (await auth.api.getJwks()) as JSONWebKeySet;
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer: withWwwTwin(`${env.BASE_URL}${AUTH_BASE_PATH}`),
      audience: withWwwTwin(resource),
      currentDate: new Date(now),
    });
    if (payload.kind !== 'guest' || typeof payload.sub !== 'string' || !GUEST_ID.test(payload.sub))
      return null;
    // A token minted before `oiat` counts from its own issue.
    const oiat = payload.oiat === undefined ? payload.iat : payload.oiat;
    const nowSeconds = Math.floor(now / 1000);
    if (typeof oiat !== 'number' || !Number.isFinite(oiat)) return null;
    if (oiat > nowSeconds + GUEST_PROOF_CLOCK_SKEW_SECONDS) return null;
    if (nowSeconds - oiat > GUEST_PROOF_MAX_AGE_SECONDS) return null;
    return { guestId: payload.sub, oiat };
  } catch {
    return null;
  }
}

/** The proof cookie: set to a token that passed (`maxAge` GUEST_PROOF_COOKIE_MAX_AGE_SECONDS), or cleared (0).
 *  Host-only, on the hand-off's own path. */
export function guestProofCookie(value: string, maxAge: number, secure: boolean): string {
  // Read here, not at load: auth-options.ts and this module import each other through guests.ts.
  return `${GUEST_PROOF_COOKIE}=${value}; Max-Age=${maxAge}; Path=${AUTH_BASE_PATH}/guest; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Whether a renewal's POST came from the app's own page: its `Origin` is `redirectUri`'s. A page on another site
 *  can't send that, so it can't plant its guest in this browser. */
export function fromRedirectOrigin(request: Request, redirectUri: string): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin) && URL.parse(redirectUri)?.origin === origin;
}
