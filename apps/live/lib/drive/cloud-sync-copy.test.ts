import { describe, expect, it } from 'vitest';
import {
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';
import {
  DRIVE_PHASE_BADGES,
  DRIVE_SINCE_SAMPLES,
  driveRhythmText,
  driveSyncCopy,
  driveSyncPhase,
  driveSyncTexts,
  durationWords,
  sinceText,
  type DriveConnectState,
} from './cloud-sync-copy';
import type { DriveMirrorStatus } from './engine';

// The Cloud Sync row's words, as approved (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"; blueprint "Cloud Sync in Settings").

const status = (over: Partial<DriveMirrorStatus> = {}): DriveMirrorStatus => ({
  state: 'idle',
  lastSyncedAt: 1,
  progress: null,
  error: null,
  leaseHeldElsewhere: false,
  notices: [],
  rootName: 'livediagram (staging)',
  ...over,
});
const IDLE: DriveConnectState = { connecting: false, connectError: null, connectNote: null };
const text = (over: Partial<DriveMirrorStatus>, connect: Partial<DriveConnectState> = {}) =>
  driveSyncCopy(status(over), { ...IDLE, ...connect }).text;

describe('durationWords', () => {
  it('words a cadence the way a person says it', () => {
    expect(durationWords(30_000)).toBe('30 seconds');
    expect(durationWords(60_000)).toBe('a minute');
    expect(durationWords(120_000)).toBe('2 minutes');
    expect(durationWords(5 * 60_000)).toBe('5 minutes');
    expect(durationWords(60 * 60_000)).toBe('an hour');
    expect(durationWords(90_000)).toBe('90 seconds');
  });
});

describe('driveRhythmText', () => {
  it('is built from the cadence constants, so it cannot drift', () => {
    expect(driveRhythmText()).toBe(
      `Checks for changes every ${durationWords(DRIVE_POLL_INTERVAL_MS)} while livediagram is open. ` +
        `Your edits are copied ${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop.`,
    );
  });

  it('reads as approved', () => {
    expect(driveRhythmText()).toBe(
      'Checks for changes every 2 minutes while livediagram is open. Your edits are copied a minute after you stop.',
    );
  });
});

describe('sinceText', () => {
  it('says how long ago, or that it has not synced yet', () => {
    expect(sinceText(null, 10)).toBe('Not synced yet');
    expect(sinceText(1_000, 2_000)).toBe('just now');
    expect(sinceText(0, 61_000)).toBe('1 min ago');
    expect(DRIVE_SINCE_SAMPLES).toContain('Not synced yet');
  });
});

describe('driveSyncCopy: the approved words', () => {
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
    expect(text({})).toBe('Copied to your Google Drive, in “livediagram (staging)”.');
    expect(text({ rootName: null })).toBe('Copied to your Google Drive.');
    expect(text({ state: 'syncing', progress: { done: 3, total: 12 } })).toBe(
      'Copying 3 of 12 documents…',
    );
    expect(text({ error: 'rate_limited' })).toBe(
      "Syncing a little slower for now, at Google's request.",
    );
    expect(text({ error: 'offline' })).toBe(
      "Can't reach Google Drive. Trying again automatically.",
    );
    expect(text({ error: 'failed' })).toBe("Can't reach Google Drive. Trying again automatically.");
    expect(text({ leaseHeldElsewhere: true })).toBe(
      'Another tab is syncing. This one stays up to date.',
    );
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

describe('driveSyncCopy: pill and action', () => {
  it('says Connecting from the press, and why it could not start if it failed', () => {
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...IDLE, connecting: true }),
    ).toMatchObject({
      badge: 'Connecting',
      action: 'connect',
    });
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...IDLE, connectError: 'Could not.' }),
    ).toMatchObject({ badge: 'Not connected', action: 'connect', failed: true });
    expect(
      driveSyncCopy(status({ state: 'needs_reconnect' }), { ...IDLE, connectError: 'Could not.' }),
    ).toMatchObject({ text: 'Could not.', action: 'reconnect', failed: true });
  });

  it('is calm about a cancel until Connect is pressed again', () => {
    const cancelled = { ...IDLE, connectNote: 'cancelled' as const };
    expect(driveSyncCopy(status({ state: 'disconnected' }), cancelled).failed).toBeUndefined();
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...cancelled, connecting: true }).text,
    ).toBe('Keep a copy of your documents in your Google Drive.');
  });

  it('counts the first copy, and flags errors and notices', () => {
    expect(driveSyncCopy(status({ progress: { done: 3, total: 12 } }), IDLE)).toMatchObject({
      badge: 'Copying',
      tone: 'busy',
    });
    expect(driveSyncCopy(status({ state: 'syncing' }), IDLE)).toMatchObject({ badge: 'Syncing' });
    for (const over of [
      { error: 'offline' as const },
      { notices: [{ kind: 'diagram' as const, ldId: 'd', name: 'Plan', parentId: 'p' }] },
    ]) {
      expect(driveSyncCopy(status(over), IDLE)).toMatchObject({
        tone: 'attention',
        badge: 'Needs attention',
        action: 'syncNow',
      });
    }
    expect(driveSyncCopy(status({ state: 'needs_resume' }), IDLE).action).toBe('resume');
  });
});

describe('phases (reserve per phase, not per message)', () => {
  const states: Partial<DriveMirrorStatus>[] = [
    { state: 'starting' },
    { state: 'disconnected' },
    { state: 'needs_reconnect' },
    { state: 'needs_resume' },
    { state: 'syncing' },
    { state: 'syncing', progress: { done: 1, total: 2 } },
    { error: 'failed' },
    { error: 'rate_limited' },
    { leaseHeldElsewhere: true },
    {},
  ];
  const connects: DriveConnectState[] = [
    IDLE,
    { ...IDLE, connecting: true },
    { ...IDLE, connectError: 'Could not.' },
    { ...IDLE, connectNote: 'cancelled' },
  ];

  it('shows only the pill wordings and texts its phase reserves', () => {
    for (const over of states) {
      for (const connect of connects) {
        const s = status({ progress: { done: 2, total: 2 }, ...over });
        const copy = driveSyncCopy(s, connect);
        expect(copy.phase).toBe(driveSyncPhase(s));
        expect(DRIVE_PHASE_BADGES[copy.phase] as readonly string[]).toContain(copy.badge);
        // A connect error is always DRIVE_CONNECT_FAILED in the app; the first
        // copy reserves its widest count (total of total).
        const reserved = copy.badge === 'Copying' ? 'Copying 2 of 2 documents…' : copy.text;
        if (!copy.failed) expect(driveSyncTexts(s, copy.phase)).toContain(reserved);
      }
    }
  });

  it('reserves nothing for another phase', () => {
    const s = status();
    expect(driveSyncTexts(s, 'not-connected')).not.toContain(driveSyncCopy(s, IDLE).text);
    expect(driveSyncTexts(s, 'connected')).not.toContain(
      'Keep a copy of your documents in your Google Drive.',
    );
  });
});

describe('the help article', () => {
  it('states the same rhythm and the per-document limit', async () => {
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
