'use client';

// The signed-in session, from the liveworkspace accounts Worker by way of
// this app's own api (apps/api/src/routes/auth.ts). The refresh token never
// reaches the page: it lives in an HttpOnly cookie on /api/auth, and the page
// asks POST /api/auth/token for a short-lived access token, which it holds in
// memory and sends as `Authorization: Bearer` (docs/specs/014-identity/auth-and-guest-access.md).
// A browser with no `ldes_signed_in` hint is a guest and asks nothing.
//
// Loaded lazily by AuthProvider, like the Clerk bridge it replaced, so the
// first load of every route stays free of it; it publishes the same distilled
// DeferredAuthState the app tree already consumes.

import { useEffect } from 'react';
import { API_BASE } from '@/lib/api/base';
import { forgetRecentDesigns } from '@/lib/recent-designs-snapshot';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';

type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
};
type Session = { accessToken: string; expiresAt: number; user: SessionUser };

// Refresh this long before the access token expires, so a request never goes out with one that
// lapses in flight.
const EXPIRY_MARGIN_MS = 60_000;

let current: Session | null = null;
let inflight: Promise<Session | null> | null = null;

async function requestSession(): Promise<Session | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<Session> & { signedIn?: boolean };
    if (!body.signedIn || !body.accessToken || !body.user?.id) return null;
    return { accessToken: body.accessToken, expiresAt: body.expiresAt ?? 0, user: body.user };
  } catch {
    // Offline or the api unreachable: no session this time. The next getToken tries again.
    return null;
  }
}

// One refresh at a time for the whole page: the editor asks for a token on every save, and
// concurrent refreshes would each rotate the refresh token.
function refresh(): Promise<Session | null> {
  inflight ??= requestSession().then((session) => {
    current = session;
    inflight = null;
    return session;
  });
  return inflight;
}

async function getToken(opts?: { skipCache?: boolean }): Promise<string | null> {
  if (!opts?.skipCache && current && current.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return current.accessToken;
  }
  return (await refresh())?.accessToken ?? null;
}

async function endSession(): Promise<void> {
  current = null;
  await forgetRecentDesigns();
  await fetch(`${API_BASE}/auth/sign-out`, { method: 'POST', credentials: 'same-origin' }).catch(
    () => {},
  );
}

// The name the app shows: the account's own, split at its first space, else the email's local part.
// An account made by signing in with a code has no name until one is set at the accounts site.
export function namesOf(user: SessionUser): {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const name = user.name?.trim();
  if (name) {
    const space = name.indexOf(' ');
    return {
      firstName: space > 0 ? name.slice(0, space) : name,
      lastName: space > 0 ? name.slice(space + 1).trim() || null : null,
      fullName: name,
    };
  }
  const local = user.email?.split('@')[0]?.trim() || null;
  return { firstName: local, lastName: null, fullName: local };
}

function stateOf(session: Session | null): DeferredAuthState {
  if (!session) return { ...DEFERRED_AUTH_DEFAULT, authLoaded: true };
  const { user } = session;
  return {
    authLoaded: true,
    isSignedIn: true,
    userId: user.id,
    user: {
      id: user.id,
      ...namesOf(user),
      username: null,
      email: user.email,
      createdAt: null,
    },
    getToken,
    // The landing page sign-out returns to must not show the account's recent designs
    // (docs/specs/019-marketing/returning-visitor.md). A full load, so nothing keeps the old session.
    signOut: async (opts) => {
      await endSession();
      window.location.assign(opts?.redirectUrl ?? '/');
    },
    // The api has already deleted this account's livedesign data and closed its liveworkspace
    // account (DeleteAccountDialog); what is left is this tab's session.
    deleteAccount: endSession,
  };
}

// Whether to ask the api at all on load. The api sets the hint beside the refresh cookie and clears
// it with it (lib/signed-in-hint.ts), so a browser without it has no session to find: a guest settles
// at once, with no request on every page load. A stale hint only costs the one request it saves.
async function initialSession(): Promise<Session | null> {
  return readSignedInHint() ? refresh() : null;
}

export function AccountsBridge({ onState }: { onState: (state: DeferredAuthState) => void }) {
  useEffect(() => {
    let live = true;
    void initialSession().then((session) => {
      if (live) onState(stateOf(session));
    });
    return () => {
      live = false;
    };
  }, [onState]);
  return null;
}

// Tests only: forget the module's session between cases.
export function resetAccountsSessionForTests(): void {
  current = null;
  inflight = null;
}
