'use client';

// Who is signed in on an app's own pages (liveworkspace/docs/accounts.md "An app's signed-in cookies"), for the
// marketing header's account menu. The page is static and loads no session: it reads the app's readable cookies,
// `<prefix>signed_in` (whether) and `<prefix>account` (who). A visitor with no hint costs nothing, not even a
// request. Only a session from before the name cookie existed (the hint without the name) asks the app's
// `POST /api/auth/token` once, whose answer sets it.

import { useSyncExternalStore } from 'react';
import {
  accountColourCookieFor,
  accountFullNameCookieFor,
  accountNameCookieFor,
  readAccountColour,
  readAccountName,
} from '@liveworkspace/auth-client/account-name';
import { workspaceOriginFor } from '@liveworkspace/sites';

/** Signed out (or not known to be signed in), the name still on its way, or the person (`colour`: their presence
 *  colour, null for Automatic or a session from before the colour cookie). */
export type AppAccount =
  'out' | 'pending' | { name: string; fullName: string | null; colour: string | null };

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

// The fallback: the app's token endpoint answers from its refresh cookie and sets the name cookie beside the hint
// (or, with the session gone, clears both). Its access token is not kept: this page has nothing to send it to.
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
    });
}

/** Who is signed in on this app's page; 'out' in the static HTML and until hydration, so the server and the first
 *  client render agree. */
export function useAppAccount(hint: string): AppAccount {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (snapshot(hint) === 'pending') askOnce();
      return () => listeners.delete(listener);
    },
    () => snapshot(hint),
    () => 'out',
  );
}

/** Signs out of the app this page is on (its API clears its cookies and remembers not to sign in silently), then
 *  reloads the page as a visitor. Resolves false when the API refused, leaving everything as it was. */
export async function appSignOut(
  reload: () => void = () => window.location.reload(),
): Promise<boolean> {
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
  reload();
  return true;
}

/** An account page's link from an app's page: liveworkspace.app's (staging's from a staging app), in full. */
export function workspacePageHref(path: string): string {
  const host = typeof window === 'undefined' ? '' : window.location.host;
  return `${workspaceOriginFor(host)}${path}`;
}

/** For tests. */
export function resetAppAccount() {
  asked = false;
  asking = null;
  last = null;
  listeners.clear();
}
