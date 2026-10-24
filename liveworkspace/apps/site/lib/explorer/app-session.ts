// The app's own session, for the Explorer shown on that app's address (page-app.ts): its signed-in account from
// the app's API, its sign-in and sign-out, and its guest token. On liveworkspace.app none of this is asked.

import { accountColourOf } from '@liveworkspace/auth-client/account-name';
import { createGuestTokens, type GuestTokens } from '@liveworkspace/index-client/browser';
import { SIGNED_IN_HINT_COOKIE as DIAGRAM_HINT } from '@livediagram/api-schema';
import { SIGNED_IN_HINT_COOKIE as PLANNER_HINT } from '@liveplanner/api-schema';
import { SIGNED_IN_HINT_COOKIE as DOCUMENTS_HINT } from '@livedocuments/api-schema';
import { SIGNED_IN_HINT_COOKIE as DESIGN_HINT } from '@livedesign/api-schema';
import type { AppName } from '@liveworkspace/sites';
import { fullNameOf } from '../accounts';
import { pageApp } from './page-app';

// Each app's readable "this browser has a session here" cookie (`1`), set beside its refresh cookie.
export const SIGNED_IN_HINTS: Record<AppName, string> = {
  livediagram: DIAGRAM_HINT,
  liveplanner: PLANNER_HINT,
  livedocuments: DOCUMENTS_HINT,
  livedesign: DESIGN_HINT,
};

// ---------- The app's own session, on its address ----------------------------------------------------------------
// The app's API answers `POST /api/auth/token` from its refresh cookie with an access token every app's API and the
// index accept. Each answer rotates the refresh token, so the page never asks twice at once: one request in flight,
// shared by everyone who asks, and its answer kept until a minute before it runs out.

export type AppAccount = {
  token: string;
  expiresAt: number;
  sub: string;
  name: string;
  // The full name where it isn't `name` already (a given name), for the avatar's initials.
  fullName: string | null;
  // The profile's presence colour from the token answer's user, for the avatar; null for Automatic.
  colour: string | null;
};

const RENEW_BEFORE_MS = 60_000;
let account: AppAccount | null = null;
let accountPending: Promise<AppAccount | null> | null = null;

function cookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function nameOf(user: Record<string, unknown> | null): string {
  return text(user?.givenName) ?? text(user?.name) ?? text(user?.email) ?? 'Your account';
}

async function askToken(): Promise<AppAccount | null> {
  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      signedIn?: boolean;
      accessToken?: unknown;
      expiresAt?: unknown;
      user?: Record<string, unknown> | null;
    };
    if (!body.signedIn || typeof body.accessToken !== 'string') return null;
    const sub = text(body.user?.id) ?? '';
    return {
      token: body.accessToken,
      expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : Date.now() + 5 * 60_000,
      sub,
      name: nameOf(body.user ?? null),
      fullName: body.user ? fullNameOf(body.user) : null,
      colour: accountColourOf(body.user),
    };
  } catch {
    return null;
  }
}

/** The person signed in to the app this page is on, or null (a guest, or liveworkspace.app). Asks the app's API only
 *  when its hint cookie says there is a session to ask about. */
export function appAccount(now = Date.now()): Promise<AppAccount | null> {
  const app = pageApp();
  if (!app) return Promise.resolve(null);
  if (account && account.expiresAt - RENEW_BEFORE_MS > now) return Promise.resolve(account);
  if (cookie(SIGNED_IN_HINTS[app]) !== '1') {
    account = null;
    return Promise.resolve(null);
  }
  accountPending ??= askToken().then((found) => {
    accountPending = null;
    account = found;
    return found;
  });
  return accountPending;
}

/** Asks the app for a fresh token next time (a team made since the last one, which the new token names). */
export function forgetAppAccount() {
  account = null;
  accountPending = null;
}

/** Signs out of the app (its API clears its cookies, and remembers not to sign in silently again). */
export async function appSignOut(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  account = null;
  return true;
}

/** The app's own sign-in, coming back to `here`. */
export const appSignInHref = (here: string) =>
  `/api/auth/sign-in?return_to=${encodeURIComponent(here)}`;

// A guest's token, kept by the app on its origin under `<app>:v2:guest-token` (each app's lib/guest-token-key.ts),
// and the app's guest handoff when there is none: the same keys the app's editor uses, so the two share one guest.
const guestTokens = new Map<AppName, GuestTokens>();

export function appGuestTokens(app: AppName): GuestTokens {
  let tokens = guestTokens.get(app);
  if (!tokens) {
    tokens = createGuestTokens({
      storageKey: `${app}:v2:guest-token`,
      sessionPrefix: app,
      apiBase: '/api',
      fallbackPath: '/explorer',
    });
    guestTokens.set(app, tokens);
  }
  return tokens;
}

/** For tests. */
export function resetAppSession() {
  account = null;
  accountPending = null;
  guestTokens.clear();
}
