import type { Metadata } from 'next';
import { AccountShell } from '@/components/settings/AccountShell';
import { TeamPage } from '@/components/teams/TeamPage';
import { TEAM_PAGE_PLACEHOLDER } from '@/lib/teams';

// One team's page, /account/teams/<id> (liveworkspace/docs/site.md "Your account"). The site is a
// static export and team ids are made by people, so it is exported once, at a placeholder id;
// public/_redirects serves that file for every /account/teams/<id>, and the page reads the real id
// from the address.
export const generateStaticParams = async () => [{ id: TEAM_PAGE_PLACEHOLDER }];

export const metadata: Metadata = {
  title: 'Team · liveworkspace',
  robots: { index: false },
};

export default function Page() {
  return (
    <AccountShell path="/account/teams" hero={false}>
      <TeamPage />
    </AccountShell>
  );
}
