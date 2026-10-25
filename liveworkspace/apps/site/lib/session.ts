'use client';

import { useSyncExternalStore } from 'react';
import { accountColourOf } from '@liveworkspace/auth-client/account-name';
import { call, displayName, fullNameOf } from './accounts';
import { pageApp } from './explorer/page-app';

// Who is signed in to liveworkspace.app, asked of the accounts API once per page however many parts
// of the page want to know (the header's account control, the home page's hero). The site is
// static, so this is the one way a page learns it.
// `colour`: the profile's presence colour (the accounts Worker adds it to `/get-session`'s user), null for Automatic.
export type Session =
  | { state: 'checking' }
  | { state: 'out' }
  | {
      state: 'in';
      name: string;
      fullName: string | null;
      colour: string | null;
      // For Settings' Profile header: the account's address and when it was made (ISO), where the answer had them.
      email?: string | null;
      joined?: string | null;
    };

const textOf = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

let current: Session = { state: 'checking' };
let asked = false;
const listeners = new Set<() => void>();

function set(next: Session) {
  current = next;
  for (const listener of listeners) listener();
}

function ask() {
  if (asked) return;
  asked = true;
  // The Explorer on an app's own address: liveworkspace.app's session isn't this page's to read, the app's is
  // (components/explorer/AppAccountControl.tsx). The sign-in pages served there read theirs through lib/accounts.ts.
  if (pageApp() && /^\/explorer(?:[/.]|$)/.test(window.location.pathname)) return;
  void call('/get-session').then((result) => {
    const user = result.ok ? result.data.user : null;
    set(
      user && typeof user === 'object'
        ? {
            state: 'in',
            name: displayName(user as Record<string, unknown>),
            fullName: fullNameOf(user as Record<string, unknown>),
            colour: accountColourOf(user),
            email: textOf((user as Record<string, unknown>).email),
            joined: textOf((user as Record<string, unknown>).createdAt),
          }
        : { state: 'out' },
    );
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ask();
  return () => listeners.delete(listener);
}

const CHECKING: Session = { state: 'checking' };

export function useSession(): Session {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => CHECKING,
  );
}

// A colour just picked in Settings › Profile, so the header's avatar repaints at once rather than at the next
// page's `/get-session`. Nothing changes while no one is known to be signed in.
export function setSessionColour(colour: string | null) {
  if (current.state !== 'in') return;
  const next = accountColourOf({ color: colour });
  if (next !== current.colour) set({ ...current, colour: next });
}

// Ends the liveworkspace session here. Resolves false when the API refused, leaving it as it was.
export async function signOut(): Promise<boolean> {
  const result = await call('/sign-out', {});
  if (result.ok) set({ state: 'out' });
  return result.ok;
}
