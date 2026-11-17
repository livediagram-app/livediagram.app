'use client';

// The signed-in session, from the liveworkspace accounts Worker by way of
// this app's own api (apps/api/src/routes/auth.ts). The refresh token never
// reaches the page: it lives in an HttpOnly cookie on /api/auth, and the page
// asks POST /api/auth/token for a short-lived access token, which it holds in
// memory and sends as `Authorization: Bearer` (docs/specs/014-identity/auth-and-guest-access.md).
// A browser with no `ld_signed_in` hint is a guest and asks nothing.
//
// Loaded lazily by AuthProvider, like the Clerk bridge it replaced, so the
// first load of every route stays free of it; it publishes the same distilled
// DeferredAuthState the app tree already consumes.

import { namesOf } from '@liveworkspace/auth-client/account-names';
import { askSignOut } from '@liveworkspace/auth-client/sign-out';
import {
  askToken,
  askTokenUntilKnown,
  type TokenAnswer,
} from '@liveworkspace/auth-client/token-answer';
import { retrySilentSignIn } from '@liveworkspace/auth-client/silent';
import { useEffect } from 'react';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';
import { profilePictureOf } from '@liveworkspace/sites/picture';
import { lastSeenCopies } from '@/lib/last-seen';
import { forgetRecentDiagrams } from '@/lib/recent-diagrams-snapshot';
import { readSignedInHint } from '@/lib/signed-in-hint';
import {
  DEFERRED_AUTH_DEFAULT,
  type DeferredAuthState,
} from '@liveworkspace/workbench/components/providers/deferred-auth';

type SessionUser = {
  id: string;
  email: string | null;
  // The ID token's given and family names (the api's `/api/auth/token` user), for the first and last name.
  givenName?: string | null;
  familyName?: string | null;
  name: string | null;
  // The ID token's Google picture and Show My Google Picture switch (apps/api/src/routes/auth.ts AuthUser).
  picture?: string | null;
  pictureHidden?: boolean;
};
type Session = { accessToken: string; expiresAt: number; user: SessionUser };

// Refresh this long before the access token expires, so a request never goes out with one that
// lapses in flight.
const EXPIRY_MARGIN_MS = 60_000;

let current: Session | null = null;
let inflight: Promise<Session | null> | null = null;

// The api's last answer, for the page's first ask: an unknown one is asked again, never read as signed out
// (@liveworkspace/auth-client/token-answer).
let lastAnswer: TokenAnswer<Session> = { kind: 'signed-out' };

async function requestSession(): Promise<Session | null> {
  const answer = await askToken<SessionUser>(API_BASE);
  lastAnswer = answer;
  return answer.kind === 'signed-in' ? answer.session : null;
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

// Ends the session here and, with it, the liveworkspace one and every app's in this browser
// (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"). Resolves the accounts site's hop, coming
// back to `returnTo`, or null when there is none to take.
async function endSession(returnTo = '/'): Promise<string | null> {
  current = null;
  // The last seen copies are this account's: none outlives the session in this browser.
  await Promise.all([forgetRecentDiagrams(), lastSeenCopies.forgetAll()]);
  return (await askSignOut(returnTo, { apiBase: API_BASE })).next;
}

// The names the app shows, the shared rule (@liveworkspace/auth-client/account-names): the first and last name
// the accounts site asked for, else the whole name split at its first space, else the email's local part.
export { namesOf };

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
      picture: profilePictureOf(user.picture),
      pictureHidden: user.pictureHidden === true,
    },
    getToken,
    // Clears what the retired returning-visitor note left in this browser. A full load, so nothing keeps the old session.
    signOut: async (opts) => {
      const to = opts?.redirectUrl ?? '/';
      window.location.assign((await endSession(to)) ?? to);
    },
    // The api has already deleted this account's livediagram data and closed its liveworkspace
    // account (DeleteAccountDialog); what is left is this tab's session.
    deleteAccount: async () => {
      await endSession();
    },
  };
}

// Whether to ask the api at all on load. The api sets the hint beside the refresh cookie and clears
// it with it (lib/signed-in-hint.ts), so a browser without it has no session to find: a guest settles
// at once, with no request on every page load. A stale hint only costs the one request it saves.
// `onUnreachable`: an answer that said nothing (a 5xx such as the api's `accounts_unreachable`, a network error, no
// answer in time). The page keeps waiting, and says it can't reach the account meanwhile (AuthProvider).
async function initialSession(onUnreachable: () => void): Promise<Session | null> {
  if (!readSignedInHint()) return null;
  // Asked until the api answers: a token request that fails or times out says nothing about the session, and
  // settling as a guest then would open the person's private items as not found.
  const answer = await askTokenUntilKnown<Session>(
    async () => {
      const session = await refresh();
      return session ? { kind: 'signed-in', session } : lastAnswer;
    },
    {
      onUnknown: (reason) => {
        console.warn(`[auth] token answer unknown (${reason}), asking again`);
        onUnreachable();
      },
    },
  );
  const session = answer.kind === 'signed-in' ? answer.session : null;
  // A hint that outlived its session (it ended in another app): the answer cleared the hint, and the silent sign-in
  // asks again, once, in case the person has signed in elsewhere since (liveworkspace/docs/specs/003-accounts/
  // accounts.md "A hint that outlived its session"). Only here, on the page's first answer: a session ending under
  // an open page never reloads it. When it goes, the page is leaving: it settles nothing, so no guest hand-off or other
  // navigation cuts the bounce short (Work Tracker 1007).
  if (!session && retrySilentSignIn()) return new Promise<never>(() => {});
  return session;
}

export function AccountsBridge({ onState }: { onState: (state: DeferredAuthState) => void }) {
  useEffect(() => {
    let live = true;
    const unreachable = () => {
      if (live) onState({ ...DEFERRED_AUTH_DEFAULT, accountUnreachable: true });
    };
    void initialSession(unreachable).then((session) => {
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
