// @vitest-environment jsdom

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import {
  DRIVE_CONNECT_CANCELLED,
  DRIVE_CONNECT_FAILED,
  DRIVE_PHASE_BADGES,
  DRIVE_PHASE_PRIMARY,
  driveRhythmText,
} from '@/lib/drive/cloud-sync-copy';
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
  it('offers Connect when not connected', () => {
    const value = show({ state: 'disconnected' });
    expect(
      screen.getByText('Not connected', { selector: '[data-stable-option]:not(.invisible)' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));
    expect(value.connect).toHaveBeenCalledOnce();
  });

  it('says Connecting while the provider connects, the button held', () => {
    const value = show({ state: 'disconnected' }, { connecting: true });
    const button = screen.getByRole('button', { name: 'Connecting…' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(value.connect).not.toHaveBeenCalled();
    expect(
      screen.getByText('Connecting', { selector: '[data-stable-option]:not(.invisible)' }),
    ).toBeTruthy();
  });

  it('says why Connect could not start, back at Not connected', () => {
    show({ state: 'disconnected' }, { connectError: DRIVE_CONNECT_FAILED });
    expect(
      screen.getByText(DRIVE_CONNECT_FAILED, { selector: '[data-stable-option]:not(.invisible)' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect Google Drive' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('says the user cancelled at Google, calmly, in the reserved text slot', () => {
    show({ state: 'disconnected' }, { connectNote: 'cancelled' });
    const shown = screen.getByText(DRIVE_CONNECT_CANCELLED, {
      selector: '[data-stable-option]:not(.invisible)',
    });
    expect(shown.closest('[data-drive-text]')?.className).not.toContain('rose');
  });

  it('reserves the cancelled wording while Not connected, so it appears without reflow', () => {
    show({ state: 'disconnected' });
    expect(
      screen.getByText(DRIVE_CONNECT_CANCELLED, { selector: '[data-stable-option]' }),
    ).toBeTruthy();
  });

  it('sizes the pill and the primary for the phase it is in, not every phase', () => {
    show({ state: 'idle', lastSyncedAt: Date.now() });
    const pill = document.querySelector('[data-drive-state]')!;
    expect([...pill.querySelectorAll('[data-stable-option]')].map((n) => n.textContent)).toEqual([
      ...DRIVE_PHASE_BADGES.connected,
    ]);
    const sync = screen.getByRole('button', { name: 'Sync now' });
    expect([...sync.querySelectorAll('[data-stable-option]')].map((n) => n.textContent)).toEqual([
      ...DRIVE_PHASE_PRIMARY.connected,
    ]);
    // Nothing of the not-connected phase is kept.
    expect(document.querySelector('[data-cloud-sync]')!.textContent).not.toContain(
      'Connect Google Drive',
    );
  });

  it('paints Disconnect as a quiet warning outline, not a danger', () => {
    show({ state: 'idle', lastSyncedAt: 1 });
    const cls = screen.getByRole('button', { name: 'Disconnect' }).className;
    expect(cls).toContain('ring-amber-600');
    expect(cls).not.toContain('rose');
  });

  it('shows the time since the last sync beside the pill, and the folder and rhythm below', () => {
    const value = show({ state: 'idle', lastSyncedAt: Date.now() });
    expect(
      screen.getByText('just now', { selector: '[data-stable-option]:not(.invisible)' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Copied to your Google Drive, in “livediagram (staging)”.', {
        selector: '[data-stable-option]:not(.invisible)',
      }),
    ).toBeTruthy();
    expect(screen.getByText(driveRhythmText())).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(value.syncNow).toHaveBeenCalledOnce();
  });

  it('says Not synced yet before the first sync', () => {
    show({ state: 'syncing', lastSyncedAt: null, progress: { done: 3, total: 12 } });
    expect(
      screen.getByText('Not synced yet', { selector: '[data-stable-option]:not(.invisible)' }),
    ).toBeTruthy();
  });

  it('shows the first copy as a line and a progress track, Syncing held', () => {
    show({ state: 'syncing', progress: { done: 3, total: 12 } });
    expect(
      screen.getByText('Copying 3 of 12 documents…', {
        selector: '[data-stable-option]:not(.invisible)',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    const held = screen.getByRole('button', { name: 'Syncing…' });
    expect(held.getAttribute('aria-disabled')).toBe('true');
    expect(held).toHaveProperty('disabled', false);
  });

  it('has no Disconnect and no time while not connected', () => {
    show({ state: 'disconnected' });
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    expect(document.querySelector('[data-drive-since]')).toBeNull();
    expect(document.querySelector('[data-drive-detail]')).toBeNull();
  });

  it('puts a folder notice in place of the rhythm, one line with Show folder', () => {
    const notice = { kind: 'diagram' as const, ldId: 'd1', name: 'Plan', parentId: 'p' };
    const value = show(
      { state: 'idle', lastSyncedAt: 1, notices: [notice, { ...notice, ldId: 'd2' }] },
      { canAdopt: true },
    );
    const detail = document.querySelector('[data-drive-detail]')!;
    expect(detail.getAttribute('data-drive-detail')).toBe('notice');
    expect(detail.querySelector(':scope > div > :not(.invisible)')!.textContent).toContain(
      "Plan and 1 more: Moved to a Drive folder livediagram can't see.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show folder' }));
    expect(value.adopt).toHaveBeenCalledWith(notice);
  });

  it('offers Reconnect and Resume sync when paused', () => {
    const value = show({ state: 'needs_reconnect' });
    expect(
      screen.getByText('Google Drive needs reconnecting. Your files are safe.', {
        selector: '[data-stable-option]:not(.invisible)',
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(value.connect).toHaveBeenCalledOnce();
    cleanup();
    const next = show({ state: 'needs_resume' });
    fireEvent.click(screen.getByRole('button', { name: 'Resume sync' }));
    expect(next.resume).toHaveBeenCalledOnce();
  });

  it('links to the help article', () => {
    show({ state: 'disconnected' });
    expect(
      screen.getAllByRole('link').some((a) => a.getAttribute('href')?.includes('google-drive')),
    ).toBe(true);
  });
});
