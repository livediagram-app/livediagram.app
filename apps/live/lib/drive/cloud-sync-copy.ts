// The Google Drive row's words in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Pure, so every state is tested; the rhythm is derived from the
// cadence constants so the words cannot drift from what the engine does.
//
// The row keeps one size within each phase and reserves nothing for another
// phase (Layout stability, "reserve per phase, not per message"), so every
// wording here is listed per phase.

import { relativeSince } from '../relative-time';
import { DRIVE_POLL_INTERVAL_MS, DRIVE_WRITE_IDLE_MS } from './cadence';
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
    `Your edits are copied ${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop.`
  );
}

// Beside the pill: "1 min ago", or "Not synced yet".
export function sinceText(at: number | null, now: number): string {
  return at === null ? DRIVE_NOT_SYNCED_YET : relativeSince(at, now);
}

export const DRIVE_NOT_SYNCED_YET = 'Not synced yet';

// The widest values the time beside the pill realistically shows, so it
// keeps one width while connected.
export const DRIVE_SINCE_SAMPLES = [
  'just now',
  '59 secs ago',
  '59 mins ago',
  '23 hours ago',
  'yesterday',
  '30 days ago',
  DRIVE_NOT_SYNCED_YET,
] as const;

export const DRIVE_INTRO = 'Keep a copy of your documents in your Google Drive.';
export const DRIVE_CHECKING = 'Checking Google Drive…';
export const DRIVE_CONNECT_FAILED = "Couldn't reach Google. Check your connection and try again.";
export const DRIVE_CONNECT_CANCELLED = "Connection cancelled. Connect whenever you're ready.";
export const DRIVE_RATE_LIMITED = "Syncing a little slower for now, at Google's request.";
export const DRIVE_OFFLINE = "Can't reach Google Drive. Trying again automatically.";
export const DRIVE_LEASE_ELSEWHERE = 'Another tab is syncing. This one stays up to date.';
export const DRIVE_NEEDS_RECONNECT = 'Google Drive needs reconnecting. Your files are safe.';
export const DRIVE_NEEDS_RESUME = 'Syncing paused in this browser. Resume to continue.';
export const DRIVE_NOTICE_TEXT = "Moved to a Drive folder livediagram can't see.";

export function driveConnectedText(rootName: string | null): string {
  return rootName
    ? `Copied to your Google Drive, in “${rootName}”.`
    : 'Copied to your Google Drive.';
}

export function driveCopyingText(progress: { done: number; total: number }): string {
  return `Copying ${progress.done} of ${progress.total} documents…`;
}

export type DriveSyncPhase = 'not-connected' | 'connected' | 'attention';

export function driveSyncPhase(status: DriveMirrorStatus): DriveSyncPhase {
  switch (status.state) {
    case 'starting':
    case 'disconnected':
      return 'not-connected';
    case 'needs_reconnect':
    case 'needs_resume':
      return 'attention';
    default:
      return 'connected';
  }
}

// The pill's wordings per phase: it is as wide as the longest of its phase.
export const DRIVE_PHASE_BADGES = {
  'not-connected': ['Checking', 'Not connected', 'Connecting'],
  connected: ['Synced', 'Syncing', 'Copying', 'Needs attention'],
  attention: ['Needs attention'],
} as const satisfies Record<DriveSyncPhase, readonly string[]>;

export type DriveSyncBadge = (typeof DRIVE_PHASE_BADGES)[DriveSyncPhase][number];

// The primary button's wordings per phase.
export const DRIVE_PHASE_PRIMARY = {
  'not-connected': ['Connect Google Drive', 'Connecting…'],
  connected: ['Sync now', 'Syncing…'],
  attention: ['Reconnect', 'Resume sync', 'Connecting…'],
} as const satisfies Record<DriveSyncPhase, readonly string[]>;

export type DriveSyncTone = 'off' | 'ok' | 'busy' | 'attention';
export type DriveSyncAction = 'connect' | 'reconnect' | 'resume' | 'syncNow' | null;

export type DriveSyncCopy = {
  phase: DriveSyncPhase;
  badge: DriveSyncBadge;
  tone: DriveSyncTone;
  text: string;
  action: DriveSyncAction;
  // The text is why the last Connect could not start.
  failed?: true;
};

// Where a Connect stands: in flight, failed to start, or cancelled at Google.
export type DriveConnectState = {
  connecting: boolean;
  connectError: string | null;
  connectNote: 'cancelled' | null;
};

// Where the mirror stands, in plain words, and the one thing to press.
export function driveSyncCopy(
  status: DriveMirrorStatus,
  connect: DriveConnectState,
): DriveSyncCopy {
  const phase = driveSyncPhase(status);
  const failed = !!connect.connectError && !connect.connecting;
  if (phase === 'not-connected') {
    if (status.state === 'starting' && !connect.connecting) {
      return { phase, badge: 'Checking', tone: 'off', text: DRIVE_CHECKING, action: null };
    }
    const base = {
      phase,
      badge: connect.connecting ? ('Connecting' as const) : ('Not connected' as const),
      tone: 'off' as const,
      action: 'connect' as const,
    };
    if (failed) return { ...base, text: connect.connectError!, failed: true };
    if (connect.connectNote === 'cancelled' && !connect.connecting) {
      return { ...base, text: DRIVE_CONNECT_CANCELLED };
    }
    return { ...base, text: DRIVE_INTRO };
  }
  if (phase === 'attention') {
    const reconnect = status.state === 'needs_reconnect';
    const action = reconnect ? 'reconnect' : 'resume';
    const base = {
      phase,
      badge: 'Needs attention' as const,
      tone: 'attention' as const,
      action,
    } as const;
    if (failed) return { ...base, text: connect.connectError!, failed: true };
    return { ...base, text: reconnect ? DRIVE_NEEDS_RECONNECT : DRIVE_NEEDS_RESUME };
  }
  if (status.progress) {
    return {
      phase,
      badge: 'Copying',
      tone: 'busy',
      text: driveCopyingText(status.progress),
      action: 'syncNow',
    };
  }
  const attention = status.error !== null || status.notices.length > 0;
  const syncing = status.state === 'syncing';
  const tone: DriveSyncTone = attention ? 'attention' : syncing ? 'busy' : 'ok';
  const badge: DriveSyncBadge = attention ? 'Needs attention' : syncing ? 'Syncing' : 'Synced';
  const text =
    status.error === 'rate_limited'
      ? DRIVE_RATE_LIMITED
      : status.error === 'offline' || status.error === 'failed'
        ? DRIVE_OFFLINE
        : status.leaseHeldElsewhere
          ? DRIVE_LEASE_ELSEWHERE
          : driveConnectedText(status.rootName);
  return { phase, badge, tone, text, action: 'syncNow' };
}

// Every text the row's line can show in this phase, for this root name and
// progress: the line lays them all out, so it keeps one height within the
// phase and reserves nothing for another.
export function driveSyncTexts(status: DriveMirrorStatus, phase: DriveSyncPhase): string[] {
  switch (phase) {
    case 'not-connected':
      return [DRIVE_INTRO, DRIVE_CHECKING, DRIVE_CONNECT_FAILED, DRIVE_CONNECT_CANCELLED];
    case 'attention':
      return [DRIVE_NEEDS_RECONNECT, DRIVE_NEEDS_RESUME, DRIVE_CONNECT_FAILED];
    case 'connected': {
      const total = status.progress?.total ?? 0;
      return [
        driveConnectedText(status.rootName),
        driveCopyingText({ done: total, total }),
        DRIVE_RATE_LIMITED,
        DRIVE_OFFLINE,
        DRIVE_LEASE_ELSEWHERE,
      ];
    }
  }
}
