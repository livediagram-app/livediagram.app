import type { Metadata } from 'next';
import { AccountRedirect } from '@/components/settings/AccountRedirect';

export const metadata: Metadata = { title: 'Settings · liveworkspace', robots: { index: false } };

// /account/settings is no longer a page: it opens the Settings panel, in the Explorer, on the section the address
// names (every email ever sent links here; liveworkspace/docs/site.md "Your
// account").
export default function Page() {
  return <AccountRedirect />;
}
