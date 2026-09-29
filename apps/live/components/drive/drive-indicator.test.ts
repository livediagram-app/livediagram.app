import { describe, expect, it } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_STATUS_INITIAL } from './drive-mirror-context';
import { driveIndicator } from './drive-indicator';

// The avatar's sync mark (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance").

const status = (over: Partial<DriveMirrorStatus>): DriveMirrorStatus => ({
  ...DRIVE_STATUS_INITIAL,
  ...over,
});

describe('driveIndicator', () => {
  it('shows nothing when Drive is off, starting or not connected', () => {
    expect(driveIndicator(status({ state: 'idle', lastSyncedAt: 1 }), 'off', true).kind).toBe(
      'none',
    );
    expect(driveIndicator(status({ state: 'starting' }), 'broker', true).kind).toBe('none');
    expect(driveIndicator(status({ state: 'disconnected' }), 'broker', true).kind).toBe('none');
  });

  it('says synced after a clean pass', () => {
    expect(driveIndicator(status({ state: 'idle', lastSyncedAt: 1 }), 'broker', false)).toEqual({
      kind: 'synced',
      label: 'Google Drive synced',
      progress: null,
    });
  });

  it('says syncing only once a pass has lasted a moment, and always while copying', () => {
    expect(
      driveIndicator(status({ state: 'syncing', lastSyncedAt: 1 }), 'broker', false).kind,
    ).toBe('synced');
    expect(driveIndicator(status({ state: 'syncing' }), 'broker', true)).toEqual({
      kind: 'syncing',
      label: 'Google Drive syncing',
      progress: null,
    });
    expect(
      driveIndicator(
        status({ state: 'syncing', progress: { done: 3, total: 12 } }),
        'broker',
        false,
      ),
    ).toEqual({
      kind: 'syncing',
      label: 'Google Drive copying 3 of 12',
      progress: { done: 3, total: 12 },
    });
  });

  it('needs attention for a reconnect, a resume, an error, a notice or an unreadable copy', () => {
    for (const s of [
      status({ state: 'needs_reconnect' }),
      status({ state: 'needs_resume' }),
      status({ state: 'idle', error: 'failed', lastSyncedAt: 1 }),
      status({ state: 'idle', error: 'rate_limited', lastSyncedAt: 1 }),
      status({
        state: 'idle',
        lastSyncedAt: 1,
        notices: [{ kind: 'diagram', ldId: 'd', name: 'n', parentId: 'p' }],
      }),
      status({ state: 'idle', lastSyncedAt: 1, skipped: [{ name: 'n', reason: 'unreadable' }] }),
    ]) {
      expect(driveIndicator(s, 'broker', false)).toMatchObject({
        kind: 'attention',
        label: 'Google Drive needs attention',
      });
    }
  });
});
