import { describe, expect, it } from 'vitest';
import {
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';
import {
  driveConnectedText,
  driveStatusOptions,
  driveSyncCopy,
  driveSyncPhase,
  type DriveConnectState,
  type DriveStatusView,
} from './cloud-sync-copy';
import type { DriveMirrorStatus } from './engine';

// The Cloud Sync row's words (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"; blueprint "Cloud Sync in Settings"): one row with a status,
// and a problem line only while something needs the user.

const NOW = 10 * 60_000;
const status = (over: Partial<DriveMirrorStatus> = {}): DriveMirrorStatus => ({
  state: 'idle',
  lastSyncedAt: NOW,
  progress: null,
  error: null,
  leaseHeldElsewhere: false,
  notices: [],
  rootName: 'livediagram (staging)',
  mirrored: {},
  failed: [],
  rootFolderId: null,
  ...over,
});
const IDLE: DriveConnectState = { connecting: false, connectError: null, connectNote: null };
const VIEW: DriveStatusView = { now: NOW, syncingLong: false };
const copyOf = (
  over: Partial<DriveMirrorStatus>,
  connect: Partial<DriveConnectState> = {},
  view: Partial<DriveStatusView> = {},
) => driveSyncCopy(status(over), { ...IDLE, ...connect }, { ...VIEW, ...view });
const said = (...a: Parameters<typeof copyOf>) => copyOf(...a).status;
const problem = (...a: Parameters<typeof copyOf>) => copyOf(...a).problem;
const NOTICE = { kind: 'document' as const, ldId: 'd', name: 'Plan', parentId: 'p' };

describe('the description under the card, once connected', () => {
  it('says where the documents go', () => {
    expect(driveConnectedText('livediagram (staging)')).toBe(
      'Your documents are synced to “livediagram (staging)” in Google Drive.',
    );
    expect(driveConnectedText(null)).toBe('Your documents are synced to Google Drive.');
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
    expect(said({})).toEqual({ text: 'Last synced just now', warn: false });
    expect(said({ lastSyncedAt: NOW - 14_999 })).toEqual({
      text: 'Last synced just now',
      warn: false,
    });
    expect(said({ lastSyncedAt: NOW - 15_000 })).toEqual({
      text: 'Last synced < 1 min ago',
      warn: false,
    });
    expect(said({ lastSyncedAt: NOW - 59_999 })).toEqual({
      text: 'Last synced < 1 min ago',
      warn: false,
    });
    expect(said({ lastSyncedAt: NOW - 60_000 })).toEqual({
      text: 'Last synced 1 min ago',
      warn: false,
    });
    expect(said({ lastSyncedAt: NOW - 3 * 60_000 })).toEqual({
      text: 'Last synced 3 mins ago',
      warn: false,
    });
    expect(said({ state: 'syncing' })).toEqual({ text: 'Last synced just now', warn: false });
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
    expect(said({}, {}, { checking: true })).toEqual({ text: 'Checking…', warn: false });
  });

  it('warns, with words, when something needs the user', () => {
    expect(said({ error: 'offline' })).toEqual({ text: 'Offline', warn: true });
    expect(said({ notices: [NOTICE] })).toEqual({ text: 'Needs attention', warn: true });
    expect(said({ state: 'needs_reconnect' })).toEqual({ text: 'Needs reconnecting', warn: true });
    expect(said({ state: 'needs_resume' })).toEqual({ text: 'Paused', warn: true });
    expect(said({ error: 'rate_limited' })).toEqual({ text: 'Last synced just now', warn: false });
  });
});

describe('the problem line', () => {
  it('is absent while all is well', () => {
    expect(problem({ state: 'disconnected' })).toBeNull();
    expect(problem({ state: 'starting' })).toBeNull();
    expect(problem({})).toBeNull();
    expect(problem({ state: 'syncing', progress: { done: 1, total: 2 } })).toBeNull();
    expect(problem({ error: 'rate_limited' })).toBeNull();
    expect(problem({ leaseHeldElsewhere: true })).toBeNull();
  });

  it('says why Connect could not start, or that it was cancelled', () => {
    expect(problem({ state: 'disconnected' }, { connectError: 'x' })).toEqual({
      text: 'x',
      action: null,
      failed: true,
    });
    expect(problem({ state: 'disconnected' }, { connectNote: 'cancelled' })).toEqual({
      text: "Connection cancelled. Connect whenever you're ready.",
      action: null,
    });
    expect(
      problem({ state: 'disconnected' }, { connecting: true, connectNote: 'cancelled' }),
    ).toBeNull();
  });

  it('carries Reconnect or Resume when paused', () => {
    expect(problem({ state: 'needs_reconnect' })).toEqual({
      text: 'Google Drive needs reconnecting. Your files are safe.',
      action: 'reconnect',
    });
    expect(problem({ state: 'needs_resume' })).toEqual({
      text: 'Syncing paused in this browser. Resume to continue.',
      action: 'resume',
    });
  });

  it('says when Google Drive cannot be reached, and names the document a folder notice is about', () => {
    expect(problem({ error: 'offline' })).toEqual({
      text: "Can't reach Google Drive. Trying again automatically.",
      action: null,
    });
    expect(problem({ notices: [NOTICE, { ...NOTICE, ldId: 'e' }] })).toEqual({
      text: "Plan and 1 more: Moved to a Drive folder livediagram can't see.",
      action: 'showFolder',
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
    { notices: [NOTICE] },
    { lastSyncedAt: null },
    {},
  ];
  const connects: DriveConnectState[] = [IDLE, { ...IDLE, connecting: true }];

  it('only ever shows a status its phase reserves', () => {
    for (const over of states) {
      for (const connect of connects) {
        const s = status(over);
        const copy = driveSyncCopy(s, connect, VIEW);
        expect(copy.phase).toBe(driveSyncPhase(s));
        expect(driveStatusOptions(s, copy.phase).map((o) => o.text)).toContain(copy.status.text);
      }
    }
  });
});

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
