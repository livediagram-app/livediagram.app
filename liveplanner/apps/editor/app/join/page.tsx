import type { Metadata } from 'next';
import { ManagedOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';

// /join — where a shareable team invite link used to land (docs/specs/013-workspace/teams.md). Teams
// are run in the Explorer now (liveworkspace/docs/one-explorer.md "Teams are run in the Explorer"), so
// this points at its Invites. `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Join a team | liveplanner',
};

export default function JoinPage() {
  return (
    <ManagedOnLiveworkspace
      title="Teams are in the Explorer"
      body="Your teams work in every liveworkspace app. Invitations wait for you in the Explorer's Invites, where you can accept them, and your teams are under Spaces."
      href="/explorer/invites"
      cta="Open your invitations"
    />
  );
}
