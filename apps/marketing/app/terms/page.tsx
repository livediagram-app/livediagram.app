import type { Metadata } from 'next';

import { LegalRedirect } from '@/components/LegalRedirect';

// The terms of service moved into the help centre (Policies). This page keeps
// the historical /terms URL alive — it redirects there — but is noindex so
// search engines consolidate on the canonical help article rather than this
// thin redirect.
const HELP_TERMS_URL = '/help/policies/terms/';

export const metadata: Metadata = {
  title: 'Terms of Service · livediagram',
  description: 'The livediagram terms of service now live in the help centre.',
  robots: { index: false, follow: true },
  alternates: { canonical: HELP_TERMS_URL },
};

export default function TermsPage() {
  return (
    <LegalRedirect
      href={HELP_TERMS_URL}
      heading="Our terms of service have moved"
      linkText="read the terms of service here"
    />
  );
}
