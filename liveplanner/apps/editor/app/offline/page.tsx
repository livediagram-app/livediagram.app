import type { Metadata } from 'next';
import { OfflinePlans } from './OfflinePlans';

// This Browser (docs/specs/013-workspace/explorer-structure.md "This Browser"): the plans kept only in this browser.
export const metadata: Metadata = {
  title: 'This Browser | liveplanner',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflinePlans />;
}
