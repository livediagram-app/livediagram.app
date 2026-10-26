import type { Metadata } from 'next';
import { DriveConnectPage } from '@/components/drive/DriveConnectPage';

// Where every app's Cloud Sync Connect leaves for, /drive/connect?return=… (liveworkspace/docs/specs/005-drive/drive.md "Connecting").
// Static; the page reads the return page from the address. No Referer, since the address carries it.
export const metadata: Metadata = {
  title: 'Connect Google Drive · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <DriveConnectPage />;
}
