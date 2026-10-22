import type { Metadata } from 'next';
import { DriveOpen } from '@/components/drive/DriveOpen';

// /drive/open: the Google Drive UI integration's Open URL ("Open with")
// (docs/specs/022-drive-mirror/drive-mirror.md, "Open with"). Client-side only.
export const metadata: Metadata = {
  title: 'Opening from Google Drive | livediagram',
};

export default function DriveOpenPage() {
  return <DriveOpen />;
}
