// Signing out everywhere (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"). Signing out in any app, or
// on liveworkspace.app, ends the liveworkspace session and every app's session that came from it, so the next sign-in
// asks for a code or Google and the person can pick another account.
//
//   POST /api/auth/end-session { token }  → an app's Worker, with its client credentials and its refresh token: the
//                                           session that token came from ends, with every app's tokens on it, and a
//                                           five-minute ticket comes back for the browser's hop
//   GET  /api/auth/end-session?client_id=&post_logout_redirect_uri=&ticket=
//                                         → the browser's hop: the session here ends (for the ticket's account) and
//                                           its cookie is cleared, then straight back to the app
//
// Tokens are deleted, never marked revoked: the provider takes a revoked refresh token shown again as a stolen one and
// deletes every refresh token that app holds for the account, on every device. A deleted one is only unknown.
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Auth } from './auth.ts';
import { basicClientId } from './delete-account.ts';
import type { Env } from './env.ts';
import { findClient } from './guests.ts';

export const END_SESSION_PATH = '/end-session';
// Long enough for the page to take the hop it was just handed, short enough that one lifted from a log is stale.
export const TICKET_TTL_SECONDS = 5 * 60;
// A return address the browser could carry, and no longer.
export const REDIRECT_MAX_LENGTH = 2_000;

const NO_STORE = { 'cache-control': 'no-store' };
const encoder = new TextEncoder();

// Sessions per statement, well inside D1's 100 bound parameters.
const SESSIONS_PER_STATEMENT = 40;

// Every app's tokens issued on the sessions, and (unless Better Auth is about to) the sessions themselves, in one batch.
export async function endSessionTokens(
  db: D1Database,
  sessionIds: string | string[],
  { keepSession = false }: { keepSession?: boolean } = {},
): Promise<void> {
  const ids = typeof sessionIds === 'string' ? [sessionIds] : sessionIds;
  const statements: D1PreparedStatement[] = [];
  for (let at = 0; at < ids.length; at += SESSIONS_PER_STATEMENT) {
    const chunk = ids.slice(at, at + SESSIONS_PER_STATEMENT);
    const marks = chunk.map(() => '?').join(', ');
    statements.push(
      db
        .prepare(
          `DELETE FROM oauthAccessToken WHERE sessionId IN (${marks}) OR refreshId IN (SELECT id FROM oauthRefreshToken WHERE sessionId IN (${marks}))`,
        )
        .bind(...chunk, ...chunk),
      db.prepare(`DELETE FROM oauthRefreshToken WHERE sessionId IN (${marks})`).bind(...chunk),
      ...(keepSession
        ? []
        : [db.prepare(`DELETE FROM session WHERE id IN (${marks})`).bind(...chunk)]),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}

// Better Auth's own routes on liveworkspace.app that end sessions: its Sign out, and Settings › Security's Sign Out
// of another device, Sign Out Others and (unused there) every session.
export const SESSION_ENDING_ROUTES = new Set([
  '/sign-out',
  '/revoke-session',
  '/revoke-other-sessions',
  '/revoke-sessions',
]);

// Before Better Auth ends the sessions such a route names, every app's tokens on them go, so those apps sign out
// too. The same checks Better Auth makes: the caller's session, and for one session by its token, only the caller's.
export async function endSessionTokensOf(
  request: Request,
  route: string,
  auth: Auth,
  db: D1Database,
): Promise<void> {
  const found = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!found) return;
  const { id: current, userId } = found.session;
  let ids: string[] = [];
  if (route === '/sign-out') {
    ids = [current];
  } else if (route === '/revoke-session') {
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as { token?: unknown } | null;
    if (typeof body?.token !== 'string') return;
    const row = await db
      .prepare('SELECT id FROM session WHERE token = ? AND userId = ?')
      .bind(body.token, userId)
      .first<{ id: string }>();
    ids = row ? [row.id] : [];
  } else {
    const { results } = await db
      .prepare('SELECT id FROM session WHERE userId = ?')
      .bind(userId)
      .all<{ id: string }>();
    ids = results
      .map((row) => row.id)
      .filter((id) => route === '/revoke-sessions' || id !== current);
  }
  await endSessionTokens(db, ids, { keepSession: true });
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
      c.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

// How the provider keeps a refresh token (its `storeTokens: 'hashed'`, the default): SHA-256, base64url, unpadded.
async function storedToken(token: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

type Ticket = { c: string; s: string; e: number };

// `<payload>.<HMAC>`, the MAC prefixed so it can't stand in for any other use of the secret.
export async function signTicket(ticket: Ticket, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(ticket)));
  const mac = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(`end-session:${payload}`),
  );
  return `${payload}.${base64url(new Uint8Array(mac))}`;
}

// The ticket a hop carries, or null when it is missing, forged, malformed or out of date.
export async function readTicket(
  value: string | null,
  secret: string,
  now = Date.now(),
): Promise<Ticket | null> {
  const dot = value?.lastIndexOf('.') ?? -1;
  if (!value || dot <= 0) return null;
  const payload = value.slice(0, dot);
  const mac = fromBase64url(value.slice(dot + 1));
  if (
    !mac ||
    !(await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      mac,
      encoder.encode(`end-session:${payload}`),
    ))
  ) {
    return null;
  }
  const bytes = fromBase64url(payload);
  try {
    const ticket = JSON.parse(new TextDecoder().decode(bytes!)) as Partial<Ticket>;
    return typeof ticket.c === 'string' &&
      typeof ticket.s === 'string' &&
      typeof ticket.e === 'number' &&
      ticket.e * 1000 > now
      ? { c: ticket.c, s: ticket.s, e: ticket.e }
      : null;
  } catch {
    return null;
  }
}

const refuse = (error: string, status = 400) =>
  Response.json({ error }, { status, headers: NO_STORE });

type Introspected = { active?: unknown; sub?: unknown; client_id?: unknown };

// POST /api/auth/end-session from an app's Worker.
export async function endSessionFromApp(
  request: Request,
  env: Pick<Env, 'AUTH_DB' | 'BETTER_AUTH_SECRET'>,
  auth: Auth,
  now = Date.now(),
): Promise<Response> {
  const authorization = request.headers.get('authorization');
  const clientId = basicClientId(authorization);
  // `?? {}` too: a body of `null` parses, and reading `.token` off it would answer 500 instead of 400.
  const body = ((await request.json().catch(() => null)) ?? {}) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  if (!authorization || !clientId || !token) return refuse('invalid_request');

  // The provider checks the client's secret and the token together, so a token on its own ends nothing.
  const checked = await auth.handler(
    new Request(new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url), {
      method: 'POST',
      headers: {
        authorization,
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token, token_type_hint: 'refresh_token' }).toString(),
    }),
  );
  if (checked.status === 401) return refuse('invalid_client', 401);
  const result = (await checked.json().catch(() => ({}))) as Introspected;
  if (
    checked.status !== 200 ||
    result.active !== true ||
    typeof result.sub !== 'string' ||
    result.client_id !== clientId
  ) {
    return refuse('invalid_token', 401);
  }

  const db = env.AUTH_DB;
  const row = await db
    .prepare('SELECT id, sessionId FROM oauthRefreshToken WHERE token = ?')
    .bind(await storedToken(token))
    .first<{ id: string; sessionId: string | null }>();
  if (row?.sessionId) {
    await endSessionTokens(db, row.sessionId);
  } else if (row) {
    // Its session is gone already: this token, and what it minted, go on their own.
    await db.batch([
      db.prepare('DELETE FROM oauthAccessToken WHERE refreshId = ?').bind(row.id),
      db.prepare('DELETE FROM oauthRefreshToken WHERE id = ?').bind(row.id),
    ]);
  }
  const ticket = await signTicket(
    { c: clientId, s: result.sub, e: Math.floor(now / 1000) + TICKET_TTL_SECONDS },
    env.BETTER_AUTH_SECRET,
  );
  return Response.json({ ended: Boolean(row?.sessionId), ticket }, { headers: NO_STORE });
}

// An address on the origin of one of the client's registered redirect URIs, normalised; else null.
export function allowedReturn(value: string, registered: string[]): string | null {
  if (!value || value.length > REDIRECT_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    return null;
  }
  const origins = new Set(
    registered.flatMap((uri) => {
      try {
        return [new URL(uri).origin];
      } catch {
        return [];
      }
    }),
  );
  return origins.has(url.origin) ? url.href : null;
}

// GET /api/auth/end-session: the browser's hop. Never sends it anywhere but an origin the client registered.
export async function endSessionInBrowser(
  request: Request,
  env: Pick<Env, 'AUTH_DB' | 'BETTER_AUTH_SECRET'>,
  auth: Auth,
  now = Date.now(),
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const clientId = params.get('client_id') ?? '';
  const client = clientId ? await findClient(env.AUTH_DB, clientId) : null;
  if (!client) return refuse('invalid_client');
  const back = allowedReturn(params.get('post_logout_redirect_uri') ?? '', client.redirectUris);
  if (!back) return refuse('invalid_redirect_uri');

  const headers = new Headers({ location: back, ...NO_STORE, 'referrer-policy': 'no-referrer' });
  const ticket = await readTicket(params.get('ticket'), env.BETTER_AUTH_SECRET, now);
  // Without a ticket from the app's own sign-out a link from anywhere could sign the person out, so nothing ends.
  if (ticket?.c === clientId) {
    const found = await auth.api.getSession({ headers: request.headers }).catch(() => null);
    // Another account's session is not the one the person asked to leave.
    if (!found || found.user.id === ticket.s) {
      if (found) await endSessionTokens(env.AUTH_DB, found.session.id);
      // Better Auth's own sign-out for the cookie: cleared on the domain, as it was set.
      try {
        const signedOut = await auth.api.signOut({
          headers: request.headers,
          body: { disableRedirect: true },
          returnHeaders: true,
        });
        for (const cookie of signedOut.headers.getSetCookie()) headers.append('set-cookie', cookie);
      } catch (error) {
        console.error('[end-session] sign-out failed', error);
      }
    }
  }
  return new Response(null, { status: 302, headers });
}
