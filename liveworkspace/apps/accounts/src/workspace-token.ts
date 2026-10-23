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
import { GUEST_COOKIE, readGuestCookie, signGuestCookie } from './guests.ts';
import { RESOURCES } from './resources.ts';
import { isProfileOwner, MAX_PROFILE_IDS, readProfiles } from './profiles.ts';
import { teamsClaim } from './teams.ts';

export const WORKSPACE_TOKEN_PATH = '/workspace-token';
export const WORKSPACE_PROFILES_PATH = '/workspace-profiles';
// Short: the page asks again a minute before it runs out (as an editor renews a grant), and a token that leaks
// from the page is good for minutes, not the year a guest hand-off's is.
export const WORKSPACE_TOKEN_TTL_SECONDS = 15 * 60;
const COOKIE_MAX_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;

const NO_STORE = { 'cache-control': 'no-store' };

function cookieValue(header: string | null, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

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
    cookieValue(request.headers.get('cookie'), GUEST_COOKIE),
    secret,
  );
  if (!known && env.GUEST_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.GUEST_LIMITER.limit({ key: `ip:${ip}` })).success) {
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

// The names the Explorer shows for who did what (What Happened, the Timeline): the index keeps ids only, so the
// page reads them here, up to MAX_PROFILE_IDS at a time, in one query.
//
// POST /api/auth/workspace-profiles { ids } → { profiles: [{ id, name }] }. Same-origin only, and only for a
// signed-in person or a guest this browser already is (it never makes one): a profile's name is what every
// collaborator already sees on a cursor or a comment, and nothing else of the profile is answered.
export async function workspaceProfiles(request: Request, env: Env, auth: Auth): Promise<Response> {
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    request.headers.get('origin') !== new URL(env.BASE_URL).origin
  ) {
    return Response.json({ error: 'cross_site' }, { status: 403, headers: NO_STORE });
  }
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const guest = session?.user
    ? null
    : await readGuestCookie(
        cookieValue(request.headers.get('cookie'), GUEST_COOKIE),
        env.BETTER_AUTH_SECRET,
      );
  if (!session?.user && !guest) {
    return Response.json({ error: 'signed_out' }, { status: 401, headers: NO_STORE });
  }
  const body: unknown = await request.json().catch(() => null);
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isProfileOwner)) {
    return Response.json({ error: 'ids_required' }, { status: 400, headers: NO_STORE });
  }
  if (ids.length > MAX_PROFILE_IDS) {
    return Response.json({ error: 'too_many_ids' }, { status: 400, headers: NO_STORE });
  }
  const profiles = (await readProfiles(env.AUTH_DB, ids)).map(({ id, name }) => ({ id, name }));
  return Response.json({ profiles }, { headers: NO_STORE });
}
