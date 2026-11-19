import type { Metadata } from 'next';
import { OfflineRedirect } from '@liveworkspace/explorer/offline-redirect';

// The old Offline page: the designs kept only in this browser are a view of the Explorer now, in the editor's
// Explorer panel and at /explorer/offline (docs/specs/013-workspace/explorer-structure.md "Offline"). This
// address only sends people there, its query kept.
export const metadata: Metadata = {
  title: 'Offline | livedesign',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflineRedirect />;
}
