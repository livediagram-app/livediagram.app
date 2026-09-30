'use client';

// Test builds only (NEXT_PUBLIC_E2E_AUTH=1, see lib/clerk-config.ts): a
// signed-in session without Clerk, for the opt-in Google Drive e2e
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Testing"). The test
// mints a JWT against a JWKS it serves itself, which the api worker verifies
// exactly as it verifies Clerk's, and puts it in localStorage; this publishes
// it as the session. Without one the page is a settled guest.

import { useEffect } from 'react';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';

export const E2E_SESSION_KEY = 'livediagram:e2e:session';

type E2ESession = { token: string; userId: string; email: string; firstName: string };

function readSession(): E2ESession | null {
  try {
    const raw = localStorage.getItem(E2E_SESSION_KEY);
    return raw ? (JSON.parse(raw) as E2ESession) : null;
  } catch {
    return null;
  }
}

export function E2EAuthBridge({ onState }: { onState: (state: DeferredAuthState) => void }) {
  useEffect(() => {
    const session = readSession();
    if (!session) {
      onState({ ...DEFERRED_AUTH_DEFAULT, authLoaded: true });
      return;
    }
    onState({
      authLoaded: true,
      isSignedIn: true,
      userId: session.userId,
      user: {
        id: session.userId,
        firstName: session.firstName,
        lastName: null,
        fullName: session.firstName,
        username: null,
        email: session.email,
        createdAt: null,
        pictureUrl: null,
      },
      getToken: async () => readSession()?.token ?? null,
      signOut: async () => {
        localStorage.removeItem(E2E_SESSION_KEY);
        window.location.assign('/');
      },
      deleteAccount: null,
    });
  }, [onState]);
  return null;
}
