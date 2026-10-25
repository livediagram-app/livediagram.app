import { describe, expect, it } from 'vitest';
import {
  DRIVE_CONNECT_CANCELLED,
  DRIVE_NEEDS_RECONNECT,
  DRIVE_NOTICE_TEXT,
  DRIVE_OFFLINE,
  driveConnectedText,
  driveRowBusy,
  driveStatusOptions,
  driveSyncCopy,
  type DriveConnected,
  type DriveConnectState,
  type DriveRowConnection,
} from './cloud-sync-copy';

const NOW = 1_700_000_000_000;
const IDLE: DriveConnectState = { connecting: false, connectError: null, cancelled: false, returned: false };

const connection = (over: Partial<DriveConnected> = {}): DriveConnected => ({
  connected: true,
  status: 'ok',
  rootFolderName: 'liveworkspace',
  connectedAt: NOW - 86_400_000,
  lastSyncedAt: NOW - 3 * 60_000,
  syncing: false,
  progress: null,
  items: 12,
  notices: [],
  pendingSwitchUntil: null,
  ...over,
});
const connected = (over: Partial<DriveConnected> = {}): DriveRowConnection => ({
  kind: 'connected',
  connection: connection(over),
});
const status = (row: DriveRowConnection, connect: Partial<DriveConnectState> = {}) =>
  driveSyncCopy(row, { ...IDLE, ...connect }, NOW);

describe('Cloud Sync row: the status', () => {
  it('says Checking…, Not connected and Connecting… before a connection', () => {
    expect(status({ kind: 'checking' }).status.text).toBe('Checking…');
    expect(status({ kind: 'not_connected' }).status.text).toBe('Not connected');
    expect(status({ kind: 'not_connected' }, { connecting: true }).status.text).toBe('Connecting…');
    // Back from a finished consent: Connecting…, never Not connected, until the service reports.
    expect(status({ kind: 'checking' }, { returned: true }).status.text).toBe('Connecting…');
  });

  it('says when it last synced, and Not synced yet before the first', () => {
    expect(status(connected({ lastSyncedAt: NOW - 5_000 })).status.text).toBe('Last synced just now');
    expect(status(connected({ lastSyncedAt: NOW - 30_000 })).status.text).toBe('Last synced < 1 min ago');
    expect(status(connected()).status).toEqual({ text: 'Last synced 3 mins ago', warn: false });
    expect(status(connected({ lastSyncedAt: null })).status.text).toBe('Not synced yet');
  });

  it('says Syncing… and Copying n of m… while a pass runs', () => {
    expect(status(connected({ syncing: true })).status.text).toBe('Syncing…');
    expect(status(connected({ syncing: true, progress: { done: 3, total: 12 } })).status.text).toBe(
      'Copying 3 of 12…',
    );
  });

  it('warns, with what to press, for Needs reconnecting, Needs attention and Offline', () => {
    const reconnect = status(connected({ status: 'needs_reconnect' }));
    expect(reconnect).toMatchObject({
      phase: 'attention',
      status: { text: 'Needs reconnecting', warn: true },
      problem: { text: DRIVE_NEEDS_RECONNECT, action: 'reconnect' },
    });
    const notice = status(
      connected({
        notices: [
          { id: 'i1', app: 'liveplanner', kind: 'item', name: 'Roadmap' },
          { id: 'i2', app: 'livediagram', kind: 'item', name: 'Flow' },
        ],
      }),
    );
    expect(notice.status).toEqual({ text: 'Needs attention', warn: true });
    expect(notice.problem?.text).toBe(`Roadmap and 1 more: ${DRIVE_NOTICE_TEXT}`);
    expect(status(connected({ status: 'error' })).status).toEqual({ text: 'Offline', warn: true });
    expect(status({ ...connected(), unreachable: true } as DriveRowConnection).problem?.text).toBe(
      DRIVE_OFFLINE,
    );
    expect(status({ kind: 'unreachable' }).status.text).toBe('Offline');
  });

  it('says a cancel at Google calmly, and nothing for a plain not connected', () => {
    expect(status({ kind: 'not_connected' }, { cancelled: true }).problem).toEqual({
      text: DRIVE_CONNECT_CANCELLED,
      action: null,
    });
    expect(status({ kind: 'not_connected' }).problem).toBeNull();
    expect(status(connected()).problem).toBeNull();
  });

  it('keeps every wording of the phase among its options, so the width holds', () => {
    for (const row of [
      connected(),
      connected({ syncing: true, progress: { done: 3, total: 12 } }),
      connected({ lastSyncedAt: null }),
      connected({ status: 'error' }),
    ]) {
      const copy = status(row);
      const options = driveStatusOptions(row, copy.phase).map((o) => o.text);
      // A time or a count is held at its widest sample ("Copying 12 of 12…"); every other wording is listed as is.
      if (!/^(Last synced|Copying)/.test(copy.status.text)) expect(options).toContain(copy.status.text);
    }
    expect(
      driveStatusOptions(connected({ progress: { done: 3, total: 12 } }), 'connected').map((o) => o.text),
    ).toContain('Copying 12 of 12…');
    expect(driveStatusOptions({ kind: 'checking' }, 'not-connected').map((o) => o.text)).toEqual([
      'Checking…',
      'Not connected',
      'Connecting…',
      'Offline',
    ]);
  });

  it('names the root folder below the card once connected', () => {
    expect(driveConnectedText('liveworkspace (staging)')).toBe(
      'Your work is synced to “liveworkspace (staging)” in Google Drive.',
    );
  });
});

describe('Cloud Sync row: reading again', () => {
  it('only while a pass or a first copy runs, or a connection just made hasn’t shown', () => {
    expect(driveRowBusy(connected(), IDLE)).toBe(false);
    expect(driveRowBusy(connected({ syncing: true }), IDLE)).toBe(true);
    expect(driveRowBusy(connected({ lastSyncedAt: null }), IDLE)).toBe(true);
    // A failing pass is the service's to retry: the row doesn't keep asking.
    expect(driveRowBusy(connected({ status: 'error', syncing: true }), IDLE)).toBe(false);
    expect(driveRowBusy({ kind: 'not_connected' }, IDLE)).toBe(false);
    expect(driveRowBusy({ kind: 'not_connected' }, { ...IDLE, returned: true })).toBe(true);
  });
});
