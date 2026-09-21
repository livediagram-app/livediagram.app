import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// "My Work" became "Personal Space" (spec/35) and the article moved with it.
// This stub keeps the old help URL alive (it redirects there) but is noindex
// so search engines consolidate on the canonical article rather than this
// thin redirect.
const NEW_URL = '/help/explorer/personal-space/';

export const metadata: Metadata = {
  title: 'Personal Space and Folders',
  description: 'My Work is now called Personal Space; the article has moved.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function MyWorkRedirectPage() {
  return <Redirect href={NEW_URL} label="Personal Space guide" />;
}
