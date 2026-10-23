import type { Metadata } from 'next';
import { OfflineDocuments } from './OfflineDocuments';

// This Browser (docs/specs/013-workspace/explorer-structure.md "This Browser"): the documents kept only in this
// browser.
export const metadata: Metadata = {
  title: 'This Browser | livedocuments',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflineDocuments />;
}
