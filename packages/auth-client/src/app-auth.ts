// /api/auth/*: an app's api Worker signing in through the liveworkspace accounts Worker (each product's
// docs/specs/014-identity/auth-and-guest-access.md "Signing in"). Every product's apps/api/src/routes/auth.ts binds
// this once with its cookie names, its return-path rule, its PKCE cookie codec and its responses, and keeps the
// route table's entry point and types at its old path.
//
// The app and liveworkspace.app are separate sites, so the browser is sent there on a full-page visit and comes back
// with a one-time code (OAuth 2.1 authorization code + PKCE). The api swaps the code for tokens, because the swap
// sends the client secret. The refresh token stays there, in an HttpOnly cookie scoped to /api/auth: the page only
// ever holds a short-lived access token in memory, which it sends as `Authorization: Bearer`.
//
//   GET  /api/auth/sign-in?return_to=/path  → the accounts site
//   GET  /api/auth/callback?code&state       → back in the app, signed in
//   POST /api/auth/token                     → { accessToken, expiresAt, user }
//   GET  /api/auth/silent?return=/path       → the accounts site with prompt=none, and straight back:
//                                              signed in, or a guest (liveworkspace/docs/specs/003-accounts/accounts.md
//                                              "Signing in without a click")
//   GET  /api/auth/guest?state=              → the accounts site's guest handoff, which comes back to
//                                              /auth/guest#guest_token=…&state=… (liveworkspace/docs/specs/003-accounts/
//                                              accounts.md "Guests")
//   POST /api/auth/sign-out?return=/path     → ends the liveworkspace session too, drops the refresh cookie,
//                                              remembers the sign-out, and answers the hop through the accounts
//                                              site the page takes (liveworkspace/docs/specs/003-accounts/
//                                              accounts.md "Signing out")
//
// Handled before the caller's identity is resolved (each api's src/index.ts): none of these carry a Bearer, so they
// would otherwise all share one 'anonymous' write-rate bucket.

import { profilePictureOf } from '@liveworkspace/sites/picture';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import { accountNameCookies, accountNameCookieFor } from './account-name';
import {
  authorizeUrl,
  createPkcePair,
  exchangeCode,
  guestHandoffUrl,
  isGuestHandoffState,
  randomState,
  refreshTokens,
  signOutEverywhere,
  type TokenSet,
} from './oauth';
import {
  finishSilentSignIn,
  signedOutCookie,
  signOutSilentCookies,
  silentCookiesForHint,
  startSilentSignIn,
} from './silent';
import type { PkceCookie } from './pkce-cookie';

const COOKIE_PATH = '/api/auth';
// Ten minutes to type the emailed code; the accounts Worker's own code lasts as long.
const PKCE_MAX_AGE_SECONDS = 600;
// The refresh token's own lifetime is set by the accounts Worker; the cookie only needs to outlast it.
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 3600;
const DEFAULT_RETURN = '/explorer/home';

// What the page renders for the signed-in account (AuthControls, Settings, the editor's name).
export type AppAuthUser = {
  id: string;
  email: string | null;
  // The header's name first, as liveworkspace.app's (accountNameOf).
  givenName: string | null;
  // Only where the app asks for it (`familyName: true`).
  familyName?: string | null;
  name: string | null;
  // The profile's presence colour (the ID token's `presence_color`), for the avatar; null for Automatic.
  color: string | null;
  // The account's Google picture (the ID token's `picture`, liveworkspace/docs/specs/003-accounts/accounts.md
  // "Profile pictures"), for the person's own avatar; null without one.
  picture: string | null;
  // Show My Google Picture is off (`picture_hidden`): the person's own chrome still shows it, but presence and
  // anything others see leave it out.
  pictureHidden: boolean;
};

// The bindings the routes read.
export type AppAuthEnv = {
  ACCOUNTS_URL?: string;
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  API_RESOURCE?: string;
  AUTH_ORIGIN?: string;
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
};

export type AppAuthConfigured = {
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
  resource: string;
};

// What a product's binding hands in. Where the products' copies had drifted, the difference is an option here.
export type AppAuthOptions<Env extends AppAuthEnv> = {
  // The readable signed-in hint's name (each api-schema's SIGNED_IN_HINT_COOKIE).
  hintCookie: string;
  // The HttpOnly cookies, scoped to /api/auth: `<prefix>_pkce` and `<prefix>_refresh`.
  pkceCookie: string;
  refreshCookie: string;
  // Only a path on this site, else the Explorer (each product's own rule over auth-client/return-path).
  safeReturnPath: (value: string | null) => string;
  // The PKCE cookie's codec: the verifier, the state and the return path. It needs no signature: only this browser
  // can present it, and `state` must match what came back.
  encodePkce: (value: PkceCookie) => string;
  decodePkce: (raw: string | null) => PkceCookie | null;
  // The user carries the ID token's `family_name` (liveplanner).
  familyName?: boolean;
  // The redirect percent-encodes a Location's characters past ASCII as UTF-8 (livedesign).
  asciiLocation?: boolean;
  // The token answer says how old the ID token is (livedesign).
  tokenAge?: boolean;
  json: (body: unknown, init?: ResponseInit) => Response;
  notFound: () => Response;
  rateLimited: () => Response;
  clientRateKey: (request: Request) => string;
  // Session·SignedUp / SignedIn (docs/specs/017-telemetry/telemetry.md), counted once per completed sign-in.
  reportSignIn: (env: Env, userId: string) => Promise<unknown>;
};

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

// The accounts Worker and this app's client there, or null on a guest-only deployment.
export function configured(env: AppAuthEnv): AppAuthConfigured | null {
  const { ACCOUNTS_URL, ACCOUNTS_CLIENT_ID, ACCOUNTS_CLIENT_SECRET, API_RESOURCE } = env;
  if (!ACCOUNTS_URL || !ACCOUNTS_CLIENT_ID || !ACCOUNTS_CLIENT_SECRET || !API_RESOURCE) return null;
  return {
    accountsUrl: ACCOUNTS_URL,
    clientId: ACCOUNTS_CLIENT_ID,
    clientSecret: ACCOUNTS_CLIENT_SECRET,
    resource: API_RESOURCE,
  };
}

function jwtPayload(token: string | null): Record<string, unknown> | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const bytes = Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// How long ago the ID token was minted (its `iat`), by this Worker's clock, so the page can compare it with a Show
// My Google Picture save without trusting its own clock to agree with the accounts Worker's. Within the accounts
// Worker's refresh-token reuse window a refresh replays an earlier response, whose claims predate any save made
// since (docs/specs/014-identity/profile-and-email-notifications.md "Avatars"). Null without an `iat`.
function tokenAgeOf(tokens: TokenSet, now: number): number | null {
  const payload = jwtPayload(tokens.idToken) ?? jwtPayload(tokens.accessToken);
  const iat = payload?.iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null;
  return Math.max(0, now - iat * 1000);
}

function noStore(cookies: string[] = []): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return headers;
}

export function createAppAuth<Env extends AppAuthEnv, User extends AppAuthUser = AppAuthUser>(
  options: AppAuthOptions<Env>,
) {
  const { hintCookie: HINT, pkceCookie: PKCE_COOKIE, refreshCookie: REFRESH_COOKIE } = options;
  const { json, safeReturnPath } = options;
  // Signing in without a click: the signed-out mark, the loop guard and the bounce's own PKCE cookie.
  const SILENT_COOKIES = silentCookiesForHint(HINT);
  // The readable account name beside the hint (`<prefix>account`, liveworkspace/docs/specs/003-accounts/accounts.md
  // "An app's signed-in cookies"): who is signed in, for the marketing header's account menu.
  const ACCOUNT_NAME_COOKIE = accountNameCookieFor(HINT);

  // Where the browser comes back to. The page's own origin in production (the router hands this worker the request
  // as the browser sent it); AUTH_ORIGIN for local dev, where the router proxies to localhost and the request no
  // longer carries the address the browser is on.
  const appOrigin = (env: Env, request: Request): string =>
    withoutTrailingSlashes(env.AUTH_ORIGIN ?? '') || new URL(request.url).origin;

  const callbackUrl = (env: Env, request: Request) =>
    `${appOrigin(env, request)}/api/auth/callback`;

  // Secure everywhere: browsers treat http://localhost as a secure context, so local dev keeps it too.
  function cookie(name: string, value: string, maxAge: number, sameSite: 'Lax' | 'Strict'): string {
    return `${name}=${value}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
  }

  const clearCookie = (name: string) => cookie(name, '', 0, 'Lax');

  // The readable hint (not HttpOnly, the whole site), and no secret: only whether this browser has a session, `1`
  // or `0` (packages/api-schema/src/signed-in-hint.ts). Every request still authenticates with the access token.
  // Kept for as long as a session could live either way, so a signed-out browser reads as signed out rather than as
  // one that never had sign-in.
  const hintCookie = (signedIn: boolean) =>
    `${HINT}=${signedIn ? '1' : '0'}; Path=/; Secure; SameSite=Lax; Max-Age=${REFRESH_MAX_AGE_SECONDS}`;

  // The account's readable name and full name, kept as long as the hint; cleared with no account.
  const nameCookies = (user: User | null) =>
    accountNameCookies(ACCOUNT_NAME_COOKIE, user, REFRESH_MAX_AGE_SECONDS);

  // The refresh token, the hint and the name, set together.
  const sessionCookies = (refreshToken: string, user: User | null) => [
    cookie(REFRESH_COOKIE, refreshToken, REFRESH_MAX_AGE_SECONDS, 'Strict'),
    hintCookie(true),
    ...nameCookies(user),
  ];
  const signedOutCookies = () => [
    clearCookie(REFRESH_COOKIE),
    hintCookie(false),
    ...nameCookies(null),
  ];

  // The ID token's profile claims. Not verified here: it came straight back from the accounts Worker's token
  // endpoint over TLS, and it only decides what the page shows, never who the caller is (the access token does
  // that, checked on every request).
  function userOf(tokens: TokenSet): User | null {
    const payload = jwtPayload(tokens.idToken) ?? jwtPayload(tokens.accessToken);
    if (!payload || typeof payload.sub !== 'string' || !payload.sub) return null;
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return {
      id: payload.sub,
      email: text(payload.email),
      givenName: text(payload.given_name),
      ...(options.familyName ? { familyName: text(payload.family_name) } : {}),
      name: text(payload.name),
      color: text(payload.presence_color),
      picture: profilePictureOf(payload.picture),
      pictureHidden: payload.picture_hidden === true,
    } as User;
  }

  function redirect(location: string, cookies: string[]): Response {
    // A header holds bytes, not text: with `asciiLocation`, a return path's characters past ASCII go
    // percent-encoded as UTF-8, as a browser sends them, or building the header throws.
    const to = options.asciiLocation
      ? location.replace(/[\u0080-￿]+/g, (run) => encodeURIComponent(run))
      : location;
    const headers = new Headers({ Location: to, 'Cache-Control': 'no-store' });
    for (const c of cookies) headers.append('Set-Cookie', c);
    return new Response(null, { status: 302, headers });
  }

  const credentials = (config: AppAuthConfigured) => ({
    accountsUrl: config.accountsUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  async function signIn(request: Request, env: Env, config: AppAuthConfigured): Promise<Response> {
    const url = new URL(request.url);
    const { verifier, challenge } = await createPkcePair();
    const state = randomState();
    const returnTo = safeReturnPath(url.searchParams.get('return_to'));
    // Create account (the Guest menu, /get-started) asks for the accounts site's registration page rather than its
    // sign-in.
    const prompt = url.searchParams.get('screen') === 'sign-up' ? 'create' : undefined;
    const to = authorizeUrl({
      accountsUrl: config.accountsUrl,
      clientId: config.clientId,
      redirectUri: callbackUrl(env, request),
      state,
      codeChallenge: challenge,
      resource: config.resource,
      prompt,
    });
    return redirect(to, [
      cookie(
        PKCE_COOKIE,
        options.encodePkce({ state, verifier, returnTo }),
        PKCE_MAX_AGE_SECONDS,
        'Lax',
      ),
    ]);
  }

  async function callback(
    request: Request,
    env: Env,
    config: AppAuthConfigured,
    waitUntil: (p: Promise<unknown>) => void,
  ): Promise<Response> {
    const url = new URL(request.url);
    // Back from a silent bounce (its own cookie, so a clicked sign-in in another tab is left alone): signed in when
    // the accounts site had a session, a guest when not, and either way back where the page was.
    const silent = await finishSilentSignIn({
      request,
      credentials: credentials(config),
      resource: config.resource,
      callbackUrl: callbackUrl(env, request),
      cookies: SILENT_COOKIES,
      cookiePath: COOKIE_PATH,
    });
    if (silent) {
      if (!silent.tokens?.refreshToken) return redirect(silent.returnTo, silent.cookies);
      const silentUser = userOf(silent.tokens);
      if (silentUser) waitUntil(options.reportSignIn(env, silentUser.id));
      return redirect(silent.returnTo, [
        ...silent.cookies,
        ...sessionCookies(silent.tokens.refreshToken, silentUser),
      ]);
    }
    const pkce = options.decodePkce(readCookie(request, PKCE_COOKIE));
    const code = url.searchParams.get('code');
    // A missing or mismatched state is a stale tab, a second sign-in started elsewhere, or a forged callback.
    // Starting again is the answer to all three, so it goes back to the sign-in page.
    if (!pkce || !code || pkce.state !== url.searchParams.get('state')) {
      return redirect(`/sign-in?error=expired`, [clearCookie(PKCE_COOKIE)]);
    }
    let tokens: TokenSet;
    try {
      tokens = await exchangeCode(credentials(config), {
        code,
        redirectUri: callbackUrl(env, request),
        codeVerifier: pkce.verifier,
        resource: config.resource,
      });
    } catch (err) {
      console.warn('[auth] code_exchange_failed', err instanceof Error ? err.message : 'unknown');
      return redirect(`/sign-in?error=failed`, [clearCookie(PKCE_COOKIE)]);
    }
    if (!tokens.refreshToken) {
      console.warn('[auth] code_exchange_without_refresh_token');
      return redirect(`/sign-in?error=failed`, [clearCookie(PKCE_COOKIE)]);
    }
    // This is the one moment a sign-in completes, so it is counted here, once, off the response path.
    const user = userOf(tokens);
    if (user) waitUntil(options.reportSignIn(env, user.id));
    return redirect(pkce.returnTo, [
      clearCookie(PKCE_COOKIE),
      ...sessionCookies(tokens.refreshToken, user),
      // Signed in again: silent sign-in may run here again.
      signedOutCookie(SILENT_COOKIES, false),
    ]);
  }

  async function token(request: Request, config: AppAuthConfigured): Promise<Response> {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    if (!refreshToken) {
      return json({ signedIn: false }, { status: 401, headers: noStore([hintCookie(false)]) });
    }
    let tokens: TokenSet;
    try {
      tokens = await refreshTokens(credentials(config), {
        refreshToken,
        resource: config.resource,
      });
    } catch (err) {
      // Revoked, expired, or the account was deleted: signed out. The cookie goes so the next load doesn't ask
      // again.
      console.warn('[auth] refresh_failed', err instanceof Error ? err.message : 'unknown');
      return json({ signedIn: false }, { status: 401, headers: noStore(signedOutCookies()) });
    }
    const user = userOf(tokens);
    const cookies = tokens.refreshToken
      ? sessionCookies(tokens.refreshToken, user)
      : nameCookies(user);
    const tokenAgeMs = options.tokenAge ? tokenAgeOf(tokens, Date.now()) : null;
    return json(
      {
        signedIn: true,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        user,
        ...(tokenAgeMs === null ? {} : { tokenAgeMs }),
      },
      { headers: noStore(cookies) },
    );
  }

  // Signing out everywhere in this browser (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"): the
  // accounts site ends the liveworkspace session this refresh token came from, and every app's session from it, and
  // answers the hop the page takes through liveworkspace.app, which clears its cookie there and comes back to
  // `?return=` on this site. `next` is null with no refresh token or no answer: then this app alone is signed out.
  // Signed out of this app alone (`next` null), that is remembered (the signed-out mark) until the next sign-in
  // here, so signing in without a click never undoes it. Signed out everywhere, nothing is: the next bounce finds no
  // session.
  async function signOut(request: Request, env: Env, config: AppAuthConfigured): Promise<Response> {
    const returnTo = safeReturnPath(new URL(request.url).searchParams.get('return'));
    const next = await signOutEverywhere(credentials(config), {
      refreshToken: readCookie(request, REFRESH_COOKIE),
      postLogoutRedirectUri: `${appOrigin(env, request)}${returnTo}`,
    });
    return json(
      { signedIn: false, next },
      {
        headers: noStore([
          ...signedOutCookies(),
          ...signOutSilentCookies(SILENT_COOKIES, next !== null),
        ]),
      },
    );
  }

  // GET /api/auth/silent?return=: the page's boot script sends a browser here once per browser session when it has
  // no session in this app (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in without a click"). Handled
  // before the configuration check and the rate limit, because the page is waiting on it: whatever happens it goes
  // back to where it came from, never to an error page.
  async function silent(
    request: Request,
    env: Env,
    config: AppAuthConfigured | null,
  ): Promise<Response> {
    const returnTo = safeReturnPath(new URL(request.url).searchParams.get('return'));
    if (config && env.WRITE_RATE_LIMITER) {
      const ok = await env.WRITE_RATE_LIMITER.limit({
        key: `auth:${options.clientRateKey(request)}`,
      });
      if (!ok.success) return redirect(returnTo, []);
    }
    return startSilentSignIn({
      request,
      config,
      callbackUrl: callbackUrl(env, request),
      fallbackReturn: DEFAULT_RETURN,
      cookies: SILENT_COOKIES,
      cookiePath: COOKIE_PATH,
    });
  }

  // A guest's identity is liveworkspace's (liveworkspace/docs/specs/003-accounts/accounts.md "Guests"): the browser
  // goes to the accounts site with this app's client, which answers with a 45-day guest token in the fragment of
  // /auth/guest. Routed through here so the client id and resource live in one place; the editor makes and checks
  // `state` itself.
  function guest(request: Request, env: Env, config: AppAuthConfigured | null): Response {
    const state = new URL(request.url).searchParams.get('state');
    if (!isGuestHandoffState(state)) return json({ error: 'invalid_state' }, { status: 400 });
    // No accounts site to ask: straight back, saying so, and the page carries on without a guest identity.
    if (!config) {
      const fragment = new URLSearchParams({ error: 'guest_not_configured', state }).toString();
      // A path, not appOrigin: the browser stays on the address it is on. Locally the router hands this worker its
      // own address, so without AUTH_ORIGIN an absolute URL would leave the app for the api worker (a 404 page).
      return redirect(`/auth/guest#${fragment}`, []);
    }
    return redirect(
      guestHandoffUrl({
        accountsUrl: config.accountsUrl,
        clientId: config.clientId,
        redirectUri: `${appOrigin(env, request)}/auth/guest`,
        state,
        resource: config.resource,
      }),
      [],
    );
  }

  async function handleAuth(
    request: Request,
    env: Env,
    segments: string[],
    waitUntil: (p: Promise<unknown>) => void,
  ): Promise<Response> {
    if (segments.length !== 3) return options.notFound();
    const config = configured(env);
    const route = `${request.method} ${segments[2]}`;
    // Never a page: with no sign-in configured, it goes straight back (startSilentSignIn).
    if (route === 'GET silent') return silent(request, env, config);
    if (route === 'GET guest') return guest(request, env, config);
    // A guest-only deployment: nothing to sign in to.
    if (!config) return json({ error: 'sign_in_not_configured' }, { status: 404 });
    // Each step is one network's worth of requests, apart from everyone's item writes.
    if (env.WRITE_RATE_LIMITER) {
      const ok = await env.WRITE_RATE_LIMITER.limit({
        key: `auth:${options.clientRateKey(request)}`,
      });
      if (!ok.success) return options.rateLimited();
    }
    switch (route) {
      case 'GET sign-in':
        return signIn(request, env, config);
      case 'GET callback':
        return callback(request, env, config, waitUntil);
      case 'POST token':
        return token(request, config);
      case 'POST sign-out':
        return signOut(request, env, config);
      default:
        return options.notFound();
    }
  }

  return { handleAuth, signedOutCookies };
}

// The PKCE cookie as the apps first wrote it: base64url over the JSON as Latin-1 (`btoa` alone), the state, verifier
// and return path read back as written. Kept for livediagram, whose return paths are percent-encoded ASCII by then.
export function encodeLatin1PkceCookie(value: PkceCookie): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeLatin1PkceCookie(raw: string | null): PkceCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as PkceCookie;
    return typeof parsed.state === 'string' &&
      typeof parsed.verifier === 'string' &&
      typeof parsed.returnTo === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

// The same over the JSON's UTF-8 bytes, read back without the return-path check auth-client/pkce-cookie adds
// (livedesign's and livehuddle's).
export function encodeUtf8PkceCookie(value: PkceCookie): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(JSON.stringify(value)))
    binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeUtf8PkceCookie(raw: string | null): PkceCookie | null {
  if (!raw) return null;
  try {
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    ) as PkceCookie;
    return typeof parsed.state === 'string' &&
      typeof parsed.verifier === 'string' &&
      typeof parsed.returnTo === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}
