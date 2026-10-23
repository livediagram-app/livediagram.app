import type { Metadata } from 'next';
import { OfflineDesigns } from './OfflineDesigns';

// This Browser (docs/specs/013-workspace/explorer-structure.md "This Browser"): the designs kept only in this browser.
export const metadata: Metadata = {
  title: 'This Browser | livedesign',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflineDesigns />;
}
