import { SIGNED_IN_HINT_COOKIE } from '@liveplanner/api-schema';
// /api/auth/* — signing in through the liveworkspace accounts Worker
// (docs/specs/014-identity/auth-and-guest-access.md "Signing in").
//
// liveplanner.app and liveworkspace.app are separate sites, so the
// browser is sent there on a full-page visit and comes back with a one-time
// code (OAuth 2.1 authorization code + PKCE). This worker swaps the code for
// tokens, because the swap sends the client secret. The refresh token stays
// here, in an HttpOnly cookie scoped to /api/auth: the page only ever holds a
// short-lived access token in memory, which it sends as `Authorization:
// Bearer` exactly as before (auth/accounts.ts checks it).
//
//   GET  /api/auth/sign-in?return_to=/path  → the accounts site
//   GET  /api/auth/callback?code&state       → back in the app, signed in
//   POST /api/auth/token                     → { accessToken, expiresAt, user }
//   POST /api/auth/sign-out                  → drops the refresh cookie
//
// Handled before the caller's identity is resolved (src/index.ts): none of
// these carry a Bearer, so they would otherwise all share one 'anonymous'
// write-rate bucket.

import {
  authorizeUrl,
  createPkcePair,
  exchangeCode,
  randomState,
  refreshTokens,
  type TokenSet,
} from '@liveworkspace/auth-client';
import { clientRateKey } from '../client-ip';
import { reportSignIn } from '../auth/session-telemetry';
import { json, notFound, rateLimited } from '../responses';
import type { Env } from '../types';

const COOKIE_PATH = '/api/auth';
const PKCE_COOKIE = 'lp_pkce';
const REFRESH_COOKIE = 'lp_refresh';
// The readable hint (not HttpOnly, the whole site), and no secret: only whether this browser has a
// session, `1` or `0` (packages/api-schema/src/signed-in-hint.ts). Every request still authenticates
// with the access token.
// Ten minutes to type the emailed code; the accounts Worker's own code lasts as long.
const PKCE_MAX_AGE_SECONDS = 600;
// The refresh token's own lifetime is set by the accounts Worker; the cookie only needs to outlast it.
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 3600;
const DEFAULT_RETURN = '/explorer/home';

// What the page renders for the signed-in account (AuthControls, Settings, the editor's name).
export type AuthUser = {
  id: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
};

type Configured = {
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
  resource: string;
};

// The accounts Worker and this app's client there, or null on a guest-only deployment.
export function configured(env: Env): Configured | null {
  const { ACCOUNTS_URL, ACCOUNTS_CLIENT_ID, ACCOUNTS_CLIENT_SECRET, API_RESOURCE } = env;
  if (!ACCOUNTS_URL || !ACCOUNTS_CLIENT_ID || !ACCOUNTS_CLIENT_SECRET || !API_RESOURCE) return null;
  return {
    accountsUrl: ACCOUNTS_URL,
    clientId: ACCOUNTS_CLIENT_ID,
    clientSecret: ACCOUNTS_CLIENT_SECRET,
    resource: API_RESOURCE,
  };
}

// Where the browser comes back to. The page's own origin in production (the router hands this
// worker the request as the browser sent it); AUTH_ORIGIN for local dev, where the router proxies
// to localhost:8887 and the request no longer carries the address the browser is on.
function appOrigin(env: Env, request: Request): string {
  return env.AUTH_ORIGIN?.replace(/\/+$/, '') || new URL(request.url).origin;
}

const callbackUrl = (env: Env, request: Request) => `${appOrigin(env, request)}/api/auth/callback`;

// Only a path on this site: anything else (`//evil.example`, `https://…`, `/\evil`) would make the
// sign-in an open redirect.
export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_RETURN;
  }
  return value;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

// Secure everywhere: browsers treat http://localhost as a secure context, so local dev keeps it too.
function cookie(name: string, value: string, maxAge: number, sameSite: 'Lax' | 'Strict'): string {
  return `${name}=${value}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

const clearCookie = (name: string) => cookie(name, '', 0, 'Lax');

// Kept for as long as a session could live either way, so a signed-out browser reads as signed out
// rather than as one that never had sign-in.
const hintCookie = (signedIn: boolean) =>
  `${SIGNED_IN_HINT_COOKIE}=${signedIn ? '1' : '0'}; Path=/; Secure; SameSite=Lax; Max-Age=${REFRESH_MAX_AGE_SECONDS}`;

// The refresh token and the hint, set together.
const sessionCookies = (refreshToken: string) => [
  cookie(REFRESH_COOKIE, refreshToken, REFRESH_MAX_AGE_SECONDS, 'Strict'),
  hintCookie(true),
];
export const signedOutCookies = () => [clearCookie(REFRESH_COOKIE), hintCookie(false)];

// The PKCE verifier, the state and the return path ride one short-lived cookie. It needs no
// signature: only this browser can present it, and `state` must match what came back.
type PkceCookie = { state: string; verifier: string; returnTo: string };

function encodePkce(value: PkceCookie): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePkce(raw: string | null): PkceCookie | null {
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

// The ID token's profile claims. Not verified here: it came straight back from the accounts
// Worker's token endpoint over TLS, and it only decides what the page shows, never who the caller
// is (the access token does that, checked on every request).
function userOf(tokens: TokenSet): AuthUser | null {
  const payload = jwtPayload(tokens.idToken) ?? jwtPayload(tokens.accessToken);
  if (!payload || typeof payload.sub !== 'string' || !payload.sub) return null;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    id: payload.sub,
    email: text(payload.email),
    givenName: text(payload.given_name),
    familyName: text(payload.family_name),
    name: text(payload.name),
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

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

async function signIn(request: Request, env: Env, config: Configured): Promise<Response> {
  const url = new URL(request.url);
  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const returnTo = safeReturnPath(url.searchParams.get('return_to'));
  // /get-started asks for the accounts site's registration page rather than its sign-in.
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
    cookie(PKCE_COOKIE, encodePkce({ state, verifier, returnTo }), PKCE_MAX_AGE_SECONDS, 'Lax'),
  ]);
}

async function callback(
  request: Request,
  env: Env,
  config: Configured,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const pkce = decodePkce(readCookie(request, PKCE_COOKIE));
  const code = url.searchParams.get('code');
  // A missing or mismatched state is a stale tab, a second sign-in started elsewhere, or a forged
  // callback. Starting again is the answer to all three, so it goes back to the sign-in page.
  if (!pkce || !code || pkce.state !== url.searchParams.get('state')) {
    return redirect(`/sign-in?error=expired`, [clearCookie(PKCE_COOKIE)]);
  }
  let tokens: TokenSet;
  try {
    tokens = await exchangeCode(
      {
        accountsUrl: config.accountsUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      },
      {
        code,
        redirectUri: callbackUrl(env, request),
        codeVerifier: pkce.verifier,
        resource: config.resource,
      },
    );
  } catch (err) {
    console.warn('[auth] code_exchange_failed', err instanceof Error ? err.message : 'unknown');
    return redirect(`/sign-in?error=failed`, [clearCookie(PKCE_COOKIE)]);
  }
  if (!tokens.refreshToken) {
    console.warn('[auth] code_exchange_without_refresh_token');
    return redirect(`/sign-in?error=failed`, [clearCookie(PKCE_COOKIE)]);
  }
  // Session·SignedUp / SignedIn (docs/specs/017-telemetry/telemetry.md): this is the one moment a
  // sign-in completes, so it is counted here, once, off the response path.
  const user = userOf(tokens);
  if (user) waitUntil(reportSignIn(env, user.id));
  return redirect(pkce.returnTo, [
    clearCookie(PKCE_COOKIE),
    ...sessionCookies(tokens.refreshToken),
  ]);
}

async function token(request: Request, config: Configured): Promise<Response> {
  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) {
    return json({ signedIn: false }, { status: 401, headers: noStore([hintCookie(false)]) });
  }
  let tokens: TokenSet;
  try {
    tokens = await refreshTokens(
      {
        accountsUrl: config.accountsUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      },
      { refreshToken, resource: config.resource },
    );
  } catch (err) {
    // Revoked, expired, or the account was deleted: signed out. The cookie goes so the next load
    // doesn't ask again.
    console.warn('[auth] refresh_failed', err instanceof Error ? err.message : 'unknown');
    return json({ signedIn: false }, { status: 401, headers: noStore(signedOutCookies()) });
  }
  const user = userOf(tokens);
  const cookies = tokens.refreshToken ? sessionCookies(tokens.refreshToken) : [];
  return json(
    { signedIn: true, accessToken: tokens.accessToken, expiresAt: tokens.expiresAt, user },
    { headers: noStore(cookies) },
  );
}

function noStore(cookies: string[] = []): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return headers;
}

// Signing out of liveplanner only: the accounts site keeps its own session, so signing in again
// is one click with no code, as it is for every other liveworkspace app.
function signOut(): Response {
  return json({ signedIn: false }, { headers: noStore(signedOutCookies()) });
}

export async function handleAuth(
  request: Request,
  env: Env,
  segments: string[],
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  if (segments.length !== 3) return notFound();
  const config = configured(env);
  // A guest-only deployment: nothing to sign in to.
  if (!config) return json({ error: 'sign_in_not_configured' }, { status: 404 });
  // Each step is one network's worth of requests, apart from everyone's project writes.
  if (env.WRITE_RATE_LIMITER) {
    const ok = await env.WRITE_RATE_LIMITER.limit({ key: `auth:${clientRateKey(request)}` });
    if (!ok.success) return rateLimited();
  }
  const route = `${request.method} ${segments[2]}`;
  switch (route) {
    case 'GET sign-in':
      return signIn(request, env, config);
    case 'GET callback':
      return callback(request, env, config, waitUntil);
    case 'POST token':
      return token(request, config);
    case 'POST sign-out':
      return signOut();
    default:
      return notFound();
  }
}
