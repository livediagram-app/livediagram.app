import type { Metadata } from 'next';
import { DriveConnectedPage } from '@/components/drive/DriveConnectedPage';

// Google's redirect URI for Drive's consent, /drive/connected?code=…&state=… (liveworkspace/docs/drive.md
// "Connecting"). Static; the page reads Google's answer from the address. No Referer, since the address carries a code.
export const metadata: Metadata = {
  title: 'Connecting Google Drive · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <DriveConnectedPage />;
}
