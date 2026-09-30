// The Google Drive row's words in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Pure, so every state is tested.
//
// The row keeps one size within each phase and reserves nothing for another
// phase (Layout stability, "reserve per phase, not per message"), so every
// wording here is listed per phase.

import { relativeSince } from '../relative-time';
import type { DriveMirrorStatus } from './engine';

export const DRIVE_NOT_SYNCED_YET = 'Not synced yet';

// The widest values the status's time realistically shows, so it keeps one
// width while connected.
export const DRIVE_SINCE_SAMPLES = [
  'just now',
  '59 mins ago',
  '23 hours ago',
  'yesterday',
  '30 days ago',
  DRIVE_NOT_SYNCED_YET,
] as const;

export const DRIVE_CONNECT_FAILED = "Couldn't reach Google. Check your connection and try again.";
export const DRIVE_CONNECT_CANCELLED = "Connection cancelled. Connect whenever you're ready.";
export const DRIVE_OFFLINE = "Can't reach Google Drive. Trying again automatically.";
export const DRIVE_NEEDS_RECONNECT = 'Google Drive needs reconnecting. Your files are safe.';
export const DRIVE_NEEDS_RESUME = 'Syncing paused in this browser. Resume to continue.';
export const DRIVE_NOTICE_TEXT = "Moved to a Drive folder livediagram can't see.";

export function driveConnectedText(rootName: string | null): string {
  return rootName
    ? `Your documents are synced to “${rootName}” in Google Drive.`
    : 'Your documents are synced to Google Drive.';
}

// How long ago the last sync was: "just now" for the whole first minute, so
// the status does not count seconds; the usual wording after that.
export const DRIVE_JUST_NOW_MS = 60_000;

export function driveSince(at: number, now: number): string {
  return now - at < DRIVE_JUST_NOW_MS ? 'just now' : relativeSince(at, now);
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
  plain(since === DRIVE_NOT_SYNCED_YET ? since : `Last synced ${since}`);
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
        DRIVE_STATUS.checking,
        copying({ done: total, total }),
        DRIVE_STATUS.offline,
        DRIVE_STATUS.notice,
      ];
    }
  }
}

// The problem line's action wordings, so it keeps one width while it shows.
// While connecting the button keeps its word and is held; the status says
// Connecting… (one place for the state, never two).
export const DRIVE_PROBLEM_LABELS = ['Reconnect', 'Resume'] as const;

export type DriveProblemAction = 'reconnect' | 'resume' | 'showFolder' | null;

// The second line: only while something is wrong, with what to press.
export type DriveProblem = { text: string; action: DriveProblemAction; failed?: true };

export type DriveSyncCopy = {
  phase: DriveSyncPhase;
  status: DriveStatusText;
  problem: DriveProblem | null;
};

// Where a Connect stands: in flight, failed to start, or cancelled at Google.
export type DriveConnectState = {
  connecting: boolean;
  connectError: string | null;
  connectNote: 'cancelled' | null;
};

// `syncingLong`: this pass has run long enough to say Syncing… (so the cheap
// 2-minute check never flickers it).
// `checking`: a check the row asked for is running.
export type DriveStatusView = { now: number; syncingLong: boolean; checking?: boolean };

// Where the mirror stands: the status at the top right, and the problem line,
// only while something needs the user.
export function driveSyncCopy(
  status: DriveMirrorStatus,
  connect: DriveConnectState,
  view: DriveStatusView,
): DriveSyncCopy {
  const phase = driveSyncPhase(status);
  const failed = !!connect.connectError && !connect.connecting;
  if (phase === 'not-connected') {
    const statusText =
      status.state === 'starting' && !connect.connecting
        ? DRIVE_STATUS.checking
        : connect.connecting
          ? DRIVE_STATUS.connecting
          : DRIVE_STATUS.notConnected;
    const problem: DriveProblem | null = failed
      ? { text: connect.connectError!, action: null, failed: true }
      : connect.connectNote === 'cancelled' && !connect.connecting
        ? { text: DRIVE_CONNECT_CANCELLED, action: null }
        : null;
    return { phase, status: statusText, problem };
  }
  if (phase === 'attention') {
    const reconnect = status.state === 'needs_reconnect';
    const action = reconnect ? ('reconnect' as const) : ('resume' as const);
    return {
      phase,
      status: connect.connecting
        ? DRIVE_STATUS.connecting
        : reconnect
          ? DRIVE_STATUS.reconnect
          : DRIVE_STATUS.paused,
      problem: failed
        ? { text: connect.connectError!, action, failed: true }
        : { text: reconnect ? DRIVE_NEEDS_RECONNECT : DRIVE_NEEDS_RESUME, action },
    };
  }
  const offline = status.error === 'offline' || status.error === 'failed';
  const since =
    status.lastSyncedAt === null ? DRIVE_NOT_SYNCED_YET : driveSince(status.lastSyncedAt, view.now);
  const notice = status.notices[0] ?? null;
  const statusText = offline
    ? DRIVE_STATUS.offline
    : status.progress
      ? copying(status.progress)
      : notice
        ? DRIVE_STATUS.notice
        : view.checking
          ? DRIVE_STATUS.checking
          : status.state === 'syncing' && (view.syncingLong || status.lastSyncedAt === null)
            ? DRIVE_STATUS.syncing
            : synced(since);
  const more = Math.max(0, status.notices.length - 1);
  const problem: DriveProblem | null = offline
    ? { text: DRIVE_OFFLINE, action: null }
    : notice
      ? {
          text: `${notice.name}${more > 0 ? ` and ${more} more` : ''}: ${DRIVE_NOTICE_TEXT}`,
          action: 'showFolder',
        }
      : null;
  return { phase, status: statusText, problem };
}
