'use client';

import { LiveworkspaceForward } from '@liveworkspace/workbench/components/panels/LiveworkspaceForward';

// /join/decline?token=… — where an invite email's Decline link used to land. Invitations are answered on
// liveworkspace.app now (liveworkspace/docs/specs/003-accounts/accounts.md "Invitations"), so an old link forwards
// there with its token. `index: false` is inherited from the root layout.
export default function DeclineInvitePage() {
  return (
    <LiveworkspaceForward
      path="/join/decline"
      title="Invitations are on liveworkspace.app"
      body="Team invitations are answered on liveworkspace.app. Taking you there to decline this invite."
      cta="Decline on liveworkspace.app"
    />
  );
}
