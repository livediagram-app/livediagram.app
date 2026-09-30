// @vitest-environment jsdom

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_SYNCING_SHOW_DELAY_MS } from '@/lib/drive/cadence';
import { DRIVE_CONNECT_CANCELLED, DRIVE_CONNECT_FAILED } from '@/lib/drive/cloud-sync-copy';
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

const NOTICE = { kind: 'document' as const, ldId: 'd', name: 'Plan', parentId: 'p' };
const problemLine = () => document.querySelector('[data-drive-problem]');
const description = () => document.getElementById(`${ROW.key}-description`)!.textContent ?? '';

describe('GoogleDriveSyncRow', () => {
  it('is one row when not connected: Not connected and Connect, nothing else', () => {
    const v = show({ state: 'disconnected' });
    expect(statusText().textContent).toBe('Not connected');
    expect(problemLine()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(v.connect).toHaveBeenCalledOnce();
  });

  it('says Connecting… once, in the status, and holds the Connect button', () => {
    const v = show({ state: 'disconnected' }, { connecting: true });
    expect(statusText().textContent).toBe('Connecting…');
    const button = screen.getByRole('button', { name: 'Connect' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Connecting…' })).toBeNull();
    fireEvent.click(button);
    expect(v.connect).not.toHaveBeenCalled();
  });

  it('holds Reconnect while reconnecting, the status saying Connecting…', () => {
    show({ state: 'needs_reconnect' }, { connecting: true });
    expect(statusText().textContent).toBe('Connecting…');
    expect(screen.getByRole('button', { name: 'Reconnect' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('puts a failed or cancelled Connect on a second line', () => {
    show({ state: 'disconnected' }, { connectError: DRIVE_CONNECT_FAILED });
    expect(problemLine()!.textContent).toContain(DRIVE_CONNECT_FAILED);
    cleanup();
    show({ state: 'disconnected' }, { connectNote: 'cancelled' });
    expect(problemLine()!.textContent).toContain(DRIVE_CONNECT_CANCELLED);
  });

  it('is one row when connected: Last synced and Disconnect; the folder in the description', () => {
    const v = show({ state: 'idle', lastSyncedAt: NOW - 2 * 60_000 });
    expect(statusText().textContent).toBe('Last synced 2 mins ago');
    expect(problemLine()).toBeNull();
    expect(screen.queryByRole('button', { name: /Sync now|Connect/ })).toBeNull();
    expect(description()).toContain(
      'Your documents are synced to “livediagram (staging)” in Google Drive.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(v.disconnect).toHaveBeenCalledOnce();
  });

  it('moves from just now to < 1 min ago to 1 min ago on time, without the shared tick', () => {
    show({ state: 'idle', lastSyncedAt: NOW });
    expect(statusText().textContent).toBe('Last synced just now');
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(statusText().textContent).toBe('Last synced < 1 min ago');
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    expect(statusText().textContent).toBe('Last synced 1 min ago');
  });

  it('says Syncing only once a pass has lasted a moment', () => {
    show({ state: 'syncing', lastSyncedAt: NOW });
    expect(statusText().textContent).toBe('Last synced just now');
    act(() => {
      vi.advanceTimersByTime(DRIVE_SYNCING_SHOW_DELAY_MS);
    });
    expect(statusText().textContent).toBe('Syncing…');
  });

  it('keeps every status of the phase laid out, so the status never changes width', () => {
    show({ state: 'idle', lastSyncedAt: NOW });
    const options = [...document.querySelectorAll('[data-drive-status] [data-stable-option]')].map(
      (n) => n.textContent,
    );
    expect(options).toContain('Syncing…');
    expect(options).toContain('Last synced 23 hours ago');
  });

  it('shows a folder notice on a second line, with Show folder', () => {
    const v = show({ state: 'idle', lastSyncedAt: NOW, notices: [NOTICE] }, { canAdopt: true });
    expect(statusText().textContent).toBe('Needs attention');
    expect(problemLine()!.textContent).toContain(
      "Plan: Moved to a Drive folder livediagram can't see.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show folder' }));
    expect(v.adopt).toHaveBeenCalledWith(NOTICE);
  });

  it('puts Reconnect or Resume on the second line when paused, Disconnect in the row', () => {
    const v = show({ state: 'needs_reconnect' });
    expect(statusText().textContent).toBe('Needs reconnecting');
    expect(problemLine()!.textContent).toContain('Google Drive needs reconnecting.');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(v.connect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    cleanup();
    const w = show({ state: 'needs_resume' });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(w.resume).toHaveBeenCalledOnce();
  });
});
