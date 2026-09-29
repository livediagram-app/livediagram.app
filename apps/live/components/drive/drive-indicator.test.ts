import { describe, expect, it } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_STATUS_INITIAL } from './drive-mirror-context';
import { driveIndicator } from './drive-indicator';

// The avatar's cloud badge (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance").

const status = (over: Partial<DriveMirrorStatus>): DriveMirrorStatus => ({
  ...DRIVE_STATUS_INITIAL,
  ...over,
});
const NOW = 10 * 60_000;

describe('driveIndicator', () => {
  it('shows nothing when Drive is off, starting or not connected', () => {
    expect(driveIndicator(status({ state: 'idle', lastSyncedAt: 1 }), 'off', true, NOW).kind).toBe(
      'none',
    );
    expect(driveIndicator(status({ state: 'starting' }), 'broker', true, NOW).kind).toBe('none');
    expect(driveIndicator(status({ state: 'disconnected' }), 'broker', true, NOW).kind).toBe(
      'none',
    );
  });

  it('says when it last synced in the label, and only that it did in the announcement', () => {
    expect(
      driveIndicator(status({ state: 'idle', lastSyncedAt: NOW - 60_000 }), 'broker', false, NOW),
    ).toEqual({
      kind: 'synced',
      label: 'Synced to Google Drive 1 min ago',
      announce: 'Synced to Google Drive',
      progress: null,
    });
    expect(
      driveIndicator(status({ state: 'idle', lastSyncedAt: NOW }), 'broker', false, NOW).label,
    ).toBe('Synced to Google Drive just now');
  });

  it('says syncing only once a pass has lasted a moment, and always while copying', () => {
    expect(
      driveIndicator(status({ state: 'syncing', lastSyncedAt: 1 }), 'broker', false, NOW).kind,
    ).toBe('synced');
    expect(driveIndicator(status({ state: 'syncing' }), 'broker', true, NOW)).toEqual({
      kind: 'syncing',
      label: 'Syncing with Google Drive',
      announce: 'Syncing with Google Drive',
      progress: null,
    });
    expect(
      driveIndicator(
        status({ state: 'syncing', progress: { done: 3, total: 12 } }),
        'broker',
        false,
        NOW,
      ),
    ).toEqual({
      kind: 'syncing',
      label: 'Copying 3 of 12 to Google Drive',
      announce: 'Copying 3 of 12 to Google Drive',
      progress: { done: 3, total: 12 },
    });
  });

  it('asks for attention for every state that needs the user', () => {
    for (const s of [
      status({ state: 'needs_reconnect' }),
      status({ state: 'needs_resume' }),
      status({ state: 'idle', error: 'failed', lastSyncedAt: 1 }),
      status({ state: 'idle', error: 'rate_limited', lastSyncedAt: 1 }),
      status({ state: 'idle', error: 'offline', lastSyncedAt: 1 }),
      status({
        state: 'idle',
        lastSyncedAt: 1,
        notices: [{ kind: 'diagram', ldId: 'd', name: 'n', parentId: 'p' }],
      }),
    ]) {
      expect(driveIndicator(s, 'broker', false, NOW)).toMatchObject({
        kind: 'attention',
        label: 'Google Drive needs attention',
      });
    }
  });
});
