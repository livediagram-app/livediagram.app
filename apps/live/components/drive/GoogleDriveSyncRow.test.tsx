// @vitest-environment jsdom

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_SYNCING_SHOW_DELAY_MS } from '@/lib/drive/cadence';
import {
  DRIVE_CONNECT_CANCELLED,
  DRIVE_CONNECT_FAILED,
  DRIVE_PHASE_PRIMARY,
  DRIVE_RHYTHM,
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

const NOW = 10 * 60_000;
beforeEach(() => vi.useFakeTimers({ now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ROW = SETTINGS_CATEGORIES.flatMap((c) => c.rows).find(
  (r) => r.kind === 'cloudSync',
) as SettingsCloudSyncRowSpec;
const VISIBLE = { selector: '[data-stable-option]:not(.invisible)' };

function value(
  status: Partial<DriveMirrorStatus>,
  over: Partial<DriveMirrorContextValue> = {},
): DriveMirrorContextValue {
  return {
    ...DRIVE_MIRROR_OFF,
    mode: 'broker',
    connect: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    adopt: vi.fn(async () => {}),
    ...over,
    status: { ...DRIVE_STATUS_INITIAL, rootName: 'livediagram (staging)', ...status },
  };
}

function show(status: Partial<DriveMirrorStatus>, over: Partial<DriveMirrorContextValue> = {}) {
  const v = value(status, over);
  const view = render(
    <DriveMirrorContext.Provider value={v}>
      <GoogleDriveSyncRow row={ROW} />
    </DriveMirrorContext.Provider>,
  );
  return { ...v, view };
}

const statusText = () =>
  document.querySelector('[data-drive-status] [data-stable-option]:not(.invisible)')!;

describe('GoogleDriveSyncRow', () => {
  it('offers Connect when not connected, with no Disconnect', () => {
    const v = show({ state: 'disconnected' });
    expect(statusText().textContent).toBe('Not connected');
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));
    expect(v.connect).toHaveBeenCalledOnce();
  });

  it('says Connecting while the provider connects, the button held', () => {
    const v = show({ state: 'disconnected' }, { connecting: true });
    const button = screen.getByRole('button', { name: 'Connecting…' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(v.connect).not.toHaveBeenCalled();
    expect(statusText().textContent).toBe('Connecting…');
  });

  it('says why Connect could not start, and calmly that it was cancelled', () => {
    show({ state: 'disconnected' }, { connectError: DRIVE_CONNECT_FAILED });
    expect(screen.getByText(DRIVE_CONNECT_FAILED, VISIBLE)).toBeTruthy();
    cleanup();
    show({ state: 'disconnected' }, { connectNote: 'cancelled' });
    const shown = screen.getByText(DRIVE_CONNECT_CANCELLED, VISIBLE);
    expect(shown.closest('[data-drive-text]')?.className).not.toContain('rose');
  });

  it('when connected: plain status at the top right, the folder, the rhythm, Disconnect only', () => {
    show({ state: 'idle', lastSyncedAt: NOW - 3 * 60_000 });
    const status = statusText();
    expect(status.textContent).toBe('Synced 3 mins ago');
    expect(status.className).toContain('text-slate-500');
    expect(status.querySelector('svg')).toBeNull();
    expect(
      screen.getByText(
        'Your documents are synced to “livediagram (staging)” in Google Drive.',
        VISIBLE,
      ),
    ).toBeTruthy();
    expect(screen.getByText(DRIVE_RHYTHM)).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Disconnect']);
    expect(screen.queryByRole('button', { name: /Sync now/ })).toBeNull();
    // No pill and no divider.
    expect(document.querySelector('[data-drive-state]')).toBeNull();
    expect(document.querySelector('[data-drive-progress-track]')).toBeNull();
  });

  it('paints Disconnect as the neutral secondary button', () => {
    show({ state: 'idle', lastSyncedAt: NOW });
    const cls = screen.getByRole('button', { name: 'Disconnect' }).className;
    expect(cls).toContain('border-slate-200');
    expect(cls).not.toMatch(/amber|rose/);
  });

  it('says Syncing only once a pass has lasted a moment', () => {
    const syncing = value({ state: 'syncing', lastSyncedAt: NOW });
    render(
      <DriveMirrorContext.Provider value={syncing}>
        <GoogleDriveSyncRow row={ROW} />
      </DriveMirrorContext.Provider>,
    );
    expect(statusText().textContent).toBe('Synced just now');
    act(() => void vi.advanceTimersByTime(DRIVE_SYNCING_SHOW_DELAY_MS));
    expect(statusText().textContent).toBe('Syncing…');
  });

  it('counts the first copy in the status and the line', () => {
    show({ state: 'syncing', progress: { done: 3, total: 12 } });
    expect(statusText().textContent).toBe('Copying 3 of 12…');
    expect(screen.getByText('Copying 3 of 12 documents…', VISIBLE)).toBeTruthy();
  });

  it('warns with words and a glyph when something needs the user', () => {
    show({ state: 'needs_reconnect' });
    const status = statusText();
    expect(status.textContent).toBe('Needs reconnecting');
    expect(status.className).toContain('text-amber-700');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('keeps every status of the phase laid out, so the status never changes width', () => {
    show({ state: 'idle', lastSyncedAt: NOW });
    const all = [...document.querySelectorAll('[data-drive-status] [data-stable-option]')].map(
      (n) => n.textContent,
    );
    expect(all).toEqual(expect.arrayContaining(['Synced 30 days ago', 'Syncing…', 'Offline']));
    expect(all).not.toContain('Not connected');
  });

  it('sizes the primary for its phase only', () => {
    show({ state: 'needs_reconnect' });
    const button = screen.getByRole('button', { name: 'Reconnect' });
    expect([...button.querySelectorAll('[data-stable-option]')].map((n) => n.textContent)).toEqual([
      ...DRIVE_PHASE_PRIMARY.attention,
    ]);
  });

  it('puts a folder notice in place of the rhythm, one line with Show folder', () => {
    const notice = { kind: 'diagram' as const, ldId: 'd1', name: 'Plan', parentId: 'p' };
    const v = show(
      { state: 'idle', lastSyncedAt: NOW, notices: [notice, { ...notice, ldId: 'd2' }] },
      { canAdopt: true },
    );
    const detail = document.querySelector('[data-drive-detail]')!;
    expect(detail.getAttribute('data-drive-detail')).toBe('notice');
    expect(detail.querySelector(':scope > div > :not(.invisible)')!.textContent).toContain(
      "Plan and 1 more: Moved to a Drive folder livediagram can't see.",
    );
    expect(statusText().textContent).toBe('Needs attention');
    fireEvent.click(screen.getByRole('button', { name: 'Show folder' }));
    expect(v.adopt).toHaveBeenCalledWith(notice);
  });

  it('offers Reconnect and Resume when paused, beside Disconnect', () => {
    const v = show({ state: 'needs_reconnect' });
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(v.connect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    cleanup();
    const next = show({ state: 'needs_resume' });
    expect(statusText().textContent).toBe('Paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(next.resume).toHaveBeenCalledOnce();
  });

  it('links to the help article', () => {
    show({ state: 'disconnected' });
    expect(
      screen.getAllByRole('link').some((a) => a.getAttribute('href')?.includes('google-drive')),
    ).toBe(true);
  });
});
