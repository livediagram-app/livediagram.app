import type { Metadata } from 'next';

import { LegalRedirect } from '@liveworkspace/marketing-site/components/LegalRedirect';

// The terms of service cover every liveworkspace app, liveplanner included, so they live on liveworkspace.app.
// This page keeps the historical /terms URL alive (it redirects there) but is noindex so search engines
// consolidate on that page.
const TERMS_URL = 'https://liveworkspace.app/terms';

export const metadata: Metadata = {
  title: 'Terms of Service · liveplanner',
  description: "The terms of service for liveplanner are liveworkspace's, on liveworkspace.app.",
  robots: { index: false, follow: true },
  alternates: { canonical: TERMS_URL },
};

export default function TermsPage() {
  return (
    <LegalRedirect
      href={TERMS_URL}
      heading="Our terms of service have moved"
      linkText="read the terms of service here"
      lead="They now live on liveworkspace.app and cover every liveworkspace app."
    />
  );
}
