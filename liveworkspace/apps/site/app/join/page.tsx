import type { Metadata } from 'next';
import { JoinPage } from '@/components/teams/JoinPage';

// Where a team's join link lands: /join?token=… (liveworkspace/docs/accounts.md "The join link").
// Static, so the page reads the token from the address. No Referer, since the address carries it.
export const metadata: Metadata = {
  title: 'Join a team · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <JoinPage />;
}
