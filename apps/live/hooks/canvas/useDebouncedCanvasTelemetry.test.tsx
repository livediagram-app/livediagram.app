// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import {
  CANVAS_TELEMETRY_DEBOUNCE_MS,
  useDebouncedCanvasTelemetry,
} from './useDebouncedCanvasTelemetry';

beforeEach(() => {
  trackMock.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useDebouncedCanvasTelemetry (docs/specs/017-telemetry/telemetry.md Canvas slider emits)', () => {
  it('collapses a drag into one event per setter', () => {
    const { result } = renderHook(() => useDebouncedCanvasTelemetry());
    for (let i = 0; i < 10; i++) result.current('backgroundColor', 'BackgroundColor');
    result.current('backgroundOpacity', 'BackgroundOpacity');
    vi.advanceTimersByTime(CANVAS_TELEMETRY_DEBOUNCE_MS);
    expect(trackMock.mock.calls).toEqual([
      ['Canvas', 'Changed', 'BackgroundColor'],
      ['Canvas', 'Changed', 'BackgroundOpacity'],
    ]);
  });

  it('flushes a pending emit on page hide, ahead of the engine flush', () => {
    const order: string[] = [];
    trackMock.mockImplementation(() => order.push('emit'));
    // Stands in for the telemetry engine's own bubble-phase pagehide flush,
    // which is attached before the editor's listener.
    const engineFlush = () => order.push('flush');
    window.addEventListener('pagehide', engineFlush);
    const { result } = renderHook(() => useDebouncedCanvasTelemetry());
    result.current('patternColor', 'PatternColor');
    window.dispatchEvent(new Event('pagehide'));
    expect(order).toEqual(['emit', 'flush']);
    // Not sent a second time when the (cleared) timer would have fired.
    vi.advanceTimersByTime(CANVAS_TELEMETRY_DEBOUNCE_MS);
    expect(trackMock).toHaveBeenCalledTimes(1);
    window.removeEventListener('pagehide', engineFlush);
  });

  it('flushes a pending emit when the editor unmounts', () => {
    const { result, unmount } = renderHook(() => useDebouncedCanvasTelemetry());
    result.current('backgroundOpacity', 'BackgroundOpacity');
    unmount();
    expect(trackMock.mock.calls).toEqual([['Canvas', 'Changed', 'BackgroundOpacity']]);
    vi.advanceTimersByTime(CANVAS_TELEMETRY_DEBOUNCE_MS);
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on hide or unmount when nothing is pending', () => {
    const { unmount } = renderHook(() => useDebouncedCanvasTelemetry());
    window.dispatchEvent(new Event('pagehide'));
    unmount();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
