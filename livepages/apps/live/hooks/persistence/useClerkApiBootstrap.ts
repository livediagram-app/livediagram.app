'use client';

import { DEFERRED_AUTH_PENDING, useDeferredAuth } from '@/components/providers/deferred-auth';
import {
  useWorkbenchSession,
  type WorkbenchSession,
} from '@/components/providers/workbench-session-context';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { registerTokenProvider } from '@/lib/api-client';
import { sessionsEnabled } from '@/lib/clerk-config';
import {
  guestMigrationPending,
  settleGuestMigration,
  subscribeGuestMigration,
} from '@/lib/guest-migration';

// Two things every page that talks to the api needs to do once Clerk
// is in the tree:
//
//   1. Register `() => getToken()` as the api-client's token provider
//      so every request ships `Authorization: Bearer <jwt>` instead of
//      the legacy `X-Owner-Id` (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/api.md). Clear on sign-out
//      / unmount so the guest path resumes cleanly.
//
//   2. Run the guest → authed migration the first time the user is
//      signed in AND `livediagram:v2:self-id` is still in localStorage.
//      `POST /api/migrate` reassigns every `documents.owner_id` +
//      `folders.owner_id` row from the guest id to the Clerk userId
//      (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/api.md). On success we drop the localStorage key so
//      subsequent loads skip the call entirely. `authLoaded` stays
//      false until the migration settles, so no page reads owner data
//      as the Clerk userId while it still belongs to the guest id
//      (issue #67). lib/guest-migration.ts runs it once per page load.
//
// Both Stage 3 (token provider) and Stage 4 (migration) lived as
// identical copy-paste pairs in editor-page.tsx and new/page.tsx until
// this hook collapsed them — AGENTS.md's reuse rule kicks in.
//
// Returns the relevant `useAuth` fields so callers don't need to also
// destructure them — there's exactly one place those values come from
// per page.
//
// When Clerk isn't configured for the deployment (docs/specs/002-project-scope/open-source-and-business-model.md self-host
// path, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset), the hook returns
// a stable stub — `useAuth` would throw outside a ClerkProvider, so
// the disabled branch never touches Clerk at all. The choice between
// real-Clerk and stub is made at module load, then frozen — React's
// rules-of-hooks require the same function to run on every render,
// which this satisfies because `sessionsEnabled` is a compile-time
// constant baked from a `NEXT_PUBLIC_*` env var.

type BootstrapResult = {
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  clerkUserId: string | null | undefined;
  // Best-guess display name for the signed-in Clerk user. Used to
  // seed the participant record on first load so a signed-in user
  // never appears under the random "Sleepy Lemur" placeholder, and
  // to lock the welcome-modal name input when joining someone
  // else's document (the user explicitly asked that visitors with a
  // Clerk account aren't allowed to type a different display name).
  // Null when Clerk hasn't surfaced the user yet, the user signed
  // out, or the user genuinely has no name configured.
  clerkDisplayName: string | null;
};

// The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench", I9) is the session's person, settled at once: no guest migration, no timeout, no token
// provider here (WorkbenchAuthBridge registers the session's).
function workbenchResult(session: WorkbenchSession): BootstrapResult {
  return {
    isSignedIn: true,
    authLoaded: true,
    clerkUserId: session.person.id,
    clerkDisplayName: session.person.name,
  };
}

// Above the workbench page's editor the auth is held (DEFERRED_AUTH_PENDING): never settled, never a
// guest, however long it waits.
const HELD: BootstrapResult = {
  isSignedIn: false,
  authLoaded: false,
  clerkUserId: null,
  clerkDisplayName: null,
};

function useClerkApiBootstrapEnabled(): BootstrapResult {
  const workbench = useWorkbenchSession();
  const auth = useDeferredAuth();
  const held = workbench !== null || auth === DEFERRED_AUTH_PENDING;
  const { getToken, isSignedIn, authLoaded: clerkLoaded, userId: clerkUserId, user } = auth;

  // If Clerk hasn't reported its state within 5 s, treat the session as
  // guest rather than hanging the canvas indefinitely. Corporate proxies
  // (e.g. Zscaler) sometimes hold connections to auth subdomains open
  // for tens of seconds before failing, which blocks rendering. When the
  // timer fires isSignedIn is still undefined so the token provider stays
  // null and the guest X-Owner-Id path is used. If Clerk eventually loads
  // after the timeout, isSignedIn updates and the token provider effect
  // below re-runs, switching subsequent API calls to the JWT path.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (clerkLoaded || held) return;
    const id = window.setTimeout(() => setTimedOut(true), 5000);
    return () => window.clearTimeout(id);
  }, [clerkLoaded, held]);
  // 2. Guest → authed migration. Read as an external store, so the very
  // first signed-in render already holds `authLoaded` and settling
  // releases it (see subscribeGuestMigration for why a re-render alone
  // is not enough under the React Compiler).
  const migrating = useSyncExternalStore(
    subscribeGuestMigration,
    () => !held && !!isSignedIn && !!clerkUserId && guestMigrationPending(clerkUserId),
    () => false,
  );
  useEffect(() => {
    if (held || !isSignedIn || !clerkUserId) return;
    void settleGuestMigration(clerkUserId);
  }, [held, isSignedIn, clerkUserId]);
  const authLoaded = (clerkLoaded || timedOut) && !migrating;

  // First+Last takes precedence so we always present the form the
  // user picked at sign-up. Falls back to fullName (covers OAuth
  // flows where Clerk parses the names differently) and finally the
  // username so we never show a blank pill for an account that does
  // exist.
  const clerkDisplayName = useMemo(() => {
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
  // hands children the Clerk id as their owner (the Explorer's
  // CustomThemeProvider, say). With a plain useEffect, that child's first
  // fetch went out before the provider existed, so apiHeaders fell back to
  // `X-Owner-Id: <Clerk id>`, which the worker refuses with a 401 (a Clerk id
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
  return { isSignedIn, authLoaded, clerkUserId, clerkDisplayName };
}

function useClerkApiBootstrapDisabled(): BootstrapResult {
  const workbench = useWorkbenchSession();
  const auth = useDeferredAuth();
  if (workbench) return workbenchResult(workbench);
  if (auth === DEFERRED_AUTH_PENDING) return HELD;
  // Stable stub for Clerk-disabled deployments. `authLoaded: true`
  // so anything gated on "has Clerk reported its state yet?" doesn't
  // wait forever; `isSignedIn: false` / `clerkUserId: null` keep the
  // caller in pure-guest mode.
  return {
    isSignedIn: false,
    authLoaded: true,
    clerkUserId: null,
    clerkDisplayName: null,
  };
}

export const useClerkApiBootstrap = sessionsEnabled
  ? useClerkApiBootstrapEnabled
  : useClerkApiBootstrapDisabled;
