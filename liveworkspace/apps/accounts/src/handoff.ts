// Signing in on the app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own address").
//
// An app's sign-in still starts with a full-page visit to /oauth2/authorize here, so someone already signed in to
// liveworkspace goes straight back with a code, as before. Someone who isn't is sent to the sign-in pages, and those
// are served under the app's address (each app's router proxies them, @liveworkspace/sites/workspace-proxy), so the
// address bar keeps the app's name. Their calls to this Worker come through the router too, and the session they make
// lives on the app's address only for the length of the sign-in (the router's `flow` cookies).
//
// The session must end up here, on liveworkspace.app, where every other app's sign-in (clicked or silent) finds it.
// So once the sign-in is done, the page asks for a hand-off and the browser makes one top-level visit here, which
// sets the session's cookie on liveworkspace.app and goes straight on to the app's callback:
//
//   1. authorize, here, with no session: the redirect to /sign-in (or /sign-up) is sent to the app's
//      address instead, and this browser gets a nonce in an HttpOnly cookie on /api/auth/handoff; the page's query
//      carries the nonce's hash (`handoff=`).
//   2. POST /api/auth/handoff/start, through the app's router, with the sign-in's session: { return, bind }. `return`
//      must be one of the app's registered redirect URIs on one of its own origins. A one-time token is made (only
//      its hash is kept, with the session, the return address and the nonce's hash, for 60 seconds) and the session's
//      cookie on the app's address is cleared.
//   3. GET /api/auth/handoff?token=, top level, here: the token is spent (once), must be young, and the browser must
//      hold the nonce whose hash it was bound to. Then the session's cookie is set here, a guest's things move to the
//      account, and the browser goes on to the return address, the app's callback with its code.

import type { BetterAuthPlugin } from 'better-auth';
import { appOfOrigin, type AppEnvironment, type AppSiteId } from '@liveworkspace/sites';
import { readCookie } from '@liveworkspace/auth-client/silent';
import { WORKSPACE_PROXY_HEADER } from '@liveworkspace/sites/workspace-proxy';
import { createAuthEndpoint, getSessionFromCtx } from 'better-auth/api';
import { deleteSessionCookie, setSessionCookie } from 'better-auth/cookies';
import { cookieDomain, domainAttribute } from './cookie-scope.ts';
import { GUEST_COOKIE } from './guests.ts';
import { sameSecret } from './secrets.ts';

export const HANDOFF_PATH = '/handoff';
export const HANDOFF_START_PATH = '/handoff/start';
// The nonce cookie, on this Worker's hand-off path alone.
export const HANDOFF_NONCE_COOKIE = 'lw_handoff';
// The query parameter the sign-in pages carry the nonce's hash in, and send back as `bind`.
export const HANDOFF_BIND_PARAM = 'handoff';
// A token lives this long: the hop is one redirect, so a minute is generous.
export const HANDOFF_TTL_SECONDS = 60;
// The nonce lasts as long as typing an emailed code may (the code's ten minutes, and some).
export const HANDOFF_NONCE_MAX_AGE_SECONDS = 900;
// The sign-in pages, whose redirect from authorize goes to the app's address. Not /consent: asked at authorize, it
// is for someone already signed in here, whose session the page needs, so it stays on this site.
const SIGN_IN_PAGES = new Set(['/sign-in', '/sign-up']);
const BIND = /^[A-Za-z0-9_-]{43}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

/** SHA-256, base64url: a token's and a nonce's stored form. */
export async function digest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

// ---------- Where a sign-in may go back to ---------------------------------------------------------------------------

/**
 * The app a return address belongs to, or null: its origin must be one of the app's own in this environment
 * (@liveworkspace/sites appOrigins), and its origin and path exactly one of the redirect URIs registered for that app's
 * OAuth client (`clientId`'s, when given, which must then be that app's). No credentials, no fragment.
 */
export async function appOfReturn(
  db: D1Database,
  environment: AppEnvironment,
  address: string,
  clientId?: string,
): Promise<AppSiteId | null> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  const app = appOfOrigin(url.origin, environment);
  if (!app) return null;
  const base = `${url.origin}${url.pathname}`;
  const rows = await db
    .prepare(
      `SELECT c.redirectUris AS redirectUris FROM oauthClient c JOIN oauth_client_app a ON a.clientId = c.clientId
       WHERE a.app = ? AND (c.disabled IS NULL OR c.disabled = 0)${clientId ? ' AND c.clientId = ?' : ''}`,
    )
    .bind(...(clientId ? [app, clientId] : [app]))
    .all<{ redirectUris: string | null }>();
  for (const row of rows.results ?? []) {
    try {
      const uris: unknown = JSON.parse(row.redirectUris ?? '[]');
      if (Array.isArray(uris) && uris.includes(base)) return app;
    } catch {
      // A client whose URIs don't parse matches nothing.
    }
  }
  return null;
}

/** The app origin a request came through, when an app's router forwarded it (@liveworkspace/sites/workspace-proxy
 *  names the app and the host); null for a request made here directly, or naming a host that isn't an app's. */
export function appOriginOfProxy(request: Request, environment: AppEnvironment): string | null {
  if (!request.headers.has(WORKSPACE_PROXY_HEADER)) return null;
  const host = request.headers.get('x-forwarded-host');
  if (!host) return null;
  const origin = `${environment === 'development' ? 'http' : 'https'}://${host}`;
  return appOfOrigin(origin, environment) ? new URL(origin).origin : null;
}

// ---------- 1. authorize: the sign-in pages on the app's address --------------------------------------------------------

export interface HandoffEnv {
  environment: AppEnvironment;
  // This Worker's own origin (BASE_URL).
  baseUrl: string;
  // Off: the sign-in pages stay on liveworkspace.app, as before.
  enabled: boolean;
  db: D1Database;
}

/**
 * The authorize answer, with a redirect to a sign-in page sent to the app's own address when the request came from
 * one of the app's registered redirect URIs on one of its origins, and this browser given the nonce the hand-off will
 * ask for. Any other answer passes as it is.
 */
export async function signInOnAppAddress(
  request: Request,
  response: Response,
  config: HandoffEnv,
): Promise<Response> {
  if (!config.enabled || response.status !== 302) return response;
  const location = response.headers.get('location');
  if (!location) return response;
  let page: URL;
  try {
    page = new URL(location, config.baseUrl);
  } catch {
    return response;
  }
  if (page.origin !== new URL(config.baseUrl).origin || !SIGN_IN_PAGES.has(page.pathname))
    return response;
  const asked = new URL(request.url).searchParams;
  const redirectUri = asked.get('redirect_uri') ?? '';
  const clientId = asked.get('client_id') ?? '';
  if (!redirectUri || !clientId) return response;
  if (
    !(await appOfReturn(config.db, config.environment, redirectUri, clientId).catch(() => null))
  ) {
    return response;
  }
  const nonce = randomToken();
  page.searchParams.set(HANDOFF_BIND_PARAM, await digest(nonce));
  const headers = new Headers(response.headers);
  headers.set('location', `${new URL(redirectUri).origin}${page.pathname}${page.search}`);
  headers.append(
    'set-cookie',
    nonceCookie(nonce, HANDOFF_NONCE_MAX_AGE_SECONDS, config.environment),
  );
  return new Response(response.body, { status: response.status, headers });
}

function nonceCookie(value: string, maxAge: number, environment: AppEnvironment): string {
  // On the domain in production (cookie-scope.ts): the authorize that sets it and the hand-off that reads it may be
  // on either host while the move to www. lasts.
  return `${HANDOFF_NONCE_COOKIE}=${value}; Path=/api/auth${HANDOFF_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${
    environment === 'development' ? '' : '; Secure'
  }${domainAttribute(cookieDomain(environment))}`;
}

// ---------- 2 and 3: the hand-off itself, as Better Auth endpoints ------------------------------------------------------

export interface HandoffPluginConfig {
  environment: AppEnvironment;
  db: D1Database;
  // A guest's things move to the account at the hop (guests.ts mergeGuestOfRequest), as at any sign-in here: true
  // when they did, and the guest cookie is cleared.
  mergeGuest?: (request: Request, userId: string) => Promise<boolean>;
}

type HandoffRow = {
  sessionId: string;
  userId: string;
  bindHash: string;
  returnUrl: string;
  expiresAt: number;
};

function refusal(message: string, back: string | null): Response {
  const link = back ? ` <a href="${back}">Go back and sign in again</a>.` : '';
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sign-in link</title><p>${message}${link}</p>`,
    {
      status: 400,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    },
  );
}

/** The Better Auth plugin with the two hand-off endpoints. */
export function handoffPlugin(config: HandoffPluginConfig): BetterAuthPlugin {
  return {
    id: 'liveworkspace-handoff',
    endpoints: {
      handoffStart: createAuthEndpoint(
        HANDOFF_START_PATH,
        { method: 'POST', metadata: { SERVER_ONLY: false } },
        async (ctx) => {
          ctx.setHeader('cache-control', 'no-store');
          // Only the sign-in pages on an app's own address ask (Better Auth has checked the origin is a trusted one;
          // this one must be an app's).
          const origin = ctx.request?.headers.get('origin') ?? '';
          if (!appOfOrigin(origin, config.environment)) {
            return (ctx.setStatus(403), ctx.json({ error: 'not_an_app' }));
          }
          const session = await getSessionFromCtx(ctx);
          if (!session) return (ctx.setStatus(401), ctx.json({ error: 'no_session' }));
          // Whatever happens next, the session's cookie leaves the app's address.
          deleteSessionCookie(ctx);
          const body = (ctx.body ?? {}) as { return?: unknown; bind?: unknown };
          const back = typeof body.return === 'string' ? body.return : '';
          const bind = typeof body.bind === 'string' ? body.bind : '';
          if (!BIND.test(bind)) return (ctx.setStatus(400), ctx.json({ error: 'invalid_bind' }));
          const app = await appOfReturn(config.db, config.environment, back);
          if (!app || appOfOrigin(origin, config.environment) !== app) {
            return (ctx.setStatus(400), ctx.json({ error: 'invalid_return' }));
          }
          const token = randomToken();
          const now = Date.now();
          await config.db.batch([
            // Spent and stale tokens go as new ones come: one indexed delete per sign-in.
            config.db.prepare('DELETE FROM sign_in_handoff WHERE expiresAt < ?').bind(now - 60_000),
            config.db
              .prepare(
                'INSERT INTO sign_in_handoff (tokenHash, sessionId, userId, bindHash, returnUrl, expiresAt) VALUES (?, ?, ?, ?, ?, ?)',
              )
              .bind(
                await digest(token),
                session.session.id,
                session.user.id,
                bind,
                back,
                now + HANDOFF_TTL_SECONDS * 1000,
              ),
          ]);
          const url = new URL(`${ctx.context.baseURL}${HANDOFF_PATH}`);
          url.searchParams.set('token', token);
          return ctx.json({ url: url.toString() });
        },
      ),
      handoff: createAuthEndpoint(
        HANDOFF_PATH,
        { method: 'GET', metadata: { SERVER_ONLY: false } },
        async (ctx) => {
          const request = ctx.request;
          const token = new URL(request?.url ?? 'http://x').searchParams.get('token') ?? '';
          if (!request || !TOKEN.test(token))
            return refusal('This sign-in link is not valid.', null);
          // Spent here, once, whatever follows: a second visit with the same token finds nothing to spend.
          const row = await config.db
            .prepare(
              `UPDATE sign_in_handoff SET usedAt = ? WHERE tokenHash = ? AND usedAt IS NULL
               RETURNING sessionId, userId, bindHash, returnUrl, expiresAt`,
            )
            .bind(Date.now(), await digest(token))
            .first<HandoffRow>();
          if (!row) return refusal('This sign-in link was already used, or is not valid.', null);
          const back = new URL(row.returnUrl).origin;
          if (row.expiresAt < Date.now()) return refusal('This sign-in link has expired.', back);
          // The browser that started the sign-in holds the nonce; any other does not.
          const nonce = readCookie(request.headers.get('cookie'), HANDOFF_NONCE_COOKIE);
          if (!nonce || !(await sameSecret(await digest(nonce), row.bindHash))) {
            return refusal('This sign-in was started in another browser.', back);
          }
          // Checked again on the way out, in case the app's registration changed in the minute between.
          if (!(await appOfReturn(config.db, config.environment, row.returnUrl))) {
            return refusal('This sign-in cannot go back to that address.', null);
          }
          const sessionToken = await config.db
            .prepare('SELECT token FROM session WHERE id = ? AND userId = ?')
            .bind(row.sessionId, row.userId)
            .first<string>('token');
          const session = sessionToken
            ? await ctx.context.internalAdapter.findSession(sessionToken)
            : null;
          if (!session || new Date(session.session.expiresAt).getTime() < Date.now()) {
            return refusal('This sign-in has ended.', back);
          }
          await setSessionCookie(ctx, session);
          // Each cleared on the domain where there is one, and host-only for a copy from before the move.
          const domain = cookieDomain(config.environment);
          const clear = (name: string, path: string) => {
            const cleared = {
              path,
              maxAge: 0,
              httpOnly: true,
              sameSite: 'lax',
              secure: config.environment !== 'development',
            } as const;
            if (domain) ctx.setCookie(name, '', { ...cleared, domain });
            ctx.setCookie(name, '', cleared);
          };
          clear(HANDOFF_NONCE_COOKIE, `/api/auth${HANDOFF_PATH}`);
          if (await config.mergeGuest?.(request, row.userId).catch(() => false)) {
            clear(GUEST_COOKIE, '/');
          }
          ctx.setHeader('cache-control', 'no-store');
          ctx.setHeader('referrer-policy', 'no-referrer');
          throw ctx.redirect(row.returnUrl);
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
