import { describe, expect, it } from 'vitest';
import {
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';
import {
  DRIVE_RHYTHM,
  driveStatusOptions,
  driveSyncCopy,
  driveSyncPhase,
  driveSyncTexts,
  type DriveConnectState,
  type DriveStatusView,
} from './cloud-sync-copy';
import type { DriveMirrorStatus } from './engine';

// The Cloud Sync row's words, as approved (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"; blueprint "Cloud Sync in Settings").

const NOW = 10 * 60_000;
const status = (over: Partial<DriveMirrorStatus> = {}): DriveMirrorStatus => ({
  state: 'idle',
  lastSyncedAt: NOW,
  progress: null,
  error: null,
  leaseHeldElsewhere: false,
  notices: [],
  rootName: 'livediagram (staging)',
  ...over,
});
const IDLE: DriveConnectState = { connecting: false, connectError: null, connectNote: null };
const VIEW: DriveStatusView = { now: NOW, syncingLong: false };
const copyOf = (
  over: Partial<DriveMirrorStatus>,
  connect: Partial<DriveConnectState> = {},
  view: Partial<DriveStatusView> = {},
) => driveSyncCopy(status(over), { ...IDLE, ...connect }, { ...VIEW, ...view });
const text = (...a: Parameters<typeof copyOf>) => copyOf(...a).text;
const said = (...a: Parameters<typeof copyOf>) => copyOf(...a).status;

describe('the approved lines', () => {
  it('not connected', () => {
    expect(text({ state: 'disconnected' })).toBe(
      'Keep a copy of your documents in your Google Drive.',
    );
    expect(text({ state: 'starting' })).toBe('Checking Google Drive…');
    expect(text({ state: 'disconnected' }, { connectError: 'x' })).toBe('x');
    expect(text({ state: 'disconnected' }, { connectNote: 'cancelled' })).toBe(
      "Connection cancelled. Connect whenever you're ready.",
    );
  });

  it('connected', () => {
    expect(text({})).toBe('Your documents are synced to “livediagram (staging)” in Google Drive.');
    expect(text({ rootName: null })).toBe('Your documents are synced to Google Drive.');
    expect(text({ state: 'syncing', progress: { done: 3, total: 12 } })).toBe(
      'Copying 3 of 12 documents…',
    );
    expect(text({ error: 'rate_limited' })).toBe(
      "Syncing a little slower for now, at Google's request.",
    );
    expect(text({ error: 'offline' })).toBe(
      "Can't reach Google Drive. Trying again automatically.",
    );
    expect(text({ leaseHeldElsewhere: true })).toBe(
      'Another tab is syncing. This one stays up to date.',
    );
    expect(DRIVE_RHYTHM).toBe('Syncs happen continuously while livediagram is open.');
  });

  it('needs attention', () => {
    expect(text({ state: 'needs_reconnect' })).toBe(
      'Google Drive needs reconnecting. Your files are safe.',
    );
    expect(text({ state: 'needs_resume' })).toBe(
      'Syncing paused in this browser. Resume to continue.',
    );
  });
});

describe('the status at the top right', () => {
  it('says where the connection stands', () => {
    expect(said({ state: 'starting' })).toEqual({ text: 'Checking…', warn: false });
    expect(said({ state: 'disconnected' })).toEqual({ text: 'Not connected', warn: false });
    expect(said({ state: 'disconnected' }, { connecting: true })).toEqual({
      text: 'Connecting…',
      warn: false,
    });
  });

  it('says when it last synced, and Syncing only once a pass has lasted a moment', () => {
    expect(said({})).toEqual({ text: 'Synced just now', warn: false });
    expect(said({ lastSyncedAt: NOW - 3 * 60_000 })).toEqual({
      text: 'Synced 3 mins ago',
      warn: false,
    });
    expect(said({ state: 'syncing' })).toEqual({ text: 'Synced just now', warn: false });
    expect(said({ state: 'syncing' }, {}, { syncingLong: true })).toEqual({
      text: 'Syncing…',
      warn: false,
    });
    expect(said({ state: 'syncing', lastSyncedAt: null })).toEqual({
      text: 'Syncing…',
      warn: false,
    });
    expect(said({ lastSyncedAt: null })).toEqual({ text: 'Not synced yet', warn: false });
    expect(said({ state: 'syncing', progress: { done: 3, total: 12 } })).toEqual({
      text: 'Copying 3 of 12…',
      warn: false,
    });
  });

  it('says Checking while a check the row asked for runs', () => {
    expect(said({}, {}, { checking: true })).toEqual({ text: 'Checking…', warn: false });
    expect(said({ state: 'syncing' }, {}, { checking: true, syncingLong: true })).toEqual({
      text: 'Checking…',
      warn: false,
    });
  });

  it('warns, with words, when something needs the user', () => {
    expect(said({ error: 'offline' })).toEqual({ text: 'Offline', warn: true });
    expect(
      said({ notices: [{ kind: 'document', ldId: 'd', name: 'Plan', parentId: 'p' }] }),
    ).toEqual({ text: 'Needs attention', warn: true });
    expect(said({ state: 'needs_reconnect' })).toEqual({ text: 'Needs reconnecting', warn: true });
    expect(said({ state: 'needs_resume' })).toEqual({ text: 'Paused', warn: true });
    // Rate-limited carries on: its line explains, the status stays calm.
    expect(said({ error: 'rate_limited' })).toEqual({ text: 'Synced just now', warn: false });
  });
});

describe('buttons', () => {
  it('Connect when not connected, none but Disconnect when connected, Reconnect or Resume when paused', () => {
    expect(copyOf({ state: 'disconnected' }).action).toBe('connect');
    expect(copyOf({}).action).toBeNull();
    expect(copyOf({ state: 'needs_reconnect' }).action).toBe('reconnect');
    expect(copyOf({ state: 'needs_resume' }).action).toBe('resume');
    expect(copyOf({ state: 'needs_reconnect' }, { connectError: 'Could not.' })).toMatchObject({
      text: 'Could not.',
      failed: true,
    });
  });
});

describe('phases (reserve per phase, not per message)', () => {
  const states: Partial<DriveMirrorStatus>[] = [
    { state: 'starting' },
    { state: 'disconnected' },
    { state: 'needs_reconnect' },
    { state: 'needs_resume' },
    { state: 'syncing' },
    { state: 'syncing', progress: { done: 2, total: 2 } },
    { error: 'failed' },
    { error: 'rate_limited' },
    { leaseHeldElsewhere: true },
    { notices: [{ kind: 'document', ldId: 'd', name: 'Plan', parentId: 'p' }] },
    { lastSyncedAt: null },
    {},
  ];
  const connects: DriveConnectState[] = [
    IDLE,
    { ...IDLE, connecting: true },
    { ...IDLE, connectNote: 'cancelled' },
  ];

  it('shows only statuses and texts its phase reserves', () => {
    for (const over of states) {
      for (const connect of connects) {
        const views: [boolean, boolean][] = [
          [false, false],
          [true, false],
          [false, true],
        ];
        for (const [syncingLong, checking] of views) {
          const s = status({ progress: null, ...over });
          const copy = driveSyncCopy(s, connect, { now: NOW, syncingLong, checking });
          expect(copy.phase).toBe(driveSyncPhase(s));
          expect(driveStatusOptions(s, copy.phase)).toContainEqual(copy.status);
          expect(driveSyncTexts(s, copy.phase)).toContain(copy.text);
        }
      }
    }
  });

  it('reserves nothing for another phase', () => {
    const s = status();
    expect(driveSyncTexts(s, 'connected')).not.toContain(
      'Keep a copy of your documents in your Google Drive.',
    );
    expect(driveStatusOptions(s, 'connected')).not.toContainEqual({
      text: 'Not connected',
      warn: false,
    });
  });
});

// The help article states the exact rhythm the row no longer spells out.
function durationWords(ms: number): string {
  const minutes = ms / 60_000;
  return minutes === 1 ? 'a minute' : `${minutes} minutes`;
}

describe('the help article', () => {
  it('states the rhythm and the per-document limit as the constants say', async () => {
    const { readFileSync } = await import('node:fs');
    const article = readFileSync(
      new URL('../../../help/app/account-and-data/google-drive/page.mdx', import.meta.url),
      'utf8',
    );
    expect(article).toContain(
      `checks for changes every ${durationWords(DRIVE_POLL_INTERVAL_MS)} while livediagram is open`,
    );
    expect(article).toContain(
      `${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop, at most once every ` +
        `${durationWords(DRIVE_WRITE_MIN_INTERVAL_MS)} per document`,
    );
  });
});
