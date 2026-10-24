// The sign-in pages' side of the accounts API (liveworkspace/apps/accounts), which answers on this
// same origin under /api/auth. The same pages are also served under each app's own address
// (liveworkspace/docs/accounts.md "Signing in on the app's own address"), where the app's router
// forwards the API under /api/workspace/auth instead, beside the app's own /api/auth.

import { appOfAnyOrigin } from '@liveworkspace/sites';
import { ACCOUNTS_ON_APP_PATH } from '@liveworkspace/sites/workspace-proxy';

export const ACCOUNTS_API = '/api/auth';

/** Whether this page is being served under an app's own address rather than liveworkspace.app's. */
export function onAppAddress(origin: string = currentOrigin()): boolean {
  return appOfAnyOrigin(origin) !== null;
}

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** Where this page reaches the accounts API. */
export function accountsApi(origin: string = currentOrigin()): string {
  return onAppAddress(origin) ? ACCOUNTS_ON_APP_PATH : ACCOUNTS_API;
}

// What the pages need to know about this deployment (the Worker's src/sign-in-options.ts).
export interface SignInOptions {
  turnstileSiteKey: string;
  google: boolean;
  nameMaxLength: number;
  // liveworkspace.app (or staging's, or the local one): where Google signs in while it can't come back to an app.
  accountsUrl: string;
  // Whether Google can come back to an app's own address.
  googleOnApps: boolean;
}

export interface CallResult {
  ok: boolean;
  status: number;
  // The response's JSON, or {} when it had none.
  data: Record<string, unknown>;
}

// A GET without a body, a POST with one. Better Auth refuses a POST that isn't JSON from this origin.
export async function call(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<CallResult> {
  try {
    const response = await fetch(accountsApi() + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
    };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

// The `url` a sign-in, consent or continue answers with: where the browser goes next.
export function nextUrl(result: CallResult): string | null {
  return result.ok && typeof result.data.url === 'string' ? result.data.url : null;
}

// Rebuilds the signed OAuth query the provider put on the page's URL, in the form the sign-in and
// consent endpoints expect as `oauth_query`. A port of @better-auth/oauth-provider's
// buildSignedOAuthQuery (src/signed-query.ts); its client does the same, but would ship far more.
export function signedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (!params.has('sig')) return undefined;
  const names = params.getAll('ba_param');
  if (names.length === 0) return undefined;
  const allowed = new Set(names);
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || allowed.has(key)) out.append(key, value);
  }
  return out.toString();
}

// An app's "Create account" asks with prompt=create, and the provider keeps sending that request
// back to the registration page until it hears the account was made.
export function isRegistering(search: string): boolean {
  return (new URLSearchParams(search).get('prompt') ?? '').split(' ').includes('create');
}

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Where a sign-in started from the site's header goes back to: the `return` path it carries, if
// it's a path on this site. Anything else (another origin, `//host`, a backslash trick) is ignored,
// so the parameter can't send anyone off-site.
export const RETURN_PARAM = 'return';

export function returnPath(search: string): string | null {
  const path = new URLSearchParams(search).get(RETURN_PARAM);
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return path;
}

// The sign-in link for a page: back to that page once signed in. Under an app's own address (the
// Explorer, a join link) it is the app's own sign-in, which keeps the address on the app throughout.
export function signInHref(here: string, origin: string = currentOrigin()): string {
  if (onAppAddress(origin)) return `/api/auth/sign-in?return_to=${encodeURIComponent(here)}`;
  return `/sign-in?${RETURN_PARAM}=${encodeURIComponent(here)}`;
}

// The create-account link for a page, back to it once registered; on an app's own address, the app's sign-in opening
// the registration page.
export function signUpHref(here: string, origin: string = currentOrigin()): string {
  if (onAppAddress(origin)) {
    return `/api/auth/sign-in?return_to=${encodeURIComponent(here)}&screen=sign-up`;
  }
  return `/sign-up?${RETURN_PARAM}=${encodeURIComponent(here)}`;
}

// ---------- Finishing a sign-in made on an app's own address ----------------------------------------------------
// The session the pages made there must reach liveworkspace.app, where every app's sign-in finds it. So the last
// step asks for a one-time hand-off and goes there, top level, and liveworkspace.app sends the browser straight on to
// `next`, the app's callback. The hash of a nonce liveworkspace.app gave this browser rides in the query
// (`handoff=`); it is kept for the tab, so a consent step after signing in still has it.

export const HANDOFF_PARAM = 'handoff';
const HANDOFF_KEY = 'liveworkspace:handoff';
const BIND = /^[A-Za-z0-9_-]{43}$/;

function remember(action: (s: Storage) => string | null | void): string | null {
  try {
    return action(sessionStorage) ?? null;
  } catch {
    return null;
  }
}

/** The nonce's hash this sign-in is bound to: from the query, or kept from an earlier step in this tab. */
export function handoffBind(search: string): string | null {
  const given = new URLSearchParams(search).get(HANDOFF_PARAM);
  if (given && BIND.test(given)) {
    remember((s) => s.setItem(HANDOFF_KEY, given));
    return given;
  }
  const kept = remember((s) => s.getItem(HANDOFF_KEY));
  return kept && BIND.test(kept) ? kept : null;
}

/** Where the browser goes once a sign-in is done: on an app's address, the hand-off to liveworkspace.app and then
 *  `next`; anywhere else, or when no hand-off can be made, `next` itself (the app still signs in). */
export async function afterSignIn(next: string, search: string): Promise<string> {
  if (!onAppAddress()) return next;
  // A step still to take on these pages (consent) keeps the sign-in's session here a little longer.
  if (/^\/(sign-in|sign-up|consent)(\/|\?|$)/.test(new URL(next, window.location.href).pathname)) {
    return next;
  }
  const bind = handoffBind(search);
  if (!bind) return next;
  const handoff = nextUrl(await call('/handoff/start', { return: next, bind }));
  remember((s) => s.removeItem(HANDOFF_KEY));
  return handoff ?? next;
}

// The account's full name where the header's name (a given name) isn't it already, for the avatar's initials.
export function fullNameOf(user: Record<string, unknown>): string | null {
  const full = typeof user.name === 'string' ? user.name.trim() : '';
  return full && full !== displayName(user) ? full : null;
}

// The name the header shows for a signed-in account.
export function displayName(user: Record<string, unknown>): string {
  for (const key of ['givenName', 'name', 'email']) {
    const value = user[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Your account';
}
