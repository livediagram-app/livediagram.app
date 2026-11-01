'use client';

// Who is signed in on an app's own pages (liveworkspace/docs/specs/003-accounts/accounts.md "An app's signed-in cookies"), for the
// marketing header's account menu. The page is static and loads no session: it reads the app's readable cookies,
// `<prefix>signed_in` (whether) and `<prefix>account` (who). A visitor with no hint costs nothing, not even a
// request. Someone the hint says is signed in is shown at once from the cookies, and the page checks that once,
// when it is idle, with the app's `POST /api/auth/token`: signing out in another app ends this app's session too
// but can't reach its cookies, so the hint can outlive the session, and the answer clears it (and lets the silent
// sign-in ask again). A session from before
// the name cookie existed (the hint without the name) asks at once instead, since its answer sets the name.

import { useSyncExternalStore } from 'react';
import {
  accountColourCookieFor,
  accountFullNameCookieFor,
  accountNameCookieFor,
  accountPictureCookieFor,
  readAccountColour,
  readAccountName,
  readAccountPicture,
} from '@liveworkspace/auth-client/account-name';
import { askSignOut } from '@liveworkspace/auth-client/sign-out';
import { retrySilentSignIn } from '@liveworkspace/auth-client/silent';

/** Signed out (or not known to be signed in), the name still on its way, or the person (`colour`: their presence
 *  colour, null for Automatic or a session from before the colour cookie; `picture`: their Google picture, null with
 *  none or a session from before the picture cookie). */
export type AppAccount =
  | 'out'
  | 'pending'
  | { name: string; fullName: string | null; colour: string | null; picture: string | null };

function hintOf(cookies: string, hint: string): boolean {
  for (const part of cookies.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === hint) return part.slice(eq + 1).trim() === '1';
  }
  return false;
}

/** What the cookies say. `asked`: the token was already asked for, so a missing name now means there is none. */
export function appAccountOf(cookies: string, hint: string, asked = false): AppAccount {
  if (!hintOf(cookies, hint)) return 'out';
  const nameCookie = accountNameCookieFor(hint);
  const name = readAccountName(cookies, nameCookie);
  if (name)
    return {
      name,
      fullName: readAccountName(cookies, accountFullNameCookieFor(nameCookie)),
      colour: readAccountColour(cookies, accountColourCookieFor(nameCookie)),
      picture: readAccountPicture(cookies, accountPictureCookieFor(nameCookie)),
    };
  return asked ? 'out' : 'pending';
}

// ---------- The page's one store ----------------------------------------------------------------------------------
// Asked once per page however many headers want it. The snapshot is kept per cookie string, so React sees the same
// object until something changes.

const listeners = new Set<() => void>();
let asked = false;
let asking: Promise<void> | null = null;
let last: { cookies: string; hint: string; asked: boolean; account: AppAccount } | null = null;

function readCookies(): string {
  try {
    return document.cookie;
  } catch {
    return '';
  }
}

function snapshot(hint: string): AppAccount {
  const cookies = readCookies();
  if (last && last.cookies === cookies && last.hint === hint && last.asked === asked) {
    return last.account;
  }
  last = { cookies, hint, asked, account: appAccountOf(cookies, hint, asked) };
  return last.account;
}

// The app's token endpoint answers from its refresh cookie and sets the name cookie beside the hint (or, with the
// session gone, clears both). Its access token is not kept: this page has nothing to send it to.
function askOnce(): void {
  if (asked || asking) return;
  asking = fetch('/api/auth/token', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
    .then(
      () => undefined,
      () => undefined,
    )
    .then(() => {
      asked = true;
      asking = null;
      for (const listener of listeners) listener();
      // The hint outlived its session (it ended in another app) and the answer cleared it: the silent sign-in asks
      // again, once, in case the person has signed in elsewhere since (liveworkspace/docs/specs/003-accounts/
      // accounts.md "A hint that outlived its session"). Still signed in, or offline, it does nothing.
      retrySilentSignIn();
    });
}

// The check for a hint with a name: after the page's own work, off its first paint. A reset since it was scheduled
// drops it, and so does a menu gone by then (nothing left to show the answer); the next subscribe schedules again.
let checking = false;
let generation = 0;
function checkWhenIdle(): void {
  if (checking || asked || asking) return;
  checking = true;
  const mine = generation;
  const run = () => {
    if (mine !== generation) return;
    checking = false;
    if (listeners.size > 0) askOnce();
  };
  const idle = (globalThis as { requestIdleCallback?: (fn: () => void) => void })
    .requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 200);
}

/** Who is signed in on this app's page; 'out' in the static HTML and until hydration, so the server and the first
 *  client render agree. */
export function useAppAccount(hint: string): AppAccount {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      const now = snapshot(hint);
      if (now === 'pending') askOnce();
      else if (now !== 'out') checkWhenIdle();
      return () => listeners.delete(listener);
    },
    () => snapshot(hint),
    () => 'out',
  );
}

/** Signs out of the app this page is on, and so of every liveworkspace app in this browser (its API clears its cookies
 *  and ends the liveworkspace session, or, should that fail, remembers not to sign in silently here;
 *  liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"), then goes through the accounts site's hop, or
 *  straight back to this page, as a visitor.
 *  Resolves false when the API refused, leaving everything as it was. */
export async function appSignOut(
  go: (to: string) => void = (to) => window.location.assign(to),
): Promise<boolean> {
  const here = pageHere();
  const { ok, next } = await askSignOut(here);
  if (!ok) return false;
  go(next ?? here);
  return true;
}

/** The app's own sign-in, on the page's own origin, coming back to `here` (a path on it). */
export const appSignInHref = (here: string) =>
  `/api/auth/sign-in?return_to=${encodeURIComponent(here)}`;

/** The app's own sign-in opening the accounts site's registration page, coming back to `here`. */
export const appSignUpHref = (here: string) => `${appSignInHref(here)}&screen=sign-up`;

/** The page's own path and query, to come back to after signing in; `/` outside a browser. */
export function pageHere(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

/** For tests. */
export function resetAppAccount() {
  asked = false;
  asking = null;
  checking = false;
  generation += 1;
  last = null;
  listeners.clear();
}
