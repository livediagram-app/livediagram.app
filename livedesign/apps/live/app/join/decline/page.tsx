import type { Metadata } from 'next';
import { ManagedOnLiveworkspace } from '@liveworkspace/workbench/components/panels/ManagedOnLiveworkspace';

// /join/decline — where a team invite email's Decline link used to land (docs/specs/013-workspace/
// teams.md). Invitations are answered in the Explorer now (liveworkspace/docs/one-explorer.md), so
// this points at its Invites. `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Decline a team invite | livedesign',
};

export default function DeclineInvitePage() {
  return (
    <ManagedOnLiveworkspace
      title="Invitations are in the Explorer"
      body="Team invitations are answered in the Explorer's Invites, where you can accept or decline."
      href="/explorer/invites"
      cta="Open your invitations"
    />
  );
}
