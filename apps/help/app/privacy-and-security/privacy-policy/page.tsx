import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// The privacy policy moved into the new Policies category. This stub keeps the
// old help URL alive (it redirects there) but is noindex so search engines
// consolidate on the canonical article rather than this thin redirect.
const NEW_URL = '/help/policies/privacy-policy/';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'The livediagram privacy policy now lives under Policies.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function PrivacyPolicyRedirectPage() {
  return <Redirect href={NEW_URL} label="privacy policy" />;
}
