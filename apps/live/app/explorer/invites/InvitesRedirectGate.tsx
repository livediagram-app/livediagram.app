'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from '../ExplorerContext';
import { ExplorerPane } from '../ExplorerPane';

// Invites are team-only (spec/32), so a signed-out visitor has nothing
// to see here. Once auth has settled, bounce them to sign-in with a
// `redirect_url` back to this page so they land on their invites after
// signing in or registering. Signed-in invitees see their pending
// invites automatically — the worker connects invites by the verified
// email the app forwards (no link to claim). Clerk-disabled (self-host)
// deploys have no teams, so we leave the pane be there.
export function InvitesRedirectGate() {
  const { authLoaded, clerkUserId } = useExplorer();
  const router = useRouter();
  const signedOut = authLoaded && !clerkUserId && clerkEnabled;

  useEffect(() => {
    if (signedOut) {
      router.replace('/sign-in/?redirect_url=/explorer/invites');
    }
  }, [signedOut, router]);

  // Hold the pane back while we redirect so the invites UI doesn't
  // flash for a guest before the bounce lands.
  if (!authLoaded || signedOut) return null;
  return <ExplorerPane />;
}
