import type { Metadata } from 'next';
import { DriveOpenPage } from '@/components/drive/DriveOpenPage';

// Google Drive's Open with, /drive/open?state=… (liveworkspace/docs/drive.md "Open with"), for every app's files.
// Static; the page reads Drive's state from the address. No Referer, since the address names a file.
export const metadata: Metadata = {
  title: 'Open from Google Drive · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <DriveOpenPage />;
}
