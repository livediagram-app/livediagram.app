import type { Metadata } from 'next';
import { AccountRedirect } from '@/components/settings/AccountRedirect';

export const metadata: Metadata = { title: 'API tokens · liveworkspace', robots: { index: false } };

// /account/tokens is no longer a page: the API tokens are a category of the Settings panel, opened in the Explorer
// (the token expiry email links here; liveworkspace/docs/site.md "Your
// account").
export default function Page() {
  return <AccountRedirect />;
}
