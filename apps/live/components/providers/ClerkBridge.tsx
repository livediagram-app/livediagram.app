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
  useUser,
} from '@clerk/react';
import { useEffect } from 'react';
import { clerkPublishableKey } from '@/lib/clerk-config';
import type { DeferredAuthState } from './deferred-auth';

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
          }
        : null,
      getToken: async () => (await getToken()) ?? null,
      signOut: (opts) => signOut(opts),
      deleteAccount: isSignedIn ? () => deleteUserReverified() : null,
    });
    // deleteUserReverified is re-minted per render by Clerk's hook; the
    // published closure reads it via this effect's latest run, and the
    // state identity is keyed on the auth fields that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, userId, user, getToken, signOut, onState]);

  return null;
}
