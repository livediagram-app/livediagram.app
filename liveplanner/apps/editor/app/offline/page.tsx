import type { Metadata } from 'next';
import { OfflineRedirect } from '@liveworkspace/explorer/offline-redirect';

// The old This Browser page: the plans kept only in this browser are a view of the Explorer now, in the editor's
// Explorer panel and at /explorer/offline (docs/specs/013-workspace/explorer-structure.md "This Browser"). This
// address only sends people there, its query kept.
export const metadata: Metadata = {
  title: 'This Browser | liveplanner',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflineRedirect />;
}
