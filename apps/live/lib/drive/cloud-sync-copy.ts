// The Google Drive row's words in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Pure, so every state is tested.
//
// The row keeps one size within each phase and reserves nothing for another
// phase (Layout stability, "reserve per phase, not per message"), so every
// wording here is listed per phase.

import { relativeSince } from '../relative-time';
import type { DriveMirrorStatus } from './engine';

// Under the connected line. The exact rhythm is in the help article.
export const DRIVE_RHYTHM = 'Syncs happen continuously while livediagram is open.';

export const DRIVE_NOT_SYNCED_YET = 'Not synced yet';

// The widest values the status's time realistically shows, so it keeps one
// width while connected.
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
    ? `Your documents are synced to “${rootName}” in Google Drive.`
    : 'Your documents are synced to Google Drive.';
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

// The status at the card's top right: plain words, the warning colour and a
// glyph when something needs the user.
export type DriveStatusText = { text: string; warn: boolean };

const plain = (text: string): DriveStatusText => ({ text, warn: false });
const warn = (text: string): DriveStatusText => ({ text, warn: true });

export const DRIVE_STATUS = {
  checking: plain('Checking…'),
  notConnected: plain('Not connected'),
  connecting: plain('Connecting…'),
  syncing: plain('Syncing…'),
  offline: warn('Offline'),
  notice: warn('Needs attention'),
  reconnect: warn('Needs reconnecting'),
  paused: warn('Paused'),
} as const;

const synced = (since: string): DriveStatusText =>
  plain(since === DRIVE_NOT_SYNCED_YET ? since : `Synced ${since}`);
const copying = (p: { done: number; total: number }) => plain(`Copying ${p.done} of ${p.total}…`);

// Every status a phase can show, times and counts at their widest: the status
// is always as wide as the widest of its phase.
export function driveStatusOptions(
  status: DriveMirrorStatus,
  phase: DriveSyncPhase,
): DriveStatusText[] {
  switch (phase) {
    case 'not-connected':
      return [DRIVE_STATUS.checking, DRIVE_STATUS.notConnected, DRIVE_STATUS.connecting];
    case 'attention':
      return [DRIVE_STATUS.reconnect, DRIVE_STATUS.paused, DRIVE_STATUS.connecting];
    case 'connected': {
      const total = status.progress?.total ?? 0;
      return [
        ...DRIVE_SINCE_SAMPLES.map(synced),
        DRIVE_STATUS.syncing,
        copying({ done: total, total }),
        DRIVE_STATUS.offline,
        DRIVE_STATUS.notice,
      ];
    }
  }
}

// The primary button's wordings per phase; connected has none (syncing is
// automatic), only Disconnect.
export const DRIVE_PHASE_PRIMARY = {
  'not-connected': ['Connect Google Drive', 'Connecting…'],
  connected: [],
  attention: ['Reconnect', 'Resume', 'Connecting…'],
} as const satisfies Record<DriveSyncPhase, readonly string[]>;

export type DriveSyncAction = 'connect' | 'reconnect' | 'resume' | null;

export type DriveSyncCopy = {
  phase: DriveSyncPhase;
  status: DriveStatusText;
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

// `syncingLong`: this pass has run long enough to say Syncing… (so the cheap
// 2-minute check never flickers it).
export type DriveStatusView = { now: number; syncingLong: boolean };

// Where the mirror stands, in plain words, and the one thing to press.
export function driveSyncCopy(
  status: DriveMirrorStatus,
  connect: DriveConnectState,
  view: DriveStatusView,
): DriveSyncCopy {
  const phase = driveSyncPhase(status);
  const failed = !!connect.connectError && !connect.connecting;
  if (phase === 'not-connected') {
    if (status.state === 'starting' && !connect.connecting) {
      return { phase, status: DRIVE_STATUS.checking, text: DRIVE_CHECKING, action: null };
    }
    const base = {
      phase,
      status: connect.connecting ? DRIVE_STATUS.connecting : DRIVE_STATUS.notConnected,
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
    const base = {
      phase,
      status: connect.connecting
        ? DRIVE_STATUS.connecting
        : reconnect
          ? DRIVE_STATUS.reconnect
          : DRIVE_STATUS.paused,
      action: reconnect ? ('reconnect' as const) : ('resume' as const),
    };
    if (failed) return { ...base, text: connect.connectError!, failed: true };
    return { ...base, text: reconnect ? DRIVE_NEEDS_RECONNECT : DRIVE_NEEDS_RESUME };
  }
  const offline = status.error === 'offline' || status.error === 'failed';
  const since =
    status.lastSyncedAt === null
      ? DRIVE_NOT_SYNCED_YET
      : relativeSince(status.lastSyncedAt, view.now);
  const statusText = offline
    ? DRIVE_STATUS.offline
    : status.progress
      ? copying(status.progress)
      : status.notices.length > 0
        ? DRIVE_STATUS.notice
        : status.state === 'syncing' && (view.syncingLong || status.lastSyncedAt === null)
          ? DRIVE_STATUS.syncing
          : synced(since);
  const text = offline
    ? DRIVE_OFFLINE
    : status.progress
      ? driveCopyingText(status.progress)
      : status.error === 'rate_limited'
        ? DRIVE_RATE_LIMITED
        : status.leaseHeldElsewhere
          ? DRIVE_LEASE_ELSEWHERE
          : driveConnectedText(status.rootName);
  return { phase, status: statusText, text, action: null };
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
