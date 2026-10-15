'use client';

// The ONLY app-tree module that imports @clerk/react — loaded via
// next/dynamic from ClerkProvider so the whole library lands in an
// async chunk instead of the first load. It mounts the real Clerk
// provider around a small publisher (NOT around the app: the app
// consumes DeferredAuthContext instead of Clerk hooks) and pushes the
// distilled auth state up. Clerk's own portals (the reverification
// modal) render into document.body, so nothing user-facing needs to
// live inside this subtree.

import {
  ClerkProvider as Clerk,
  useAuth,
  useClerk,
  useReverification,
  useSession,
  useUser,
} from '@clerk/react';
import { useEffect } from 'react';
import { clerkPublishableKey } from '@/lib/clerk-config';
import { useLatest } from '@/hooks/ui/useLatest';
import { resolveProfilePicture } from '@/lib/account-avatar';
import { forgetRecentDiagrams } from '@/lib/recent-diagrams-snapshot';
import type { DeferredAuthState } from './deferred-auth';

// Clerk's reverification hint (`reverificationError('strict')` in @clerk/shared/authorization-errors): the shape
// useReverification answers with its step-up modal.
const REVERIFY_STRICT = {
  clerk_error: {
    type: 'forbidden',
    reason: 'reverification-error',
    metadata: { reverification: 'strict' },
  },
} as const;

export function ClerkBridge({ onState }: { onState: (state: DeferredAuthState) => void }) {
  return (
    <Clerk
      publishableKey={clerkPublishableKey!}
      signInUrl="/sign-in/"
      signUpUrl="/get-started/"
      afterSignOutUrl="/"
    >
      <Publisher onState={onState} />
    </Clerk>
  );
}

function Publisher({ onState }: { onState: (state: DeferredAuthState) => void }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  // Reverified self-deletion (step-up auth modal + user.delete), built
  // here because useReverification needs the Clerk context. Consumed by
  // DeleteAccountDialog via the deferred context.
  const deleteUserReverified = useReverification(async () => {
    if (!user) throw new Error('Not signed in');
    await user.delete();
  });
  // Clerk's hook re-mints it per render; the published closure calls the newest one, so the state is
  // only republished when an auth field that matters changes.
  const deleteUserRef = useLatest(deleteUserReverified);
  // The same step-up on its own (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"): asks for
  // a strict reverification when the session has none, by answering with Clerk's documented hint, which
  // useReverification meets with its modal and then retries.
  const { session } = useSession();
  const confirmReverified = useReverification(async () =>
    session && !session.checkAuthorization({ reverification: 'strict' }) ? REVERIFY_STRICT : true,
  );
  const confirmRef = useLatest(confirmReverified);

  useEffect(() => {
    onState({
      authLoaded: isLoaded,
      isSignedIn: isSignedIn === true,
      userId: userId ?? null,
      user: user
        ? {
            id: user.id,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            fullName: user.fullName ?? null,
            username: user.username ?? null,
            email: user.primaryEmailAddress?.emailAddress ?? null,
            createdAt: user.createdAt ?? null,
            pictureUrl: resolveProfilePicture(user),
          }
        : null,
      getToken: async (opts) => (await getToken(opts)) ?? null,
      // The landing page sign-out returns to must not show the account's recent diagrams
      // (docs/specs/019-marketing/returning-visitor.md); nor may it after the account is deleted.
      signOut: async (opts) => {
        await forgetRecentDiagrams();
        return signOut(opts);
      },
      deleteAccount: isSignedIn
        ? async () => {
            await deleteUserRef.current();
            await forgetRecentDiagrams();
          }
        : null,
      confirmIdentity: isSignedIn
        ? async () => {
            try {
              return (await confirmRef.current()) === true;
            } catch {
              // Cancelled (`reverification_cancelled`) or failed: either way, not confirmed.
              return false;
            }
          }
        : undefined,
    });
  }, [isLoaded, isSignedIn, userId, user, getToken, signOut, onState, deleteUserRef, confirmRef]);

  return null;
}
