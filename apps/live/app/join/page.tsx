import type { Metadata } from 'next';
import { TeamInviteJoin } from '@/components/panels/TeamInviteJoin';

// /join?token=<token> — landing for a shareable team invite link
// (spec/32). A top-level route (outside the Explorer chrome) so the
// signed-out flow can show its own "sign in to join" card instead of
// being bounced by the explorer's auth gate. `index: false` is
// inherited from the root layout (spec/07 keeps the live app out of the
// index). The token is read client-side, so this stays a thin shell.
export const metadata: Metadata = {
  title: 'Join a team | livediagram',
};

export default function JoinPage() {
  return <TeamInviteJoin />;
}
