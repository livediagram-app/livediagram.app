// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { DesignLoading } from './DesignLoading';
import { armLoadWatchdog, LOAD_TIMEOUT_MS, resetLoadProgressForTests } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';

// docs/specs/007-editor/load-recovery.md "Self-healing on the opening screen".

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resetLoadProgressForTests();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setNavigatorOnline(true);
});

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

describe('DesignLoading', () => {
  it('offers Refresh after 10 seconds and reports the slow load', () => {
    render(<DesignLoading stage="opening" />);
    expect(screen.queryByText(/longer than usual/)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/longer than usual/)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('Error', 'Warning', 'DesignLoad.Slow');
  });

  it('does not report the creating stage as a slow load', () => {
    render(<DesignLoading stage="creating" />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(track).not.toHaveBeenCalled();
  });

  it('says it is trying a fresh start while the self-healing reload is pending', () => {
    render(<DesignLoading stage="opening" />);
    act(() => {
      armLoadWatchdog(() => {}, { reload: () => {} });
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    });
    expect(screen.getByText('Still working on it. Trying a fresh start.')).toBeTruthy();
    expect(screen.queryByText(/longer than usual/)).toBeNull();
  });

  // docs/specs/007-editor/load-recovery.md "Offline".
  it('says it is offline instead of offering a Refresh', () => {
    setNavigatorOnline(false);
    render(<DesignLoading stage="opening" />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/You’re offline. Waiting for the connection/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/You’re offline/)).toBeNull();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy();
  });
});
