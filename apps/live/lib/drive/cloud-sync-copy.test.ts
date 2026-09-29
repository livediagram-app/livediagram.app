import { describe, expect, it } from 'vitest';
import {
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';
import {
  DRIVE_CONNECT_CANCELLED,
  DRIVE_CONNECT_FAILED,
  DRIVE_SYNC_BADGES,
  driveSyncTexts,
  driveRhythmText,
  driveSyncCopy,
  durationWords,
  lastSyncedText,
} from './cloud-sync-copy';
import type { DriveMirrorStatus } from './engine';

// The Cloud Sync row's words (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting";
// blueprint "Cloud Sync in Settings").

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
        `Edits are copied ${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop, at most once every ` +
        `${durationWords(DRIVE_WRITE_MIN_INTERVAL_MS)} per diagram.`,
    );
  });

  it('reads as the spec words it today', () => {
    expect(driveRhythmText()).toBe(
      'Checks for changes every 2 minutes while livediagram is open. Edits are copied a minute after you stop, at most once every 5 minutes per diagram.',
    );
  });
});

describe('lastSyncedText', () => {
  it('says when, or that it has not yet', () => {
    expect(lastSyncedText(null, 10)).toBe('Not synced yet');
    expect(lastSyncedText(1_000, 2_000)).toBe('Last synced just now');
    expect(lastSyncedText(0, 61_000)).toBe('Last synced 1 min ago');
  });
});

const IDLE = { connecting: false, connectError: null, connectNote: null };

describe('driveSyncCopy', () => {
  it('says Connecting from the press, and why it could not start if it failed', () => {
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...IDLE, connecting: true }),
    ).toMatchObject({ badge: 'Connecting', action: 'connect' });
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), {
        ...IDLE,
        connectError: 'Could not start.',
      }),
    ).toMatchObject({
      badge: 'Not connected',
      text: 'Could not start.',
      action: 'connect',
      failed: true,
    });
    // The failure takes the description's place, so nothing is added below it.
    expect(
      driveSyncCopy(status({ state: 'needs_reconnect' }), {
        ...IDLE,
        connectError: 'Could not start.',
      }),
    ).toMatchObject({ text: 'Could not start.', action: 'reconnect', failed: true });
  });

  it('lists every text the row can show now, so its text slot never changes height', () => {
    const s = status({ progress: { done: 3, total: 12 } });
    const texts = driveSyncTexts(s);
    for (const over of [
      { state: 'starting' as const },
      { state: 'disconnected' as const },
      { state: 'needs_reconnect' as const },
      { state: 'needs_resume' as const },
      { error: 'rate_limited' as const },
      { error: 'offline' as const },
      { leaseHeldElsewhere: true },
      { progress: null },
      {},
    ]) {
      expect(texts).toContain(driveSyncCopy(status({ ...s, ...over }), IDLE).text);
    }
    expect(texts).toContain(DRIVE_CONNECT_FAILED);
    expect(texts).toContain(DRIVE_CONNECT_CANCELLED);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('says calmly that the user cancelled at Google, until Connect is pressed again', () => {
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...IDLE, connectNote: 'cancelled' }),
    ).toMatchObject({ badge: 'Not connected', text: DRIVE_CONNECT_CANCELLED, action: 'connect' });
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), { ...IDLE, connectNote: 'cancelled' })
        .failed,
    ).toBeFalsy();
    expect(
      driveSyncCopy(status({ state: 'disconnected' }), {
        connecting: true,
        connectError: null,
        connectNote: 'cancelled',
      }).badge,
    ).toBe('Connecting');
  });

  it('only ever shows a badge from the one list the pill sizes itself to', () => {
    const states: Partial<DriveMirrorStatus>[] = [
      { state: 'starting' },
      { state: 'disconnected' },
      { state: 'needs_reconnect' },
      { state: 'syncing' },
      { state: 'syncing', progress: { done: 1, total: 2 } },
      { error: 'failed' },
      {},
    ];
    for (const over of states) {
      for (const connecting of [false, true]) {
        expect(DRIVE_SYNC_BADGES).toContain(
          driveSyncCopy(status(over), { ...IDLE, connecting }).badge,
        );
      }
    }
  });

  it('invites a connection, and says so while it starts', () => {
    expect(driveSyncCopy(status({ state: 'disconnected' }), IDLE)).toMatchObject({
      badge: 'Not connected',
      tone: 'off',
      action: 'connect',
    });
    expect(driveSyncCopy(status({ state: 'starting' }), IDLE)).toMatchObject({
      badge: 'Checking',
      action: null,
    });
  });

  it('names the actual root folder once connected', () => {
    expect(driveSyncCopy(status(), IDLE)).toMatchObject({
      badge: 'Synced',
      tone: 'ok',
      text: 'Your documents are copied to Google Drive, in the folder “livediagram (staging)”.',
      action: 'syncNow',
    });
    expect(driveSyncCopy(status({ rootName: null }), IDLE).text).toBe(
      'Your documents are copied to Google Drive.',
    );
    expect(driveSyncCopy(status({ state: 'syncing' }), IDLE)).toMatchObject({
      badge: 'Syncing',
      tone: 'busy',
    });
  });

  it('counts the first copy', () => {
    expect(
      driveSyncCopy(status({ state: 'syncing', progress: { done: 3, total: 12 } }), IDLE),
    ).toMatchObject({
      badge: 'Copying',
      text: 'Copying 3 of 12 to Google Drive.',
      action: null,
    });
  });

  it('says what to do in every attention state', () => {
    const cases: [Partial<DriveMirrorStatus>, string, string | null][] = [
      [{ state: 'needs_reconnect' }, 'Reconnect to carry on', 'reconnect'],
      [{ state: 'needs_resume' }, 'Resume to carry on', 'resume'],
      [{ error: 'rate_limited' }, 'there is nothing to do', null],
      [{ error: 'offline' }, 'check your connection, or press Sync now', 'syncNow'],
      [{ error: 'failed' }, 'check your connection, or press Sync now', 'syncNow'],
    ];
    for (const [over, words, action] of cases) {
      const copy = driveSyncCopy(status(over), IDLE);
      expect(copy.tone).toBe('attention');
      expect(copy.badge).toBe('Needs attention');
      expect(copy.text).toContain(words);
      expect(copy.action).toBe(action);
    }
  });

  it('says another tab or device is writing, with nothing to do', () => {
    expect(driveSyncCopy(status({ leaseHeldElsewhere: true }), IDLE).text).toBe(
      'Another tab or device is copying to Google Drive right now; this one keeps checking for changes.',
    );
  });

  it('flags notices', () => {
    expect(
      driveSyncCopy(
        status({ notices: [{ kind: 'diagram', ldId: 'd', name: 'Plan', parentId: 'p' }] }),
        IDLE,
      ),
    ).toMatchObject({ tone: 'attention', badge: 'Needs attention' });
  });
});

describe('the help article states the same rhythm', () => {
  it('words the cadence as the constants say', async () => {
    const { readFileSync } = await import('node:fs');
    const article = readFileSync(
      new URL('../../../help/app/account-and-data/google-drive/page.mdx', import.meta.url),
      'utf8',
    );
    expect(article).toContain(
      `checks Drive for changes every ${durationWords(DRIVE_POLL_INTERVAL_MS)}, and copies your edits ` +
        `${durationWords(DRIVE_WRITE_IDLE_MS)} after you stop, at most once every ` +
        `${durationWords(DRIVE_WRITE_MIN_INTERVAL_MS)} per diagram`,
    );
  });
});
