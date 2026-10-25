import type { Metadata } from 'next';
import { Redirect } from '@liveworkspace/help-site/components/Redirect';

// The privacy policy covers every liveworkspace app, livediagram included, so it lives on liveworkspace.app. This stub
// keeps the old help URL alive (it redirects there) but is noindex so search engines consolidate on that page.
const NEW_URL = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/privacy';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "The privacy policy for livediagram is liveworkspace's, on liveworkspace.app.",
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function PrivacyPolicyRedirectPage() {
  return <Redirect href={NEW_URL} label="privacy policy" />;
}
