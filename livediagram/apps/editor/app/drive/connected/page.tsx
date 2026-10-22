import type { Metadata } from 'next';
import { DriveConnected } from '@/components/drive/DriveConnected';

// /drive/connected: the Google OAuth redirect target for the Drive mirror
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"). Client-side only,
// so this stays a thin shell.
export const metadata: Metadata = {
  title: 'Connecting Google Drive | livediagram',
};

export default function DriveConnectedPage() {
  return <DriveConnected />;
}
