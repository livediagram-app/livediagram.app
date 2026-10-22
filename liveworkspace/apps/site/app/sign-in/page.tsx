import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';
import { SignInFlow } from '@/components/account/SignInFlow';
import { ACCOUNT_PAGE_METADATA } from '@/lib/account-metadata';

export const metadata: Metadata = {
  ...ACCOUNT_PAGE_METADATA,
  title: 'Sign in · liveworkspace',
  alternates: { canonical: '/sign-in' },
};

export default function Page() {
  return (
    <AccountPage>
      <SignInFlow flow="sign-in" />
    </AccountPage>
  );
}
