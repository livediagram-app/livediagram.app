import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// Unsorted is gone (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets): documents
// with no folder sit at the root of My documents, and the article went with it. This stub keeps
// the old help URL alive (it redirects there) but is noindex, so search engines consolidate on the
// canonical article rather than this thin redirect.
const NEW_URL = '/help/explorer/personal-space/';

export const metadata: Metadata = {
  title: 'My Documents and Folders',
  description: 'Unsorted is gone: documents with no folder sit at the root of My documents.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function UnsortedRedirectPage() {
  return <Redirect href={NEW_URL} label="My documents guide" />;
}
