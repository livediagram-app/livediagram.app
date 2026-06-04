'use client';

import { useAuth, useUser } from '@clerk/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiMigrateGuestData, setTokenProvider } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { clearGuestSelfId, getGuestSelfId } from '@/lib/local-identity';

// Two things every page that talks to the api needs to do once Clerk
// is in the tree:
//
//   1. Register `() => getToken()` as the api-client's token provider
//      so every request ships `Authorization: Bearer <jwt>` instead of
//      the legacy `X-Owner-Id` (spec/04 + spec/11). Clear on sign-out
//      / unmount so the guest path resumes cleanly.
//
//   2. Run the guest → authed migration the first time the user is
//      signed in AND `livediagram:v2:self-id` is still in localStorage.
//      `POST /api/migrate` reassigns every `diagrams.owner_id` +
//      `folders.owner_id` row from the guest id to the Clerk userId
//      (spec/04 + spec/11). On success we drop the localStorage key so
//      subsequent loads skip the call entirely. A ref guards against
//      React StrictMode's double-render firing two migration calls
//      in dev.
//
// Both Stage 3 (token provider) and Stage 4 (migration) lived as
// identical copy-paste pairs in editor-page.tsx and new/page.tsx until
// this hook collapsed them — CLAUDE.md's reuse rule kicks in.
//
// Returns the relevant `useAuth` fields so callers don't need to also
// destructure them — there's exactly one place those values come from
// per page.
//
// When Clerk isn't configured for the deployment (spec/03 self-host
// path, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset), the hook returns
// a stable stub — `useAuth` would throw outside a ClerkProvider, so
// the disabled branch never touches Clerk at all. The choice between
// real-Clerk and stub is made at module load, then frozen — React's
// rules-of-hooks require the same function to run on every render,
// which this satisfies because `clerkEnabled` is a compile-time
// constant baked from a `NEXT_PUBLIC_*` env var.

type BootstrapResult = {
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  clerkUserId: string | null | undefined;
  // Best-guess display name for the signed-in Clerk user. Used to
  // seed the participant record on first load so a signed-in user
  // never appears under the random "Sleepy Lemur" placeholder, and
  // to lock the welcome-modal name input when joining someone
  // else's diagram (the user explicitly asked that visitors with a
  // Clerk account aren't allowed to type a different display name).
  // Null when Clerk hasn't surfaced the user yet, the user signed
  // out, or the user genuinely has no name configured.
  clerkDisplayName: string | null;
};

function useClerkApiBootstrapEnabled(): BootstrapResult {
  const { getToken, isSignedIn, isLoaded: clerkLoaded, userId: clerkUserId } = useAuth();
  const { user } = useUser();

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
    if (clerkLoaded) return;
    const id = window.setTimeout(() => setTimedOut(true), 5000);
    return () => window.clearTimeout(id);
  }, [clerkLoaded]);
  const authLoaded = clerkLoaded || timedOut;

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

  // 1. Token provider registration.
  useEffect(() => {
    if (isSignedIn) {
      setTokenProvider(() => getToken());
    } else {
      setTokenProvider(null);
    }
    return () => setTokenProvider(null);
  }, [isSignedIn, getToken]);

  // 2. Guest → authed migration. Fires at most once per session.
  const migrateAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || !clerkUserId) return;
    if (migrateAttemptedRef.current) return;
    const guestId = getGuestSelfId();
    if (!guestId || guestId === clerkUserId) return;
    migrateAttemptedRef.current = true;
    void apiMigrateGuestData(guestId)
      .then((res) => {
        if (res) clearGuestSelfId();
      })
      .catch(() => {
        // Network glitch — leave the localStorage id in place so a
        // future load retries.
        migrateAttemptedRef.current = false;
      });
  }, [isSignedIn, clerkUserId]);

  return { isSignedIn, authLoaded, clerkUserId, clerkDisplayName };
}

function useClerkApiBootstrapDisabled(): BootstrapResult {
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

export const useClerkApiBootstrap = clerkEnabled
  ? useClerkApiBootstrapEnabled
  : useClerkApiBootstrapDisabled;
