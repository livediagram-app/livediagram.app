// Sign-in Methods over an app's bearer (liveworkspace/docs/specs/003-accounts/accounts.md "Every account setting in
// every app"): whether Google is connected, and connecting it from an app's Settings.
//
// Connecting is Better Auth's own link-social, which needs the account's session and leaves a state cookie that must
// be in the browser when Google comes back. Neither reaches an app's address: the app holds only its access token,
// and its router passes no cookies on /api/workspace/account. So the bearer's call answers a hop on this Worker's own
// address instead, carrying a short ticket for the session the access token was minted under; the hop starts
// link-social for that session, hands the browser the state cookie alone, and sends it on to Google, which comes back
// to Better Auth's callback here as for any link.
import { makeSignature } from 'better-auth/crypto';
import { withWwwTwin } from '@liveworkspace/sites/www';
import { allAppOrigins, type Auth } from './auth.ts';
import { REDIRECT_MAX_LENGTH } from './end-session.ts';
import type { Env } from './env.ts';
import { sameSecret } from './secrets.ts';

export const LINK_GOOGLE_PATH = '/link-google';
// The hop is one click away, so five minutes is generous; one lifted from a log is stale.
export const LINK_TICKET_TTL_SECONDS = 5 * 60;

export type GoogleMethod = 'connected' | 'available' | 'off';

const NO_STORE = { 'cache-control': 'no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const error = (status: number, code: string) => json({ error: code }, status);

const googleOn = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function hasGoogle(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS linked FROM account WHERE userId = ? AND providerId = 'google' LIMIT 1")
    .bind(userId)
    .first<{ linked: number }>();
  return Boolean(row);
}

/** GET /api/account/sign-in-methods: one query on `account_userId_idx`. */
export async function signInMethods(env: Env, userId: string): Promise<Response> {
  const google: GoogleMethod = (await hasGoogle(env.AUTH_DB, userId))
    ? 'connected'
    : googleOn(env)
      ? 'available'
      : 'off';
  return json({ google });
}

/** Where a link may come back to: an absolute http(s) address with no credentials on one of the apps' own origins in
 *  this environment, or this Worker's own (and its twin while the move to www. lasts), the origins Better Auth trusts.
 *  Null for anything else. */
export function linkCallback(value: unknown, env: Env): string | null {
  if (typeof value !== 'string' || !value || value.length > REDIRECT_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    return null;
  }
  const origins = new Set([
    ...allAppOrigins(env.ENVIRONMENT),
    ...withWwwTwin(new URL(env.BASE_URL).origin),
  ]);
  return origins.has(url.origin) ? url.href : null;
}

// ---------- The ticket ---------------------------------------------------------------------------------------------

type Ticket = { u: string; s: string; c: string; e: number };

const encoder = new TextEncoder();

function base64url(text: string): string {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64url(text: string): string | null {
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

// Prefixed, so the MAC can stand in for no other use of the secret.
const macOf = (payload: string, secret: string) => makeSignature(`link-google:${payload}`, secret);

export async function signLinkTicket(ticket: Ticket, secret: string): Promise<string> {
  const payload = base64url(JSON.stringify(ticket));
  return `${payload}.${await macOf(payload, secret)}`;
}

/** The ticket a hop carries, or null when it is missing, forged, malformed or out of date. */
export async function readLinkTicket(
  value: string | null,
  secret: string,
  now = Date.now(),
): Promise<Ticket | null> {
  const dot = value?.lastIndexOf('.') ?? -1;
  if (!value || dot <= 0) return null;
  const payload = value.slice(0, dot);
  if (!(await sameSecret(value.slice(dot + 1), await macOf(payload, secret)))) return null;
  try {
    const t = JSON.parse(fromBase64url(payload) ?? '') as Partial<Ticket>;
    return typeof t.u === 'string' &&
      typeof t.s === 'string' &&
      typeof t.c === 'string' &&
      typeof t.e === 'number' &&
      t.e * 1000 > now
      ? { u: t.u, s: t.s, c: t.c, e: t.e }
      : null;
  } catch {
    return null;
  }
}

// ---------- Starting, over the bearer ------------------------------------------------------------------------------

type LiveSession = { token: string };

// The session by id, when it is the account's and still live.
async function liveSession(
  db: D1Database,
  userId: string,
  sessionId: string,
  now: number,
): Promise<LiveSession | null> {
  const row = await db
    .prepare('SELECT token, expiresAt FROM session WHERE id = ? AND userId = ?')
    .bind(sessionId, userId)
    .first<{ token: string; expiresAt: string | number }>();
  if (!row) return null;
  const expires = typeof row.expiresAt === 'number' ? row.expiresAt : Date.parse(row.expiresAt);
  return expires > now ? { token: row.token } : null;
}

/** POST /api/account/sign-in-methods/google { callbackURL } → { url }, the hop that starts connecting Google. */
export async function startGoogleLink(
  request: Request,
  env: Env,
  userId: string,
  sessionId: string | null,
  now = Date.now(),
): Promise<Response> {
  if (!googleOn(env)) return error(409, 'google_off');
  const db = env.AUTH_DB;
  if (await hasGoogle(db, userId)) return error(409, 'already_connected');
  const body: unknown = await request.json().catch(() => ({}));
  const callback = linkCallback(
    body && typeof body === 'object' ? (body as { callbackURL?: unknown }).callbackURL : null,
    env,
  );
  if (!callback) return error(400, 'invalid_callback');
  if (!sessionId || !(await liveSession(db, userId, sessionId, now))) {
    return error(409, 'session_ended');
  }
  const ticket = await signLinkTicket(
    { u: userId, s: sessionId, c: callback, e: Math.floor(now / 1000) + LINK_TICKET_TTL_SECONDS },
    env.BETTER_AUTH_SECRET,
  );
  const url = new URL(`${env.BASE_URL}/api/auth${LINK_GOOGLE_PATH}`);
  url.searchParams.set('ticket', ticket);
  return json({ url: url.toString() });
}

// ---------- The hop, on this Worker's own address ------------------------------------------------------------------

function back(callback: string, code: string): Response {
  const url = new URL(callback);
  url.searchParams.set('error', code);
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), ...NO_STORE, 'referrer-policy': 'no-referrer' },
  });
}

const nameOf = (setCookie: string) => setCookie.slice(0, Math.max(setCookie.indexOf('='), 0));

/** GET /api/auth/link-google?ticket=: starts Better Auth's link-social for the ticket's session and goes to Google. */
export async function linkGoogleHop(
  request: Request,
  env: Env,
  auth: Auth,
  now = Date.now(),
): Promise<Response> {
  const secret = env.BETTER_AUTH_SECRET;
  const ticket = await readLinkTicket(new URL(request.url).searchParams.get('ticket'), secret, now);
  // Checked again on the way out, in case the apps' origins changed since it was signed.
  const callback = ticket ? linkCallback(ticket.c, env) : null;
  if (!ticket || !callback) return error(400, 'invalid_ticket');
  const session = await liveSession(env.AUTH_DB, ticket.u, ticket.s, now);
  if (!session) return back(callback, 'session_ended');

  const context = await auth.$context;
  // The session's own cookie, signed as Better Auth signs it, in this call's headers alone: the browser never gets it.
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(
    `${session.token}.${await makeSignature(session.token, secret)}`,
  )}`;
  let started: { headers: Headers; response: { url?: string } };
  try {
    started = await auth.api.linkSocialAccount({
      headers: new Headers({ cookie }),
      body: {
        provider: 'google',
        callbackURL: callback,
        errorCallbackURL: callback,
        disableRedirect: true,
      },
      returnHeaders: true,
    });
  } catch (cause) {
    console.error('[link-google] start failed', cause);
    return back(callback, 'link_failed');
  }
  const google = started.response.url;
  if (!google) return back(callback, 'link_failed');

  const headers = new Headers({ location: google, ...NO_STORE, 'referrer-policy': 'no-referrer' });
  // Only the flow's state cookie goes to the browser; a session cookie Better Auth refreshed on the way never does.
  const state = new Set(
    ['state', 'oauth_state'].map((name) => context.createAuthCookie(name).name),
  );
  for (const set of started.headers.getSetCookie()) {
    if (state.has(nameOf(set))) headers.append('set-cookie', set);
  }
  return new Response(null, { status: 302, headers });
}
