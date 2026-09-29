// @vitest-environment jsdom

// The avatar's sync mark (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance").

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { DRIVE_SYNCING_MARK_DELAY_MS } from '@/lib/drive/cadence';
import {
  DRIVE_MIRROR_OFF,
  DRIVE_STATUS_INITIAL,
  DriveMirrorContext,
  type DriveMirrorContextValue,
} from './drive-mirror-context';
import { DriveSyncMark, useDriveIndicator } from './DriveSyncMark';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function withStatus(status: Partial<DriveMirrorStatus>): DriveMirrorContextValue {
  return { ...DRIVE_MIRROR_OFF, mode: 'broker', status: { ...DRIVE_STATUS_INITIAL, ...status } };
}

function Probe() {
  const indicator = useDriveIndicator();
  return (
    <span
      data-testid="button"
      aria-label={`Account menu${indicator.label ? `, ${indicator.label}` : ''}`}
    >
      <DriveSyncMark indicator={indicator} />
    </span>
  );
}

function renderWith(value: DriveMirrorContextValue) {
  return render(
    <DriveMirrorContext.Provider value={value}>
      <Probe />
    </DriveMirrorContext.Provider>,
  );
}

describe('DriveSyncMark', () => {
  it('keeps a polite status region mounted, empty while there is nothing to say', () => {
    const view = renderWith(withStatus({ state: 'disconnected' }));
    const region = view.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    expect(view.container.querySelector('[data-drive-mark]')).toBeNull();
  });

  it('overlays a dot and names the state on the button and in the region', () => {
    const view = renderWith(withStatus({ state: 'idle', lastSyncedAt: 1 }));
    const dot = view.container.querySelector('[data-drive-mark="synced"]')!;
    expect(dot).not.toBeNull();
    // Absolutely placed, so the button never moves when it appears or changes.
    expect(dot.className).toContain('absolute');
    expect(view.getByRole('status').textContent).toBe('Google Drive synced');
    expect(view.getByTestId('button').getAttribute('aria-label')).toBe(
      'Account menu, Google Drive synced',
    );
  });

  it('waits a moment before saying syncing, and pulses only without reduced motion', () => {
    const view = renderWith(withStatus({ state: 'syncing', lastSyncedAt: 1 }));
    expect(view.container.querySelector('[data-drive-mark="syncing"]')).toBeNull();
    act(() => void vi.advanceTimersByTime(DRIVE_SYNCING_MARK_DELAY_MS));
    const dot = view.container.querySelector('[data-drive-mark="syncing"]')!;
    expect(dot.className).toContain('motion-safe:animate-pulse');
  });

  it('draws the first mirror’s progress as a ring', () => {
    const view = renderWith(withStatus({ state: 'syncing', progress: { done: 1, total: 4 } }));
    expect(view.getByRole('status').textContent).toBe('Google Drive copying 1 of 4');
    const ring = view.container.querySelector('[data-drive-progress]')!;
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(ring.getAttribute('data-drive-progress')).toBe('0.25');
  });

  it('marks needs attention in amber', () => {
    const view = renderWith(withStatus({ state: 'needs_reconnect' }));
    expect(view.container.querySelector('[data-drive-mark="attention"]')!.className).toContain(
      'bg-amber',
    );
  });
});
