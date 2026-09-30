// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import type { LiveStroke } from '@/lib/live-stroke';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import { useRecognitionPreview } from './useRecognitionPreview';

type P = { x: number; y: number };
const square = (): P[] => {
  const pts: P[] = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: i * 10, y: 0 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 200, y: i * 10 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 200 - i * 10, y: 200 });
  for (let i = 1; i <= 20; i++) pts.push({ x: 0, y: 200 - i * 10 });
  return pts;
};

describe('useRecognitionPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const hook = (stroke: LiveStroke | null, active = true) =>
    renderHook(
      (p: { stroke: LiveStroke | null; active: boolean }) =>
        useRecognitionPreview(p.stroke, p.active, 1, 1.5),
      { initialProps: { stroke, active } },
    );

  it('shows the shape once the pen has held still for the delay, not before', () => {
    const { result } = hook(liveStrokeOf(square()));
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS - 50));
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(60));
    expect(result.current?.kind).toBe('square');
  });

  it('drops it the moment the pen moves on, and waits again', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    expect(result.current).not.toBeNull();
    act(() => {
      stroke.push(60, 200);
      stroke.notify();
    });
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    expect(result.current).toBeNull();
  });

  it('keeps it while the pen only trembles within the still radius', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    act(() => {
      stroke.push(2, 1);
      stroke.notify();
    });
    expect(result.current?.kind).toBe('square');
  });

  it('does nothing with recognition off', () => {
    const { result } = hook(liveStrokeOf(square()), false);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS * 2));
    expect(result.current).toBeNull();
  });

  it('forgets it when the stroke ends', () => {
    const { result, rerender } = hook(liveStrokeOf(square()));
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    rerender({ stroke: null, active: true });
    expect(result.current).toBeNull();
  });
});
