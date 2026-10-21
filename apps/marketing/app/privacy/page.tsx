import type { Metadata } from 'next';

import { LegalRedirect } from '@/components/LegalRedirect';

// The privacy policy moved into the help centre (Policies). This page keeps the
// historical /privacy URL alive — it redirects there — but is noindex so search
// engines consolidate on the canonical help article rather than this thin
// redirect.
const HELP_PRIVACY_URL = '/help/policies/privacy-policy/';

export const metadata: Metadata = {
  title: 'Privacy Policy · livediagram',
  description: 'The livediagram privacy policy now lives in the help centre.',
  robots: { index: false, follow: true },
  alternates: { canonical: HELP_PRIVACY_URL },
};

export default function PrivacyPage() {
  return (
    <LegalRedirect
      href={HELP_PRIVACY_URL}
      heading="Our privacy policy has moved"
      linkText="read the privacy policy here"
    />
  );
}
