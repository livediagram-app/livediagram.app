import type { Metadata } from 'next';
import { ManagedOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';
import { manageTeamsUrl } from '@/lib/auth-config';

// /join — where a shareable team invite link used to land (docs/specs/013-workspace/teams.md). Teams
// are run on liveworkspace.app now (liveworkspace/docs/accounts.md), where people are invited by
// email, so this points there. `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Join a team | livediagram',
};

export default function JoinPage() {
  return (
    <ManagedOnLiveworkspace
      title="Teams are on liveworkspace.app"
      body="Your teams work in every liveworkspace app. Invitations wait for you on liveworkspace.app, where you can join and see the teams you're in."
      href={manageTeamsUrl}
      cta="Open your teams"
    />
  );
}
