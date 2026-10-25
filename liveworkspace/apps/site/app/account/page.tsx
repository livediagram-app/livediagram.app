import type { Metadata } from 'next';
import { AccountRedirect } from '@/components/settings/AccountRedirect';

export const metadata: Metadata = { title: 'Settings · liveworkspace', robots: { index: false } };

// /account has no page of its own: it opens the Settings panel, in the Explorer (liveworkspace/docs/site.md "Your
// account").
export default function Page() {
  return <AccountRedirect />;
}
