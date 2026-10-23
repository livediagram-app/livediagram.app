import type { Metadata } from 'next';
import { ManagedOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';
import { manageTeamsUrl } from '@/lib/auth-config';

// /join/decline — where a team invite email's Decline link used to land (docs/specs/013-workspace/
// teams.md). Invitations are answered on liveworkspace.app now (liveworkspace/docs/accounts.md), so
// this points there. `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Decline a team invite | livediagram',
};

export default function DeclineInvitePage() {
  return (
    <ManagedOnLiveworkspace
      title="Invitations are on liveworkspace.app"
      body="Team invitations are answered on liveworkspace.app, where you can join a team or decline."
      href={manageTeamsUrl}
      cta="Open your invitations"
    />
  );
}
