import type { Metadata } from 'next';
import { AccountShell } from '@/components/settings/AccountShell';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { SETTINGS_CONTENTS } from '@/lib/account-settings';

export const metadata: Metadata = {
  title: 'Settings · liveworkspace',
  robots: { index: false },
  alternates: { canonical: '/account/settings' },
};

export default function Page() {
  return (
    <AccountShell
      path="/account/settings"
      contents={SETTINGS_CONTENTS}
      intro="Your profile, the emails we send you, and your privacy and accessibility choices. Each is saved as you change it, and holds in every app."
    >
      <SettingsPanel />
    </AccountShell>
  );
}
