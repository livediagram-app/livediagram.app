'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClaimTeamInvite } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from '../ExplorerContext';
import { ExplorerPane } from '../ExplorerPane';

// Invites are team-only (spec/32). Two jobs:
//   - Signed-out visitor: bounce to sign-in with a `redirect_url` back
//     here (carrying any `?token=` so the claim resumes post-auth).
//   - Signed-in visitor arriving with `?token=` (an invite link): claim
//     it server-side, drop the param, and refresh so the new pending
//     invite shows. Token-based, so it works regardless of the Clerk
//     session-token email claim.
// Clerk-disabled (self-host) deploys have no teams, so we leave the
// pane be there.
export function InvitesRedirectGate() {
  const { authLoaded, clerkUserId, ownerId, refreshTeams } = useExplorer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const signedOut = authLoaded && !clerkUserId && clerkEnabled;

  useEffect(() => {
    if (!signedOut) return;
    // Preserve the invite token through sign-in so the claim resumes.
    const back = token
      ? `/live/explorer/invites?token=${encodeURIComponent(token)}`
      : '/live/explorer/invites';
    router.replace(`/sign-in/?redirect_url=${encodeURIComponent(back)}`);
  }, [signedOut, token, router]);

  const claimedRef = useRef(false);
  useEffect(() => {
    if (!authLoaded || !clerkUserId || !ownerId || !token || claimedRef.current) return;
    claimedRef.current = true;
    void apiClaimTeamInvite(ownerId, token).then((res) => {
      void refreshTeams();
      // Already a member → send them to the team; otherwise just drop
      // the token from the URL (a fresh pending invite now in the pane,
      // or an invalid token that simply leaves the list unchanged).
      if (res?.alreadyMember) {
        router.replace(`/explorer/team?id=${encodeURIComponent(res.teamId)}`);
      } else {
        router.replace('/explorer/invites');
      }
    });
  }, [authLoaded, clerkUserId, ownerId, token, router, refreshTeams]);

  // Hold the pane back while we redirect so the invites UI doesn't
  // flash for a guest before the bounce lands.
  if (!authLoaded || signedOut) return null;
  return <ExplorerPane />;
}
