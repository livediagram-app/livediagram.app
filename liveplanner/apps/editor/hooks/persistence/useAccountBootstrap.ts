'use client';

import { DEFERRED_AUTH_PENDING, useDeferredAuth } from '@/components/providers/deferred-auth';
import {
  useWorkbenchSession,
  type WorkbenchSession,
} from '@/components/providers/workbench-session-context';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { registerTokenProvider } from '@/lib/api-client';
import { clearGuestToken } from '@/lib/guest-token';

// Two things every page that talks to the api needs to do once a
// session can exist:
//
//   1. Register `() => getToken()` as the api-client's token provider
//      so every request ships the account's `Authorization: Bearer <jwt>` instead of
//      the guest's (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/api.md). Clear on sign-out
//      / unmount so the guest path resumes cleanly.
//
//   2. Drop the guest token once signed in. The guest's things became the account's when it signed in on
//      liveworkspace.app, which tells the index before the session exists (liveworkspace/docs/accounts.md
//      "Signing in keeps a guest's things"), so there is nothing left to move from here.
//
// Returns the relevant `useAuth` fields so callers don't need to also
// destructure them — there's exactly one place those values come from
// per page.

type BootstrapResult = {
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  accountUserId: string | null | undefined;
  // Best-guess display name for the signed-in account. Used to
  // seed the participant record on first load so a signed-in user
  // never appears under the random "Sleepy Lemur" placeholder, and
  // to lock the welcome-modal name input when joining someone
  // else's project (the user explicitly asked that visitors with a
  // account aren't allowed to type a different display name).
  // Null when the session hasn't surfaced the user yet, the user signed
  // out, or the user genuinely has no name configured.
  accountDisplayName: string | null;
};

// The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench", I9) is the session's person, settled at once: no guest token, no timeout, no token
// provider here (WorkbenchAuthBridge registers the session's).
function workbenchResult(session: WorkbenchSession): BootstrapResult {
  return {
    isSignedIn: true,
    authLoaded: true,
    accountUserId: session.person.id,
    accountDisplayName: session.person.name,
  };
}

// Above the workbench page's editor the auth is held (DEFERRED_AUTH_PENDING): never settled, never a
// guest, however long it waits.
const HELD: BootstrapResult = {
  isSignedIn: false,
  authLoaded: false,
  accountUserId: null,
  accountDisplayName: null,
};

export function useAccountBootstrap(): BootstrapResult {
  const workbench = useWorkbenchSession();
  const auth = useDeferredAuth();
  const held = workbench !== null || auth === DEFERRED_AUTH_PENDING;
  const { getToken, isSignedIn, authLoaded: sessionLoaded, userId: accountUserId, user } = auth;

  // If the session hasn't reported its state within 5 s, treat it as
  // guest rather than hanging the canvas indefinitely. Corporate proxies
  // (e.g. Zscaler) sometimes hold connections open for tens of seconds
  // before failing, which blocks rendering. When the
  // timer fires isSignedIn is still undefined so the token provider stays
  // null and the guest token is sent. If the session eventually loads
  // after the timeout, isSignedIn updates and the token provider effect
  // below re-runs, switching subsequent API calls to the JWT path.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (sessionLoaded || held) return;
    const id = window.setTimeout(() => setTimedOut(true), 5000);
    return () => window.clearTimeout(id);
  }, [sessionLoaded, held]);
  // 2. The guest token is spent once signed in (see above).
  useEffect(() => {
    if (held || !isSignedIn || !accountUserId) return;
    clearGuestToken();
  }, [held, isSignedIn, accountUserId]);
  const authLoaded = sessionLoaded || timedOut;

  // First+Last takes precedence so we always present the form the
  // user picked at sign-up. Falls back to fullName and finally the
  // username so we never show a blank pill for an account that does
  // exist.
  const accountDisplayName = useMemo(() => {
    if (!user) return null;
    const fl = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fl || user.fullName || user.username || null;
  }, [user]);

  // 1. Token provider registration. The signed-in user's email is no
  // longer forwarded as a header — team-invite matching trusts only the
  // verified `email` session-token claim server-side (docs/specs/013-workspace/teams.md).
  //
  // A LAYOUT effect on purpose. React runs a child's passive effects before
  // its parent's, and the render that flips `isSignedIn` is the same one that
  // hands children the account id as their owner. With a plain useEffect, that child's first
  // fetch went out before the provider existed, so apiHeaders fell back to
  // no identity for an account id, which the worker refuses with a 401 (an account id
  // is never a guest credential). Every layout effect runs before any
  // passive one, so the provider is in place by the time a child fetches.
  //
  // Registered, not set: the page, AuthControls and the Settings rows each
  // mount this hook, and one of them unmounting must leave the others'
  // Bearer in place (see registerTokenProvider).
  useLayoutEffect(() => {
    if (held || !isSignedIn) return;
    return registerTokenProvider((opts) => getToken(opts));
  }, [held, isSignedIn, getToken]);

  if (workbench) return workbenchResult(workbench);
  if (held) return HELD;
  return { isSignedIn, authLoaded, accountUserId, accountDisplayName };
}
