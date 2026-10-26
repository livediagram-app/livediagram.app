// The Google Drive row's words in Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting": the
// statuses, the problem lines, layout stability). Pure, so every state is tested.
//
// The row keeps one size within each phase and reserves nothing for another (Layout stability, "reserve per phase,
// not per message"), so every wording here is listed per phase.
import { relativeSince } from '@liveworkspace/ui/relative-time';
import type { DriveConnectionAnswer } from '@liveworkspace/drive';

export type DriveConnected = Extract<DriveConnectionAnswer, { connected: true }>;

/** What the row knows of the connection: not read yet, read, or last read before the service stopped answering. */
export type DriveRowConnection =
  | { kind: 'checking' }
  | { kind: 'not_connected' }
  | { kind: 'connected'; connection: DriveConnected; unreachable?: boolean }
  // Not readable at all (offline before the first answer).
  | { kind: 'unreachable' };

/** Where a Connect stands: in flight, failed to start, or back from a cancel at Google. */
export type DriveConnectState = {
  connecting: boolean;
  connectError: string | null;
  cancelled: boolean;
  // Back from a finished consent: Connecting… (never Not connected) until the service reports.
  returned: boolean;
};

export const DRIVE_NOT_SYNCED_YET = 'Not synced yet';
export const DRIVE_CONNECT_FAILED = 'Couldn’t reach Google. Check your connection and try again.';
export const DRIVE_CONNECT_CANCELLED = 'Connection cancelled. Connect whenever you’re ready.';
export const DRIVE_OFFLINE = 'Can’t reach Google Drive. Trying again automatically.';
export const DRIVE_NEEDS_RECONNECT = 'Google Drive needs reconnecting. Your files are safe.';
export const DRIVE_NOTICE_TEXT = 'Moved to a Drive folder liveworkspace can’t see.';
export const DRIVE_NOT_CONNECTED_TEXT =
  'Your work from every app, copied to your Google Drive in matching folders. Renames, moves and deletions sync both ways. liveworkspace only sees files it created.';

export function driveConnectedText(rootName: string | null): string {
  return rootName
    ? `Your work is synced to “${rootName}” in Google Drive.`
    : 'Your work is synced to Google Drive.';
}

// The widest values the status's time realistically shows, so it keeps one width while connected.
const DRIVE_SINCE_SAMPLES = [
  'just now',
  '< 1 min ago',
  '59 mins ago',
  '23 hours ago',
  'yesterday',
  '30 days ago',
] as const;

// "just now" for the first 15 seconds, "< 1 min ago" until a minute has passed, then the usual wording. The row
// wakes exactly at those two moments (DRIVE_SINCE_STEPS_MS).
const DRIVE_JUST_NOW_MS = 15_000;
const DRIVE_UNDER_A_MINUTE_MS = 60_000;
export const DRIVE_SINCE_STEPS_MS = [DRIVE_JUST_NOW_MS, DRIVE_UNDER_A_MINUTE_MS] as const;

export function driveSince(at: number, now: number): string {
  const ago = now - at;
  if (ago < DRIVE_JUST_NOW_MS) return 'just now';
  if (ago < DRIVE_UNDER_A_MINUTE_MS) return '< 1 min ago';
  return relativeSince(at, now);
}

export type DriveSyncPhase = 'not-connected' | 'connected' | 'attention';

export function driveSyncPhase(row: DriveRowConnection): DriveSyncPhase {
  if (row.kind === 'connected') {
    return row.connection.status === 'needs_reconnect' ? 'attention' : 'connected';
  }
  return 'not-connected';
}

// The status at the card's top right: plain words, the warning colour and a glyph when something needs the person.
export type DriveStatusText = { text: string; warn: boolean };

const plain = (text: string): DriveStatusText => ({ text, warn: false });
const warn = (text: string): DriveStatusText => ({ text, warn: true });

const STATUS = {
  checking: plain('Checking…'),
  notConnected: plain('Not connected'),
  connecting: plain('Connecting…'),
  syncing: plain('Syncing…'),
  notSynced: plain(DRIVE_NOT_SYNCED_YET),
  offline: warn('Offline'),
  notice: warn('Needs attention'),
  reconnect: warn('Needs reconnecting'),
} as const;

const synced = (since: string) => plain(`Last synced ${since}`);
const copying = (p: { done: number; total: number }) => plain(`Copying ${p.done} of ${p.total}…`);

/** Every status a phase can show, times and counts at their widest: the status is always as wide as the widest of
 *  its phase. */
export function driveStatusOptions(
  row: DriveRowConnection,
  phase: DriveSyncPhase,
): DriveStatusText[] {
  switch (phase) {
    case 'not-connected':
      return [STATUS.checking, STATUS.notConnected, STATUS.connecting, STATUS.offline];
    case 'attention':
      return [STATUS.reconnect, STATUS.connecting];
    case 'connected': {
      const total = row.kind === 'connected' ? (row.connection.progress?.total ?? 0) : 0;
      return [
        ...DRIVE_SINCE_SAMPLES.map(synced),
        STATUS.notSynced,
        STATUS.syncing,
        copying({ done: total, total }),
        STATUS.offline,
        STATUS.notice,
      ];
    }
  }
}

export type DriveProblemAction = 'reconnect' | null;

/** The second line: only while something is wrong, with what to press. */
export type DriveProblem = { text: string; action: DriveProblemAction; failed?: true };

export type DriveSyncCopy = {
  phase: DriveSyncPhase;
  status: DriveStatusText;
  problem: DriveProblem | null;
};

/** Where the mirror stands: the status at the top right, and the problem line while something needs the person. */
export function driveSyncCopy(
  row: DriveRowConnection,
  connect: DriveConnectState,
  now: number,
): DriveSyncCopy {
  const phase = driveSyncPhase(row);
  const failed = !!connect.connectError && !connect.connecting;
  if (phase === 'not-connected') {
    const status =
      connect.connecting || (connect.returned && row.kind === 'checking')
        ? STATUS.connecting
        : row.kind === 'checking'
          ? STATUS.checking
          : row.kind === 'unreachable'
            ? STATUS.offline
            : STATUS.notConnected;
    const problem: DriveProblem | null = failed
      ? { text: connect.connectError!, action: null, failed: true }
      : row.kind === 'unreachable'
        ? { text: DRIVE_OFFLINE, action: null }
        : connect.cancelled && !connect.connecting
          ? { text: DRIVE_CONNECT_CANCELLED, action: null }
          : null;
    return { phase, status, problem };
  }
  if (phase === 'attention') {
    return {
      phase,
      status: connect.connecting ? STATUS.connecting : STATUS.reconnect,
      problem: failed
        ? { text: connect.connectError!, action: 'reconnect', failed: true }
        : { text: DRIVE_NEEDS_RECONNECT, action: 'reconnect' },
    };
  }
  const { connection, unreachable = false } = row as Extract<
    DriveRowConnection,
    { kind: 'connected' }
  >;
  // The service unreachable from here, or its last pass failed and the next will try again.
  const offline = unreachable || connection.status === 'error';
  const notice = connection.notices[0] ?? null;
  const status = offline
    ? STATUS.offline
    : connection.progress
      ? copying(connection.progress)
      : notice
        ? STATUS.notice
        : connection.syncing
          ? STATUS.syncing
          : connection.lastSyncedAt === null
            ? STATUS.notSynced
            : synced(driveSince(connection.lastSyncedAt, now));
  const more = Math.max(0, connection.notices.length - 1);
  const problem: DriveProblem | null = offline
    ? { text: DRIVE_OFFLINE, action: null }
    : notice
      ? {
          text: `${notice.name}${more > 0 ? ` and ${more} more` : ''}: ${DRIVE_NOTICE_TEXT}`,
          action: null,
        }
      : null;
  return { phase, status, problem };
}

/** Whether the row should read the connection again soon: a pass or a first copy is running, or the connection
 *  was only just made (the first pass hasn't reported). */
export function driveRowBusy(row: DriveRowConnection, connect: DriveConnectState): boolean {
  if (row.kind !== 'connected') return connect.returned && row.kind === 'not_connected';
  const { connection } = row;
  if (connection.status !== 'ok') return false;
  return connection.syncing || connection.progress !== null || connection.lastSyncedAt === null;
}
