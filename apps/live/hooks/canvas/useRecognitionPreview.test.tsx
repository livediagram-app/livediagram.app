// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import type { LiveStroke } from '@/lib/live-stroke';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import { flipRecognition } from '@/lib/recognition-flip';
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

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

describe('useRecognitionPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
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
    expect(result.current.shape).toBeNull();
    act(() => vi.advanceTimersByTime(60));
    expect(result.current.shape?.kind).toBe('square');
  });

  it('keeps the shape once shown: dragging on resizes it, and the stroke never comes back', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    const shown = result.current.shape!;
    expect(shown.kind).toBe('square');
    // The pen rests at the top-left corner; dragging it 50 px up and left grows the box there.
    act(() => {
      stroke.push(-50, -50);
      stroke.notify();
    });
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.shape!.bbox.x).toBeCloseTo(shown.bbox.x - 50, 5);
    expect(result.current.shape!.bbox.width).toBeCloseTo(shown.bbox.width + 50, 5);
    expect(stroke.shaped()).toEqual(result.current.shape);
  });

  it('keeps it while the pen only trembles within the still radius', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    act(() => {
      stroke.push(2, 1);
      stroke.notify();
    });
    expect(result.current.shape?.kind).toBe('square');
  });

  it('does nothing with recognition off', () => {
    const { result } = hook(liveStrokeOf(square()), false);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS * 2));
    expect(result.current.shape).toBeNull();
  });

  it('forgets it when the stroke ends', () => {
    const { result, rerender } = hook(liveStrokeOf(square()));
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    rerender({ stroke: null, active: true });
    expect(result.current.shape).toBeNull();
  });

  it('shows the shape perfect at once when Shift is already held as it locks', () => {
    const stroke = liveStrokeOf(square());
    stroke.constrain(true);
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    expect(result.current.shape!.bbox.width).toBe(result.current.shape!.bbox.height);
    expect(stroke.shaped()).toEqual(result.current.shape);
  });

  it('reshapes perfect once Shift is held: what shows is what shaped() commits', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
    act(() => {
      stroke.constrain(true);
      stroke.push(-50, -20);
      stroke.notify();
    });
    expect(result.current.shape!.bbox.width).toBeCloseTo(result.current.shape!.bbox.height, 9);
    expect(stroke.shaped()).toEqual(result.current.shape);
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Alt (or the chip) flips the stroke.
describe('useRecognitionPreview, flipped', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const hook = (stroke: LiveStroke, active: boolean) =>
    renderHook(() => useRecognitionPreview(stroke, active, 1, 1.5));
  const flip = (stroke: LiveStroke) =>
    act(() => {
      flipRecognition(stroke, 1.5);
      stroke.notify();
    });
  const move = (stroke: LiveStroke, x: number, y: number) =>
    act(() => {
      stroke.push(x, y);
      stroke.notify();
    });
  const wait = (ms = RECOGNITION_PREVIEW_DWELL_MS + 10) => act(() => vi.advanceTimersByTime(ms));

  it('shows the shape at once when Alt recognises it with recognition off', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke, false);
    flip(stroke);
    expect(result.current.shape?.kind).toBe('square');
    // Dragging on reshapes it, as after the dwell.
    move(stroke, -50, -50);
    expect(result.current.shape!.bbox.x).toBeLessThan(-40);
  });

  it('shows the ink again when Alt breaks out, and holding still does not snap it again', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke, true);
    wait();
    expect(result.current.shape?.kind).toBe('square');
    flip(stroke);
    expect(result.current.shape).toBeNull();
    wait(RECOGNITION_PREVIEW_DWELL_MS * 3);
    expect(result.current.shape).toBeNull();
  });

  it('snaps again on the next pause once the pen moves on', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke, true);
    wait();
    flip(stroke);
    move(stroke, 0, 30);
    wait();
    expect(result.current.shape).not.toBeNull();
  });

  it('never snaps while the ink is held (Alt down), even after moving on', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke, true);
    wait();
    flip(stroke);
    stroke.holdInk(true);
    move(stroke, 0, 30);
    wait();
    expect(result.current.shape).toBeNull();
    // Releasing Alt changes nothing by itself.
    stroke.holdInk(false);
    wait();
    expect(result.current.shape).toBeNull();
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": the chip on a touch screen.
describe('useRecognitionPreview, the chip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const hook = (stroke: LiveStroke, active: boolean) =>
    renderHook(() => useRecognitionPreview(stroke, active, 1, 1.5));
  const wait = () => act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
  const scribble = (): P[] =>
    Array.from({ length: 30 }, (_, i) => ({ x: i * 7, y: (i * 37) % 23 }));

  for (const pointerType of ['pen', 'touch']) {
    it(`offers Make shape at the ${pointerType}'s tip once it holds still, with recognition off`, () => {
      const { result } = hook(liveStrokeOf(square(), { pointerType }), false);
      expect(result.current.chip).toBeNull();
      wait();
      expect(result.current.chip).toEqual({ action: 'make', at: { x: 0, y: 0 } });
      expect(result.current.shape).toBeNull();
    });
  }

  it('offers Keep drawing once a shape has snapped', () => {
    const { result } = hook(liveStrokeOf(square(), { pointerType: 'pen' }), true);
    wait();
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.chip?.action).toBe('keep');
  });

  it('flips its offer with the stroke, while the pen stays still', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'touch' });
    const { result } = hook(stroke, false);
    wait();
    act(() => {
      flipRecognition(stroke, 1.5);
      stroke.notify();
    });
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.chip?.action).toBe('keep');
    act(() => {
      flipRecognition(stroke, 1.5);
      stroke.notify();
    });
    expect(result.current.shape).toBeNull();
    expect(result.current.chip?.action).toBe('make');
  });

  it('leaves when the pen moves on', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'pen' });
    const { result } = hook(stroke, false);
    wait();
    act(() => {
      stroke.push(0, 40);
      stroke.notify();
    });
    expect(result.current.chip).toBeNull();
  });

  it('stays while the pen only trembles', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'pen' });
    const { result } = hook(stroke, false);
    wait();
    act(() => {
      stroke.push(1, 1);
      stroke.notify();
    });
    expect(result.current.chip?.action).toBe('make');
  });

  it('is not offered for a stroke that reads as no shape', () => {
    const { result } = hook(liveStrokeOf(scribble(), { pointerType: 'pen' }), false);
    wait();
    expect(result.current.chip).toBeNull();
  });

  it('is never offered to a mouse, which has Alt', () => {
    const { result } = hook(liveStrokeOf(square(), { pointerType: 'mouse' }), true);
    wait();
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.chip).toBeNull();
  });
});
