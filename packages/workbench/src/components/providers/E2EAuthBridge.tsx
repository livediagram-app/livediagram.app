'use client';

// Test builds only (NEXT_PUBLIC_E2E_AUTH=1, see @liveworkspace/workbench/lib/auth-config.ts): a
// signed-in session without the accounts Worker, for the signed-in e2e specs
// (docs/specs/003-system-architecture/e2e-smoke.md) and the workbench e2e
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing"). The e2e
// stack mints an access token against a JWKS it serves itself, which the api
// worker verifies exactly as it verifies the accounts Worker's; the test puts it
// in localStorage and this publishes it as the session. Without one the page is
// a settled guest.

import { useEffect } from 'react';
import { readLocalStorageSafe, safeJson } from '../../lib/local-storage-safe';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';

type E2ESession = {
  token: string;
  userId: string;
  email: string;
  firstName: string;
  lastName?: string | null;
};

function readSession(sessionKey: string): E2ESession | null {
  const raw = readLocalStorageSafe(sessionKey);
  return raw ? (safeJson(raw) as E2ESession | null) : null;
}

// `sessionKey` is the product's (E2E_SESSION_KEY in its lib/workbench-keys.ts), the one the e2e specs write.
export function E2EAuthBridge({
  sessionKey,
  onState,
}: {
  sessionKey: string;
  onState: (state: DeferredAuthState) => void;
}) {
  useEffect(() => {
    const session = readSession(sessionKey);
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
      getToken: async () => readSession(sessionKey)?.token ?? null,
      signOut: async () => {
        localStorage.removeItem(sessionKey);
        window.location.assign('/');
      },
      deleteAccount: null,
    });
  }, [sessionKey, onState]);
  return null;
}
