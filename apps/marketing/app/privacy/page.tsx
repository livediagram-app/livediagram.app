import type { Metadata } from 'next';

import { PrivacyRedirect } from './PrivacyRedirect';

// The privacy policy moved into the help centre (Privacy and Security). This
// page keeps the historical /privacy URL alive — it redirects there — but is
// noindex so search engines consolidate on the canonical help article rather
// than indexing this thin redirect.
const HELP_PRIVACY_URL = '/help/privacy-and-security/privacy-policy/';

export const metadata: Metadata = {
  title: 'Privacy Policy · livediagram',
  description: 'The livediagram privacy policy now lives in the help centre.',
  robots: { index: false, follow: true },
  alternates: { canonical: HELP_PRIVACY_URL },
};

export default function PrivacyPage() {
  return <PrivacyRedirect href={HELP_PRIVACY_URL} />;
}
