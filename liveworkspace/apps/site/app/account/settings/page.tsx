import type { Metadata } from 'next';
import { AccountShell } from '@/components/settings/AccountShell';
import { SettingsLanding } from '@/components/settings/SettingsLanding';

export const metadata: Metadata = {
  title: 'Settings · liveworkspace',
  robots: { index: false },
  alternates: { canonical: '/account/settings' },
};

// The Settings panel, opened over the account page (liveworkspace/docs/site.md "Settings"): the same panel every
// app's Settings and the Explorer open.
export default function Page() {
  return (
    <AccountShell
      path="/account/settings"
      intro="Your profile, the emails we send you, your privacy and accessibility choices, and every app’s own settings. Each is saved as you change it."
    >
      <SettingsLanding />
    </AccountShell>
  );
}
