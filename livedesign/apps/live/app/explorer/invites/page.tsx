import type { Metadata } from 'next';
import { ManagedOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';
import { manageTeamsUrl } from '@/lib/auth-config';
import { viewDesignTitle } from '../view-titles';

// /explorer/invites — team invitations are answered on liveworkspace.app now
// (liveworkspace/docs/accounts.md), the same team in every app, so this points there.
export const metadata: Metadata = {
  title: viewDesignTitle('invites'),
};

export default function Page() {
  return (
    <ManagedOnLiveworkspace
      title="Invitations are on liveworkspace.app"
      body="Team invitations are answered on liveworkspace.app. Once you join, the team's work shows up here."
      href={manageTeamsUrl}
      cta="Open your invitations"
    />
  );
}
