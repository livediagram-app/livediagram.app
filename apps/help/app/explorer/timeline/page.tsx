import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// The Explorer's Timeline section was removed (docs/specs/013-workspace/timeline.md); its URL held the Home
// article, which moved to explorer/home. This stub keeps the old help URL alive (it redirects there) but is noindex
// so search engines consolidate on the canonical article rather than this thin redirect.
const NEW_URL = '/help/explorer/home/';

export const metadata: Metadata = {
  title: 'Home',
  description: 'The Home article has moved.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function TimelineRedirectPage() {
  return <Redirect href={NEW_URL} label="Home guide" />;
}
