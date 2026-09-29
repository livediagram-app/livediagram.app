// @vitest-environment jsdom

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { driveRhythmText } from '@/lib/drive/cloud-sync-copy';
import {
  SETTINGS_CATEGORIES,
  type SettingsCloudSyncRowSpec,
} from '@/components/dialogs/settings/settings-catalogue';
import {
  DRIVE_MIRROR_OFF,
  DRIVE_STATUS_INITIAL,
  DriveMirrorContext,
  type DriveMirrorContextValue,
} from './drive-mirror-context';
import { GoogleDriveSyncRow } from './GoogleDriveSyncRow';

afterEach(cleanup);

const ROW = SETTINGS_CATEGORIES.flatMap((c) => c.rows).find(
  (r) => r.kind === 'cloudSync',
) as SettingsCloudSyncRowSpec;

function show(status: Partial<DriveMirrorStatus>, over: Partial<DriveMirrorContextValue> = {}) {
  const value: DriveMirrorContextValue = {
    ...DRIVE_MIRROR_OFF,
    mode: 'broker',
    connect: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    syncNow: vi.fn(),
    disconnect: vi.fn(async () => {}),
    adopt: vi.fn(async () => {}),
    ...over,
    status: { ...DRIVE_STATUS_INITIAL, rootName: 'livediagram (staging)', ...status },
  };
  render(
    <DriveMirrorContext.Provider value={value}>
      <GoogleDriveSyncRow row={ROW} />
    </DriveMirrorContext.Provider>,
  );
  return value;
}

describe('GoogleDriveSyncRow', () => {
  it('offers Connect when not connected, and says it is connecting', async () => {
    let finish = () => {};
    const connect = vi.fn(() => new Promise<void>((r) => (finish = r)));
    show({ state: 'disconnected' }, { connect });
    expect(screen.getByText('Not connected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));
    expect(connect).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Connecting…' })).toBeTruthy();
    finish();
  });

  it('names the folder, the rhythm and the last sync, with Sync now and Disconnect', () => {
    const value = show({ state: 'idle', lastSyncedAt: Date.now() });
    expect(
      screen.getByText(
        'Your documents are copied to Google Drive, in the folder “livediagram (staging)”.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(driveRhythmText())).toBeTruthy();
    expect(screen.getByText('Last synced just now')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(value.syncNow).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('shows the first copy with a progress bar', () => {
    show({ state: 'syncing', progress: { done: 3, total: 12 } });
    expect(screen.getByText('Copying 3 of 12 to Google Drive.')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByRole('button', { name: 'Syncing…' })).toHaveProperty('disabled', true);
  });

  it('offers Reconnect and Resume sync when paused', () => {
    const value = show({ state: 'needs_reconnect' });
    expect(screen.getByText('Needs attention')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(value.connect).toHaveBeenCalledOnce();
    cleanup();
    const next = show({ state: 'needs_resume' });
    fireEvent.click(screen.getByRole('button', { name: 'Resume sync' }));
    expect(next.resume).toHaveBeenCalledOnce();
  });

  it('lists each folder notice with Show this folder', () => {
    const notice = { kind: 'diagram' as const, ldId: 'd1', name: 'Plan', parentId: 'p' };
    const value = show({ state: 'idle', lastSyncedAt: 1, notices: [notice] }, { canAdopt: true });
    fireEvent.click(screen.getByRole('button', { name: 'Show this folder to livediagram' }));
    expect(value.adopt).toHaveBeenCalledWith(notice);
  });

  it('links to the help article', () => {
    show({ state: 'disconnected' });
    expect(
      screen.getAllByRole('link').some((a) => a.getAttribute('href')?.includes('google-drive')),
    ).toBe(true);
  });
});
