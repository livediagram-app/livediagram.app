// @vitest-environment jsdom

// The avatar's cloud badge (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance").

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_SYNCING_MARK_DELAY_MS } from '@/lib/drive/cadence';
import {
  DRIVE_MIRROR_OFF,
  DRIVE_STATUS_INITIAL,
  DriveMirrorContext,
  type DriveMirrorContextValue,
} from './drive-mirror-context';
import { DriveProgressRing, DriveSyncBadge, useDriveIndicator } from './DriveSyncBadge';

beforeEach(() => vi.useFakeTimers({ now: 10 * 60_000 }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function withStatus(status: Partial<DriveMirrorStatus>): DriveMirrorContextValue {
  return { ...DRIVE_MIRROR_OFF, mode: 'broker', status: { ...DRIVE_STATUS_INITIAL, ...status } };
}

function Probe({ onOpen = () => {} }: { onOpen?: () => void }) {
  const indicator = useDriveIndicator();
  return (
    <span className="relative">
      <DriveProgressRing indicator={indicator} />
      <DriveSyncBadge indicator={indicator} onOpen={onOpen} />
    </span>
  );
}

function renderWith(value: DriveMirrorContextValue, onOpen?: () => void) {
  return render(
    <DriveMirrorContext.Provider value={value}>
      <Probe onOpen={onOpen} />
    </DriveMirrorContext.Provider>,
  );
}

describe('DriveSyncBadge', () => {
  it('shows nothing while Drive is not connected, with the status region mounted and empty', () => {
    const view = renderWith(withStatus({ state: 'disconnected' }));
    expect(view.getByRole('status').textContent).toBe('');
    expect(view.queryByRole('button')).toBeNull();
  });

  it('is a button named with the state and the time, laid over the avatar', () => {
    const view = renderWith(withStatus({ state: 'idle', lastSyncedAt: 9 * 60_000 }));
    const badge = view.getByRole('button', { name: 'Synced to Google Drive 1 min ago' });
    expect(badge.dataset.driveBadge).toBe('synced');
    // Absolutely placed, so nothing moves when it appears or changes.
    expect(badge.className).toContain('absolute');
    // The announcement carries no time, so it does not speak every minute.
    expect(view.getByRole('status').textContent).toBe('Synced to Google Drive');
  });

  it('shows its words as a tooltip on keyboard focus', () => {
    const view = renderWith(withStatus({ state: 'idle', lastSyncedAt: 9 * 60_000 }));
    const badge = view.getByRole('button');
    act(() => {
      fireEvent.focus(badge);
      badge.focus();
    });
    act(() => void vi.runOnlyPendingTimers());
    expect(view.getByRole('tooltip').textContent).toBe('Synced to Google Drive 1 min ago');
  });

  it('opens Cloud Sync when pressed', () => {
    const onOpen = vi.fn();
    const view = renderWith(withStatus({ state: 'idle', lastSyncedAt: 1 }), onOpen);
    fireEvent.click(view.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('draws a different glyph per state, and spins only without reduced motion', () => {
    const view = renderWith(withStatus({ state: 'needs_reconnect' }));
    expect(
      view.getByRole('button', { name: 'Google Drive needs attention' }).dataset.driveBadge,
    ).toBe('attention');
    view.rerender(
      <DriveMirrorContext.Provider value={withStatus({ state: 'syncing' })}>
        <Probe />
      </DriveMirrorContext.Provider>,
    );
    const spin = view.container.querySelector('[data-drive-spin]')!;
    expect(spin.getAttribute('class')).toContain('motion-safe:');
  });

  it('holds the syncing badge back for a moment, then shows it', () => {
    const view = renderWith(withStatus({ state: 'syncing', lastSyncedAt: 1 }));
    expect(view.getByRole('button').dataset.driveBadge).toBe('synced');
    act(() => void vi.advanceTimersByTime(DRIVE_SYNCING_MARK_DELAY_MS));
    expect(view.getByRole('button', { name: 'Syncing with Google Drive' })).toBeTruthy();
  });

  it("rings the avatar with the first copy's progress", () => {
    const view = renderWith(withStatus({ state: 'syncing', progress: { done: 3, total: 12 } }));
    expect(view.getByRole('button', { name: 'Copying 3 of 12 to Google Drive' })).toBeTruthy();
    expect(
      view.container.querySelector('[data-drive-progress]')!.getAttribute('data-drive-progress'),
    ).toBe('0.25');
  });
});
