import type { Metadata } from 'next';
import { AccountShell } from '@/components/settings/AccountShell';
import { TeamsPanel } from '@/components/settings/TeamsPanel';

export const metadata: Metadata = {
  title: 'Teams · liveworkspace',
  robots: { index: false },
  alternates: { canonical: '/account/teams' },
};

export default function Page() {
  return (
    <AccountShell path="/account/teams" intro={TEAMS_INTRO}>
      <TeamsPanel />
    </AccountShell>
  );
}

const TEAMS_INTRO =
  'A team is the same in every app. Make one here, invite people by email, and its work shows up for everyone in it, wherever they open it.';
