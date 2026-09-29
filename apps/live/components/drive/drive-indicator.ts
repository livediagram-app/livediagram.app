// What the avatar's cloud badge says (docs/specs/022-drive-mirror/drive-mirror.md,
// "At a glance"; blueprint "The cloud badge"). Pure, so every state is tested.

import type { DriveMode } from '@livediagram/api-schema';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { relativeSince } from '@/lib/relative-time';

export type DriveIndicatorKind = 'none' | 'syncing' | 'synced' | 'attention';

export type DriveIndicator = {
  kind: DriveIndicatorKind;
  // The tooltip and the badge's accessible name, time included.
  label: string;
  // The status region's words: no time, so it does not speak every minute.
  announce: string;
  progress: { done: number; total: number } | null;
};

const NONE: DriveIndicator = { kind: 'none', label: '', announce: '', progress: null };

const same = (kind: DriveIndicatorKind, words: string): DriveIndicator => ({
  kind,
  label: words,
  announce: words,
  progress: null,
});

// `syncingLong`: the pass has been running for DRIVE_SYNCING_MARK_DELAY_MS, so
// the cheap start-token check never flashes the badge.
export function driveIndicator(
  status: DriveMirrorStatus,
  mode: DriveMode,
  syncingLong: boolean,
  now: number,
): DriveIndicator {
  if (mode === 'off' || status.state === 'starting' || status.state === 'disconnected') return NONE;
  const attention =
    status.state === 'needs_reconnect' ||
    status.state === 'needs_resume' ||
    status.error !== null ||
    status.notices.length > 0;
  if (attention) return same('attention', 'Google Drive needs attention');
  if (status.progress) {
    const words = `Copying ${status.progress.done} of ${status.progress.total} to Google Drive`;
    return { ...same('syncing', words), progress: status.progress };
  }
  if (status.state === 'syncing' && (syncingLong || status.lastSyncedAt === null)) {
    return same('syncing', 'Syncing with Google Drive');
  }
  if (status.lastSyncedAt !== null) {
    return {
      kind: 'synced',
      label: `Synced to Google Drive ${relativeSince(status.lastSyncedAt, now)}`,
      announce: 'Synced to Google Drive',
      progress: null,
    };
  }
  return NONE;
}
