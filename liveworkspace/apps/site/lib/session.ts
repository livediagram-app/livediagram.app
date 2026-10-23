'use client';

import { useSyncExternalStore } from 'react';
import { call, displayName } from './accounts';
import { pageApp } from './explorer/page-app';

// Who is signed in to liveworkspace.app, asked of the accounts API once per page however many parts
// of the page want to know (the header's account control, the home page's hero). The site is
// static, so this is the one way a page learns it.
export type Session = { state: 'checking' } | { state: 'out' } | { state: 'in'; name: string };

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
        ? { state: 'in', name: displayName(user as Record<string, unknown>) }
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

// Ends the liveworkspace session here. Resolves false when the API refused, leaving it as it was.
export async function signOut(): Promise<boolean> {
  const result = await call('/sign-out', {});
  if (result.ok) set({ state: 'out' });
  return result.ok;
}
