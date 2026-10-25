// The liveworkspace Explorer's identity (liveworkspace/docs/accounts.md "liveworkspace.app's own token"). The
// Explorer lives on liveworkspace.app itself, which has a session cookie rather than an OAuth client, so it asks
// here for a short-lived token addressed to every app's API: the index takes it (its audiences are those APIs),
// and so does an app's API when the Explorer asks it for an item's preview. A signed-in person gets an access
// token for their account, with their teams; anyone else gets a guest token for the `lw_guest` guest, the same
// guest every app's hand-off names (made here on a first visit).
//
// GET /api/auth/workspace-token → { token, kind, sub, expiresAt }. Same-origin only: a page on another site can
// neither read the answer (no CORS) nor, by Sec-Fetch-Site, make one.
import type { Auth } from './auth.ts';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Env } from './env.ts';
import { noteGuestSeen } from './guest-sweep.ts';
import { readCookie } from '@liveworkspace/auth-client/silent';
import { GUEST_COOKIE, readGuestCookie, signGuestCookie } from './guests.ts';
import { networkOf } from './rate-limit.ts';
import { RESOURCES } from './resources.ts';
import { teamsClaim } from './teams.ts';

export const WORKSPACE_TOKEN_PATH = '/workspace-token';
// Short: the page asks again a minute before it runs out (as an editor renews a grant), and a token that leaks
// from the page is good for minutes, not the year a guest hand-off's is.
export const WORKSPACE_TOKEN_TTL_SECONDS = 15 * 60;
const COOKIE_MAX_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;

const NO_STORE = { 'cache-control': 'no-store' };

export type WorkspaceToken = {
  token: string;
  kind: 'account' | 'guest';
  sub: string;
  expiresAt: number;
};

export async function workspaceToken(
  request: Request,
  env: Env,
  auth: Auth,
  now = Date.now(),
): Promise<Response> {
  // A browser names where a request came from; one from another site is refused. Tools without the header
  // (curl, tests) are let in: without the cookie they are a new guest and nobody else.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'cross_site' }, { status: 403, headers: NO_STORE });
  }
  const iat = Math.floor(now / 1000);
  const exp = iat + WORKSPACE_TOKEN_TTL_SECONDS;
  const base = {
    iss: `${env.BASE_URL}${AUTH_BASE_PATH}`,
    aud: RESOURCES[env.ENVIRONMENT],
    azp: 'liveworkspace.app',
    iat,
    exp,
  };

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (session?.user) {
    const user = session.user;
    const { token } = await auth.api.signJWT({
      body: {
        payload: {
          ...base,
          sub: user.id,
          email: user.email,
          email_verified: user.emailVerified,
          teams: await teamsClaim(env.AUTH_DB, user.id),
        },
      },
    });
    const body: WorkspaceToken = { token, kind: 'account', sub: user.id, expiresAt: exp * 1000 };
    return Response.json(body, { headers: NO_STORE });
  }

  // A guest: the browser's own, or a new one, limited per network as the hand-off is.
  const secret = env.BETTER_AUTH_SECRET;
  const known = await readGuestCookie(
    readCookie(request.headers.get('cookie'), GUEST_COOKIE),
    secret,
  );
  if (!known && env.GUEST_LIMITER) {
    if (!(await env.GUEST_LIMITER.limit({ key: `ip:${networkOf(request)}` })).success) {
      return Response.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
    }
  }
  const guestId = known ?? `guest_${crypto.randomUUID()}`;
  await noteGuestSeen(env.AUTH_DB, guestId).catch((error: unknown) =>
    console.error('Guest seen stamp failed:', error),
  );
  const { token } = await auth.api.signJWT({
    body: { payload: { ...base, sub: guestId, kind: 'guest' } },
  });
  const body: WorkspaceToken = { token, kind: 'guest', sub: guestId, expiresAt: exp * 1000 };
  const headers = new Headers(NO_STORE);
  // Set on every answer, as the hand-off does, so a browser's cap on a cookie's life never drops the guest.
  headers.append(
    'set-cookie',
    `${GUEST_COOKIE}=${await signGuestCookie(guestId, secret)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${
      env.ENVIRONMENT !== 'development' ? '; Secure' : ''
    }`,
  );
  return Response.json(body, { headers });
}
