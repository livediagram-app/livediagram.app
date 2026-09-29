// What the avatar's sync mark says (docs/specs/022-drive-mirror/drive-mirror.md,
// "At a glance"; blueprint "Presentation and UX"). Pure, so every state is tested.

import type { DriveMode } from '@livediagram/api-schema';
import type { DriveMirrorStatus } from '@/lib/drive/engine';

export type DriveIndicatorKind = 'none' | 'syncing' | 'synced' | 'attention';

export type DriveIndicator = {
  kind: DriveIndicatorKind;
  label: string;
  progress: { done: number; total: number } | null;
};

const NONE: DriveIndicator = { kind: 'none', label: '', progress: null };

// `syncingLong`: the pass has been running for DRIVE_SYNCING_MARK_DELAY_MS, so
// the cheap start-token check never flashes the mark.
export function driveIndicator(
  status: DriveMirrorStatus,
  mode: DriveMode,
  syncingLong: boolean,
): DriveIndicator {
  if (mode === 'off' || status.state === 'starting' || status.state === 'disconnected') return NONE;
  const attention =
    status.state === 'needs_reconnect' ||
    status.state === 'needs_resume' ||
    status.error !== null ||
    status.notices.length > 0 ||
    status.skipped.length > 0;
  if (attention)
    return { kind: 'attention', label: 'Google Drive needs attention', progress: null };
  if (status.progress) {
    return {
      kind: 'syncing',
      label: `Google Drive copying ${status.progress.done} of ${status.progress.total}`,
      progress: status.progress,
    };
  }
  if (status.state === 'syncing' && (syncingLong || status.lastSyncedAt === null)) {
    return { kind: 'syncing', label: 'Google Drive syncing', progress: null };
  }
  if (status.lastSyncedAt !== null)
    return { kind: 'synced', label: 'Google Drive synced', progress: null };
  return NONE;
}
