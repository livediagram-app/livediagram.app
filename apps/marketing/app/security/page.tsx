import type { Metadata } from 'next';

import { LegalRedirect } from '@/components/LegalRedirect';

// The vulnerability disclosure policy lives in the help centre (Policies),
// beside the Terms and Privacy Policy. /security is the short, guessable URL
// researchers try first, so it redirects there; noindex like /privacy so
// search engines consolidate on the canonical help article.
// See docs/specs/002-project-scope/vulnerability-disclosure.md.
const HELP_SECURITY_URL = '/help/policies/report-a-vulnerability/';

export const metadata: Metadata = {
  title: 'Security · livediagram',
  description: 'How to report a security vulnerability in livediagram.',
  robots: { index: false, follow: true },
  alternates: { canonical: HELP_SECURITY_URL },
};

export default function SecurityPage() {
  return (
    <LegalRedirect
      href={HELP_SECURITY_URL}
      heading="Found a security vulnerability?"
      lead="Our disclosure policy lives in the help centre."
      linkText="read how to report it privately"
    />
  );
}
