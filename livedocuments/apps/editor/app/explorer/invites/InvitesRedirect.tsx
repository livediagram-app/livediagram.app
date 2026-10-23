'use client';

import { useEffect } from 'react';
import { manageTeamsUrl } from '@/lib/auth-config';

// Team invitations are answered on liveworkspace.app (docs/specs/013-workspace/teams.md "Invitations"), which lists
// them with Accept and Decline: this address, where the Explorer's Invites row and old invitation emails lead, goes
// there. `replace`, so Back does not bounce the reader straight back here.
export const INVITES_TARGET = `${manageTeamsUrl}#invitations`;

export function InvitesRedirect() {
  useEffect(() => {
    window.location.replace(INVITES_TARGET);
  }, []);
  return (
    <p role="status" className="sr-only">
      Taking you to your invitations on liveworkspace.app… <a href={INVITES_TARGET}>Continue</a>
    </p>
  );
}
