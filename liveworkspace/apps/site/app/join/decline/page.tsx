import type { Metadata } from 'next';
import { DeclinePage } from '@/components/teams/DeclinePage';

// Where an invitation email's Decline link lands: /join/decline?token=… (liveworkspace/docs/specs/003-accounts/accounts.md
// "Invitations"). It works signed in or out, and declines only when its button is pressed.
export const metadata: Metadata = {
  title: 'Decline an invitation · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <DeclinePage />;
}
