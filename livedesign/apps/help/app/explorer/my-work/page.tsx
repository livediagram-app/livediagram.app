import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// The space was "My Work", became "My Designs", and is "My Work" again (docs/specs/013-workspace/team-shared-designs.md); its article moved
// to personal-space along the way.
// This stub keeps the old help URL alive (it redirects there) but is noindex
// so search engines consolidate on the canonical article rather than this
// thin redirect.
const NEW_URL = '/help/explorer/personal-space/';

export const metadata: Metadata = {
  title: 'My Work and Folders',
  description: 'The My Work guide has moved.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function MyWorkRedirectPage() {
  return <Redirect href={NEW_URL} label="My Work guide" />;
}
