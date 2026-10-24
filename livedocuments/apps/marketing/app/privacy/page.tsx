import type { Metadata } from 'next';

import { LegalRedirect } from '@/components/LegalRedirect';

// The privacy policy covers every liveworkspace app, livedocuments included, so it lives on liveworkspace.app. This
// page keeps the historical /privacy URL alive (it redirects there) but is noindex so search engines consolidate on
// that page.
const PRIVACY_URL = 'https://liveworkspace.app/privacy';

export const metadata: Metadata = {
  title: 'Privacy Policy · livedocuments',
  description: "The privacy policy for livedocuments is liveworkspace's, on liveworkspace.app.",
  robots: { index: false, follow: true },
  alternates: { canonical: PRIVACY_URL },
};

export default function PrivacyPage() {
  return (
    <LegalRedirect
      href={PRIVACY_URL}
      heading="Our privacy policy has moved"
      linkText="read the privacy policy here"
      lead="It now lives on liveworkspace.app and covers every liveworkspace app."
    />
  );
}
