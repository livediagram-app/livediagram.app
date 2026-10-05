'use client';

// The only module in the Community app that imports @clerk/react, loaded through LazyClerkSession so the
// library lands in its own chunk and only when My Shares is on (docs/specs/025-community/community.md "My
// Shares"). It mounts Clerk around a small publisher that reports the session up; nothing renders inside.

import { ClerkProvider, useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { clerkPublishableKey, type CommunitySession } from '@/lib/session';

// Clerk's getToken() can resolve null for a moment on a live session; one short retry covers it.
const TOKEN_RETRY_MS = 300;

export default function ClerkSession({
  onSession,
}: {
  onSession: (session: CommunitySession) => void;
}) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey!}
      signInUrl="/sign-in/"
      signUpUrl="/get-started/"
    >
      <Publisher onSession={onSession} />
    </ClerkProvider>
  );
}

function Publisher({ onSession }: { onSession: (session: CommunitySession) => void }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  useEffect(() => {
    onSession({
      loaded: isLoaded,
      signedIn: isSignedIn === true,
      getToken: async () => {
        const token = await getToken();
        if (token || !isSignedIn) return token ?? null;
        await new Promise((resolve) => setTimeout(resolve, TOKEN_RETRY_MS));
        return (await getToken()) ?? null;
      },
    });
  }, [getToken, isLoaded, isSignedIn, onSession]);
  return null;
}
