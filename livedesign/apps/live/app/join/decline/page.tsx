import type { Metadata } from 'next';
import { TeamInviteDecline } from '@/components/panels/TeamInviteDecline';

// /join/decline?token=<token>: where a team invite email's Decline link lands (docs/specs/013-workspace/teams.md
// "Declining from the email"). Beside /join, outside the Explorer chrome, so it works signed out. The token is
// read client-side, so this stays a thin shell; `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Decline a team invite | livedesign',
};

export default function DeclineInvitePage() {
  return <TeamInviteDecline />;
}
