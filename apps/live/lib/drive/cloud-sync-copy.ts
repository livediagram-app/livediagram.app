// The Google Drive row's words in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Pure, so every state is tested; the rhythm is derived from the
// cadence constants so the words cannot drift from what the engine does.

import { relativeSince } from '../relative-time';
import {
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';
import type { DriveMirrorStatus } from './engine';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// A cadence as a person says it: "30 seconds", "a minute", "2 minutes".
export function durationWords(ms: number): string {
  if (ms % HOUR === 0) return ms === HOUR ? 'an hour' : `${ms / HOUR} hours`;
  if (ms % MINUTE === 0) return ms === MINUTE ? 'a minute' : `${ms / MINUTE} minutes`;
  const seconds = Math.round(ms / SECOND);
  return seconds === 1 ? 'a second' : `${seconds} seconds`;
}

export function driveRhythmText(): string {
  return (
    `Checks for changes every ${durationWords(DRIVE_POLL_INTERVAL_MS)} while livediagram is open. ` +
    `Edits are copied ${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop, at most once every ` +
    `${durationWords(DRIVE_WRITE_MIN_INTERVAL_MS)} per diagram.`
  );
}

export function lastSyncedText(at: number | null, now: number): string {
  return at === null ? 'Not synced yet' : `Last synced ${relativeSince(at, now)}`;
}

export const DRIVE_CONNECT_FAILED =
  "Couldn't start connecting to Google Drive. Check your connection and try again.";
export const DRIVE_CONNECT_CANCELLED =
  "You cancelled at Google, so Google Drive isn't connected. Connect again whenever you like.";

// Every wording the row's primary button can show: it is as wide as the longest.
export const DRIVE_PRIMARY_LABELS = [
  'Connect Google Drive',
  'Connecting…',
  'Reconnect',
  'Resume sync',
  'Sync now',
  'Syncing…',
] as const;

// Every wording the state pill can show: it is always as wide as the longest.
export const DRIVE_SYNC_BADGES = [
  'Checking',
  'Not connected',
  'Connecting',
  'Synced',
  'Syncing',
  'Copying',
  'Needs attention',
] as const;
export type DriveSyncBadge = (typeof DRIVE_SYNC_BADGES)[number];

export type DriveSyncTone = 'off' | 'ok' | 'busy' | 'attention';
export type DriveSyncAction = 'connect' | 'reconnect' | 'resume' | 'syncNow' | null;

export type DriveSyncCopy = {
  badge: DriveSyncBadge;
  tone: DriveSyncTone;
  text: string;
  action: DriveSyncAction;
  // The text is why the last Connect could not start.
  failed?: true;
};

const attention = (text: string, action: DriveSyncAction): DriveSyncCopy => ({
  badge: 'Needs attention',
  tone: 'attention',
  text,
  action,
});

// Where the mirror stands, in plain words, and the one thing to press.
// Notices are listed by the row itself, each with its own action.
// Where a Connect stands: in flight, failed to start, or cancelled at Google.
export type DriveConnectState = {
  connecting: boolean;
  connectError: string | null;
  connectNote: 'cancelled' | null;
};

export function driveSyncCopy(
  status: DriveMirrorStatus,
  connect: DriveConnectState,
): DriveSyncCopy {
  switch (status.state) {
    case 'starting':
      return {
        badge: 'Checking',
        tone: 'off',
        text: 'Checking your Google Drive connection…',
        action: null,
      };
    case 'disconnected':
      if (connect.connectError && !connect.connecting) {
        return {
          badge: 'Not connected',
          tone: 'off',
          text: connect.connectError,
          action: 'connect',
          failed: true,
        };
      }
      if (connect.connectNote === 'cancelled' && !connect.connecting) {
        return {
          badge: 'Not connected',
          tone: 'off',
          text: DRIVE_CONNECT_CANCELLED,
          action: 'connect',
        };
      }
      return {
        badge: connect.connecting ? 'Connecting' : 'Not connected',
        tone: 'off',
        text: 'Keep a copy of your documents in your own Google Drive, in folders that match yours, updated while livediagram is open.',
        action: 'connect',
      };
    case 'needs_reconnect':
      if (connect.connectError && !connect.connecting) {
        return { ...attention(connect.connectError, 'reconnect'), failed: true };
      }
      return attention(
        "Google Drive stopped accepting livediagram's access, so syncing is paused. Nothing was deleted. Reconnect to carry on.",
        'reconnect',
      );
    case 'needs_resume':
      return attention(
        'Drive access has lapsed in this browser. Resume to carry on syncing.',
        'resume',
      );
  }
  if (status.progress) {
    return {
      badge: 'Copying',
      tone: 'busy',
      text: `Copying ${status.progress.done} of ${status.progress.total} to Google Drive.`,
      action: null,
    };
  }
  if (status.error === 'rate_limited') {
    return attention(
      'Google asked livediagram to slow down. Syncing carries on less often for a while; there is nothing to do.',
      null,
    );
  }
  if (status.error === 'offline' || status.error === 'failed') {
    return attention(
      "Couldn't reach Google Drive. livediagram tries again by itself; check your connection, or press Sync now.",
      'syncNow',
    );
  }
  const syncing = status.state === 'syncing';
  const tone: DriveSyncTone = status.notices.length > 0 ? 'attention' : syncing ? 'busy' : 'ok';
  const badge = tone === 'attention' ? 'Needs attention' : syncing ? 'Syncing' : 'Synced';
  if (status.leaseHeldElsewhere) {
    return {
      badge,
      tone,
      text: 'Another tab or device is copying to Google Drive right now; this one keeps checking for changes.',
      action: 'syncNow',
    };
  }
  return {
    badge,
    tone,
    text: status.rootName
      ? `Your documents are copied to Google Drive, in the folder “${status.rootName}”.`
      : 'Your documents are copied to Google Drive.',
    action: 'syncNow',
  };
}

const QUIET: DriveConnectState = { connecting: false, connectError: null, connectNote: null };

// Every text the row can show for this root name and progress: the text slot
// lays them all out, so it is always as tall as the longest and no state
// change moves what sits below it (Layout stability).
export function driveSyncTexts(status: DriveMirrorStatus): string[] {
  const at = (over: Partial<DriveMirrorStatus>) =>
    driveSyncCopy(
      { ...status, error: null, leaseHeldElsewhere: false, notices: [], ...over },
      QUIET,
    ).text;
  const texts = [
    at({ state: 'starting' }),
    at({ state: 'disconnected' }),
    DRIVE_CONNECT_FAILED,
    DRIVE_CONNECT_CANCELLED,
    at({ state: 'needs_reconnect' }),
    at({ state: 'needs_resume' }),
    at({ state: 'idle', progress: status.progress ?? { done: 0, total: 0 } }),
    at({ state: 'idle', progress: null, error: 'rate_limited' }),
    at({ state: 'idle', progress: null, error: 'offline' }),
    at({ state: 'idle', progress: null, leaseHeldElsewhere: true }),
    at({ state: 'idle', progress: null }),
  ];
  return [...new Set(texts)];
}
