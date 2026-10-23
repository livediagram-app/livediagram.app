import type { Metadata } from 'next';
import { InvitationsOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';
import { viewDocumentTitle } from '../view-titles';

// /explorer/invites — team invitations are answered on liveworkspace.app now
// (liveworkspace/docs/accounts.md), the same team in every app, so this points there.
export const metadata: Metadata = {
  title: viewDocumentTitle('invites'),
};

export default function Page() {
  return <InvitationsOnLiveworkspace />;
}
