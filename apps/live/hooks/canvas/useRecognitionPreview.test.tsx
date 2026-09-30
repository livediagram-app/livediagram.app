// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const hook = (points: P[] | null, active = true) =>
    renderHook(
      (p: { points: P[] | null; active: boolean }) => useRecognitionPreview(p.points, p.active, 1),
      {
        initialProps: { points, active },
      },
    );

  it('shows the shape once the pen has held still for the delay, not before', () => {
    const { result } = hook(square());
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS - 50));
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(60));
    expect(result.current?.kind).toBe('square');
  });

  it('drops it the moment the pen moves on, and waits again', () => {
    const pts = square();
    const { result, rerender } = hook(pts);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    expect(result.current).not.toBeNull();
    rerender({ points: [...pts, { x: 60, y: 200 }], active: true });
    expect(result.current).toBeNull();
  });

  it('does nothing with recognition off', () => {
    const { result } = hook(square(), false);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS * 2));
    expect(result.current).toBeNull();
  });

  it('forgets it when the stroke ends', () => {
    const { result, rerender } = hook(square());
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    rerender({ points: null, active: true });
    expect(result.current).toBeNull();
  });
});
