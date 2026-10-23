'use client';

// Test builds only (NEXT_PUBLIC_E2E_AUTH=1, see lib/auth-config.ts): a
// signed-in session without the accounts Worker, for the signed-in e2e specs
// (docs/specs/003-system-architecture/e2e-smoke.md) and the opt-in Google Drive e2e
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Testing"). The e2e
// stack mints an access token against a JWKS it serves itself, which the api
// worker verifies exactly as it verifies the accounts Worker's; the test puts it
// in localStorage and this publishes it as the session. Without one the page is
// a settled guest.

import { useEffect } from 'react';
import { readLocalStorageSafe, safeJson } from '@/lib/local-storage-safe';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';

export const E2E_SESSION_KEY = 'livediagram:e2e:session';

type E2ESession = {
  token: string;
  userId: string;
  email: string;
  firstName: string;
  lastName?: string | null;
};

function readSession(): E2ESession | null {
  const raw = readLocalStorageSafe(E2E_SESSION_KEY);
  return raw ? (safeJson(raw) as E2ESession | null) : null;
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
        lastName: session.lastName ?? null,
        fullName: [session.firstName, session.lastName].filter(Boolean).join(' '),
        username: null,
        email: session.email,
        createdAt: null,
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
