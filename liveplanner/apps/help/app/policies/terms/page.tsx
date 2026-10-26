import type { Metadata } from 'next';
import { Redirect } from '@liveworkspace/help-site/components/Redirect';

// The terms of use cover every liveworkspace app, liveplanner included, so they live on liveworkspace.app. This
// stub keeps the old help URL alive (it redirects there) but is noindex so search engines consolidate on that page.
const NEW_URL = 'https://liveworkspace.app/terms';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: "The terms of use for liveplanner are liveworkspace's, on liveworkspace.app.",
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function TermsRedirectPage() {
  return <Redirect href={NEW_URL} label="terms of use" />;
}
