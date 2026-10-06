// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { DocumentLoading } from './DocumentLoading';
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
});

describe('DocumentLoading', () => {
  it('offers Refresh after 10 seconds and reports the slow load', () => {
    render(<DocumentLoading stage="opening" />);
    expect(screen.queryByText(/longer than usual/)).toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(/longer than usual/)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('Error', 'Warning', 'DocumentLoad.Slow');
  });

  it('does not report the creating stage as a slow load', () => {
    render(<DocumentLoading stage="creating" />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(track).not.toHaveBeenCalled();
  });

  it('says it is trying a fresh start while the self-healing reload is pending', () => {
    render(<DocumentLoading stage="opening" />);
    act(() => {
      armLoadWatchdog(() => {}, { reload: () => {} });
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    });
    expect(screen.getByText('Still working on it. Trying a fresh start.')).toBeTruthy();
    expect(screen.queryByText(/longer than usual/)).toBeNull();
  });
});
