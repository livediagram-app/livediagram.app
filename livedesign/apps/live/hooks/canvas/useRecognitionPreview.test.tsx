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
const scribble = (): P[] => Array.from({ length: 30 }, (_, i) => ({ x: i * 7, y: (i * 37) % 23 }));

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const hook = (stroke: LiveStroke | null) =>
  renderHook((p: { stroke: LiveStroke | null }) => useRecognitionPreview(p.stroke, 1, 1.5), {
    initialProps: { stroke },
  });
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
const wait = (ms = RECOGNITION_PREVIEW_DWELL_MS + 10) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// docs/specs/023-draw-mode/drawing-tools.md "Shape recognition": Alt (or the chip) flips the stroke.
describe('useRecognitionPreview, flipped', () => {
  it('never snaps a mouse stroke by holding still', () => {
    const { result } = hook(liveStrokeOf(square()));
    wait(RECOGNITION_PREVIEW_DWELL_MS * 3);
    expect(result.current.shape).toBeNull();
    expect(result.current.chip).toBeNull();
  });

  it('shows the shape at once when Alt recognises it, and dragging on reshapes it', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    flip(stroke);
    expect(result.current.shape?.kind).toBe('square');
    move(stroke, -50, -50);
    expect(result.current.shape!.bbox.x).toBeLessThan(-40);
    expect(stroke.shaped()).toEqual(result.current.shape);
  });

  it('shows the ink again when Alt breaks out', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    flip(stroke);
    flip(stroke);
    expect(result.current.shape).toBeNull();
    wait(RECOGNITION_PREVIEW_DWELL_MS * 3);
    expect(result.current.shape).toBeNull();
  });

  it('reshapes perfect once Shift is held: what shows is what shaped() commits', () => {
    const stroke = liveStrokeOf(square());
    const { result } = hook(stroke);
    flip(stroke);
    act(() => {
      stroke.constrain(true);
      stroke.push(-50, -20);
      stroke.notify();
    });
    expect(result.current.shape!.bbox.width).toBeCloseTo(result.current.shape!.bbox.height, 9);
    expect(stroke.shaped()).toEqual(result.current.shape);
  });

  it('forgets it when the stroke ends', () => {
    const stroke = liveStrokeOf(square());
    const { result, rerender } = hook(stroke);
    flip(stroke);
    rerender({ stroke: null });
    expect(result.current.shape).toBeNull();
  });
});

// docs/specs/023-draw-mode/drawing-tools.md "Shape recognition": the chip on a touch screen.
describe('useRecognitionPreview, the chip', () => {
  for (const pointerType of ['pen', 'touch']) {
    it(`offers Make shape at the ${pointerType}'s tip once it holds still`, () => {
      const { result } = hook(liveStrokeOf(square(), { pointerType }));
      expect(result.current.chip).toBeNull();
      wait();
      expect(result.current.chip).toEqual({ action: 'make', at: { x: 0, y: 0 } });
      expect(result.current.shape).toBeNull();
    });
  }

  it('offers Keep drawing while the stroke shows a shape', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'pen' });
    const { result } = hook(stroke);
    flip(stroke);
    wait();
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.chip?.action).toBe('keep');
  });

  it('flips its offer with the stroke, while the pen stays still', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'touch' });
    const { result } = hook(stroke);
    wait();
    flip(stroke);
    expect(result.current.shape?.kind).toBe('square');
    expect(result.current.chip?.action).toBe('keep');
    flip(stroke);
    expect(result.current.shape).toBeNull();
    expect(result.current.chip?.action).toBe('make');
  });

  it('leaves when the pen moves on', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'pen' });
    const { result } = hook(stroke);
    wait();
    move(stroke, 0, 40);
    expect(result.current.chip).toBeNull();
  });

  it('stays while the pen only trembles', () => {
    const stroke = liveStrokeOf(square(), { pointerType: 'pen' });
    const { result } = hook(stroke);
    wait();
    move(stroke, 1, 1);
    expect(result.current.chip?.action).toBe('make');
  });

  it('is not offered for a stroke that reads as no shape', () => {
    const { result } = hook(liveStrokeOf(scribble(), { pointerType: 'pen' }));
    wait();
    expect(result.current.chip).toBeNull();
  });
});
