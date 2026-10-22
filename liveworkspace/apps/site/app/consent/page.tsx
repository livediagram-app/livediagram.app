import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';
import { Consent } from '@/components/account/Consent';
import { ACCOUNT_PAGE_METADATA } from '@/lib/account-metadata';

export const metadata: Metadata = {
  ...ACCOUNT_PAGE_METADATA,
  title: 'Allow access · liveworkspace',
  alternates: { canonical: '/consent' },
};

export default function Page() {
  return (
    <AccountPage alone>
      <Consent />
    </AccountPage>
  );
}
