// Signing in without a click (liveworkspace/docs/accounts.md "Signing in without a click").
//
// Each app is its own site and liveworkspace.app another, so an app can't see the liveworkspace session from a
// fetch or an iframe: Safari and Chrome withhold third-party cookies. What always works is a full-page visit. So
// the first time a browser session opens an app it has no session in, a script in the page's <head> sends it,
// before anything renders, to the app's GET /api/auth/silent, which asks the accounts site's authorize with
// `prompt=none`. That answers at once, never with a page: a code when there is a liveworkspace session, which the
// app's callback swaps for tokens as at any sign-in, or `login_required`, and the browser comes straight back to
// the same address as a guest. Either way it costs one bounce per browser session, and nothing after.
//
// Guards, all here so every app keeps the same ones:
// - the page: once per browser session (sessionStorage), never in a frame, never for a crawler, never on the
//   sign-in pages, embeds or a share link (`?s=`), never with a session already (the app's hint cookie);
// - the person: never after they signed out of this app, until they sign in again (the signed-out cookie);
// - loops: a short-lived guard cookie the bounce sets, which both the page and the route refuse to bounce past.
//
// startSilentSignIn and finishSilentSignIn run in the app's Worker; silentSignInBootScript is inlined into the
// page. The Worker parts never send the client secret except in the code swap, as exchangeCode always does.

import {
  authorizeUrl,
  createPkcePair,
  exchangeCode,
  randomState,
  type ClientCredentials,
  type TokenSet,
} from './oauth';

// The once-per-browser-session mark, in each app's own sessionStorage.
export const SILENT_SESSION_KEY = 'liveworkspace:silent-sign-in';
// How long a bounce blocks another. Long enough to cover the round trip on a slow network, short enough that
// a browser with sessionStorage blocked is asked again on a later visit rather than never.
export const SILENT_GUARD_MAX_AGE_SECONDS = 120;
// How long an explicit sign-out is remembered: as long as browsers let a cookie live (Chrome caps at 400 days),
// and every sign-in clears it.
export const SIGNED_OUT_MAX_AGE_SECONDS = 400 * 24 * 3600;
// The bounce's PKCE verifier and return address, for as long as the accounts site's own codes last.
const SILENT_PKCE_MAX_AGE_SECONDS = 600;
// A return address longer than this isn't bounced: it rides in a cookie, and a dropped cookie would turn the
// way back into a failed sign-in.
export const SILENT_RETURN_MAX_LENGTH = 1500;

export interface SilentCookies {
  // The app's readable "this browser has a session here" hint (`1` / `0`), set beside its refresh cookie.
  hint: string;
  // Readable, the whole site: set when the person signs out of this app, cleared by any sign-in to it.
  signedOut: string;
  // Readable, the whole site, two minutes: a bounce went out, so neither the page nor the route sends another.
  guard: string;
  // HttpOnly, on the auth path: the bounce's state, PKCE verifier and where to go back to.
  pkce: string;
}

// An app's names, from the prefix its other auth cookies carry (`lp_` → `lp_signed_out`, …), so apps that share a
// host (every app on `localhost` in development) never read each other's.
export function silentCookieNames(prefix: string, hint: string): SilentCookies {
  return {
    hint,
    signedOut: `${prefix}signed_out`,
    guard: `${prefix}silent`,
    pkce: `${prefix}silent_pkce`,
  };
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

// Only a path on this site: anything else (`//evil.example`, `https://…`, `/\evil`) would make the bounce an
// open redirect.
export function safeReturnPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

// Secure everywhere: browsers treat http://localhost as a secure context, so local development keeps it too.
const readable = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** The signed-out mark: set (`true`) by an explicit sign-out of the app, cleared (`false`) by any sign-in. */
export function signedOutCookie(cookies: SilentCookies, signedOut: boolean): string {
  return signedOut
    ? readable(cookies.signedOut, '1', SIGNED_OUT_MAX_AGE_SECONDS)
    : readable(cookies.signedOut, '', 0);
}

const guardCookie = (cookies: SilentCookies) =>
  readable(cookies.guard, '1', SILENT_GUARD_MAX_AGE_SECONDS);

function pkceCookie(cookies: SilentCookies, value: string, maxAge: number, path: string): string {
  return `${cookies.pkce}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

type SilentPkce = { state: string; verifier: string; returnTo: string };

function encodePkce(value: SilentPkce): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePkce(raw: string | null): SilentPkce | null {
  if (!raw) return null;
  try {
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    ) as SilentPkce;
    return typeof parsed.state === 'string' &&
      typeof parsed.verifier === 'string' &&
      typeof parsed.returnTo === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

export interface SilentStartInput {
  request: Request;
  // The accounts site and the app's client there; null on a deployment with no sign-in, which just goes back.
  config: { accountsUrl: string; clientId: string; resource: string } | null;
  // The app's /api/auth/callback, absolute.
  callbackUrl: string;
  // Where a bad or missing `return` goes instead.
  fallbackReturn: string;
  cookies: SilentCookies;
  // Where the app's other auth cookies live (`/api/auth`).
  cookiePath?: string;
}

/**
 * GET /api/auth/silent?return=<path?query#hash>: off to the accounts site's authorize with `prompt=none`, or
 * straight back to `return` when the bounce mustn't happen (signed out of this app, a bounce already out, a
 * return address too long to carry, no sign-in configured). Never shows a page.
 */
export async function startSilentSignIn(input: SilentStartInput): Promise<Response> {
  const { request, cookies } = input;
  const url = new URL(request.url);
  const raw = url.searchParams.get('return');
  const returnTo = safeReturnPath(raw, input.fallbackReturn);
  const header = request.headers.get('cookie');
  if (
    readCookie(header, cookies.signedOut) === '1' ||
    readCookie(header, cookies.guard) ||
    returnTo.length > SILENT_RETURN_MAX_LENGTH
  ) {
    return redirect(returnTo, []);
  }
  if (!input.config) return redirect(returnTo, [guardCookie(cookies)]);
  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const to = authorizeUrl({
    accountsUrl: input.config.accountsUrl,
    clientId: input.config.clientId,
    redirectUri: input.callbackUrl,
    state,
    codeChallenge: challenge,
    resource: input.config.resource,
    prompt: 'none',
  });
  return redirect(to, [
    pkceCookie(
      cookies,
      encodePkce({ state, verifier, returnTo }),
      SILENT_PKCE_MAX_AGE_SECONDS,
      input.cookiePath ?? '/api/auth',
    ),
    guardCookie(cookies),
  ]);
}

/** Back where the bounce started: `tokens` when the accounts site had a session, else null (a guest). */
export interface SilentFinish {
  returnTo: string;
  tokens: TokenSet | null;
  // Set-Cookie values the answer carries whatever happened: the bounce's own cookie cleared, and, signed in,
  // the signed-out mark cleared.
  cookies: string[];
}

export interface SilentFinishInput {
  request: Request;
  credentials: ClientCredentials;
  resource: string;
  callbackUrl: string;
  cookies: SilentCookies;
  cookiePath?: string;
  fetchImpl?: typeof fetch;
}

/**
 * The app's callback, when the request is coming back from a silent bounce (its state matches the bounce's
 * cookie); null otherwise, and the callback carries on as a clicked sign-in. Never throws: an error from the
 * accounts site (`login_required`, `consent_required`, …) or a failed code swap is a guest coming back.
 */
export async function finishSilentSignIn(input: SilentFinishInput): Promise<SilentFinish | null> {
  const url = new URL(input.request.url);
  const pending = decodePkce(readCookie(input.request.headers.get('cookie'), input.cookies.pkce));
  const state = url.searchParams.get('state');
  if (!pending || !state || pending.state !== state) return null;
  const cleared = [pkceCookie(input.cookies, '', 0, input.cookiePath ?? '/api/auth')];
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error')) {
    return { returnTo: pending.returnTo, tokens: null, cookies: cleared };
  }
  try {
    const tokens = await exchangeCode(
      input.credentials,
      {
        code,
        redirectUri: input.callbackUrl,
        codeVerifier: pending.verifier,
        resource: input.resource,
      },
      input.fetchImpl,
    );
    if (!tokens.refreshToken) return { returnTo: pending.returnTo, tokens: null, cookies: cleared };
    return {
      returnTo: pending.returnTo,
      tokens,
      cookies: [...cleared, signedOutCookie(input.cookies, false)],
    };
  } catch (err) {
    console.warn(
      '[auth] silent_code_exchange_failed',
      err instanceof Error ? err.message : 'unknown',
    );
    return { returnTo: pending.returnTo, tokens: null, cookies: cleared };
  }
}

export interface SilentBootOptions {
  // Where the app's API is from the page (`/api`).
  apiBase: string;
  cookies: Pick<SilentCookies, 'hint' | 'signedOut' | 'guard'>;
  // Paths (and everything under them) that never bounce: the sign-in pages, embeds, the guest hand-off's way
  // back, the AI-tool consent pages.
  skipPaths: string[];
}

const COOKIE_NAME = /^[A-Za-z0-9_]+$/;
const PATH = /^\/[A-Za-z0-9/_-]*$/;

/**
 * The inline <head> script that starts the bounce. It runs before anything renders: when it bounces it stops the
 * page loading first (so no app code runs and nothing signed-out paints), lets the page follow the device's
 * light or dark setting meanwhile, and goes. Written as ES5 in a try/catch, as the other boot scripts are, so a
 * blocked storage or an old browser only means no bounce.
 */
export function silentSignInBootScript(options: SilentBootOptions): string {
  const { hint, signedOut, guard } = options.cookies;
  for (const name of [hint, signedOut, guard]) {
    if (!COOKIE_NAME.test(name)) throw new Error(`unsafe cookie name: ${name}`);
  }
  for (const path of options.skipPaths) {
    if (!PATH.test(path)) throw new Error(`unsafe skip path: ${path}`);
  }
  const api = JSON.stringify(options.apiBase.replace(/\/+$/, ''));
  const skip = JSON.stringify(options.skipPaths);
  const key = JSON.stringify(SILENT_SESSION_KEY);
  return (
    `(function(){try{` +
    `var w=window,d=document,l=location,n=navigator,c=d.cookie||'';` +
    `function has(k,v){return new RegExp('(?:^|;\\\\s*)'+k+'='+(v||'[^;\\\\s]')).test(c)}` +
    // A frame (an embed, the workbench, a preview), a crawler, or no cookies to come back with.
    `if(w.top!==w.self||!n.cookieEnabled||/bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|preview/i.test(n.userAgent||''))return;` +
    // A session here already, signed out of this app on purpose, or a bounce just out.
    `if(has('${hint}','1')||has('${signedOut}','1')||has('${guard}'))return;` +
    `var p=l.pathname,s=${skip};` +
    `for(var i=0;i<s.length;i++){if(p===s[i]||p.indexOf(s[i]+'/')===0)return}` +
    // A share link: its own visitor flow, not to be interrupted.
    `if(/[?&]s=/.test(l.search))return;` +
    `var r=p+l.search+l.hash;if(r.length>${SILENT_RETURN_MAX_LENGTH})return;` +
    // Once per browser session; no storage, no bounce (nothing to stop the next one).
    `var st=w.sessionStorage;if(st.getItem(${key}))return;st.setItem(${key},'1');if(st.getItem(${key})!=='1')return;` +
    `d.documentElement.style.colorScheme='light dark';` +
    `if(w.stop)w.stop();` +
    `l.replace(${api}+'/auth/silent?return='+encodeURIComponent(r));` +
    // Restored from the back-forward cache mid-bounce: load it properly (the session mark stops a second bounce).
    `w.addEventListener('pageshow',function(e){if(e.persisted)l.reload()})` +
    `}catch(e){}})();`
  );
}
