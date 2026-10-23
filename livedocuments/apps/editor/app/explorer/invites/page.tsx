import type { Metadata } from 'next';
import { InvitesRedirect } from './InvitesRedirect';

// /explorer/invites: the invitations waiting for the reader, answered on liveworkspace.app (InvitesRedirect). The
// route stays because old invitation emails carry it.
export const metadata: Metadata = {
  title: 'Invites | livedocuments',
  robots: { index: false, follow: false },
};

export default function InvitesPage() {
  return <InvitesRedirect />;
}
