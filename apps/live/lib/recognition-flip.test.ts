import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveStrokeOf } from './live-stroke-test-utils';
import { flipRecognition, flipStrokeRecognition } from './recognition-flip';
import { track } from './telemetry';

vi.mock('./telemetry', () => ({ track: vi.fn() }));

// docs/specs/023-whiteboard/whiteboard.md "Shape recognition": Alt (Option), or the chip on a
// touch screen, flips the stroke being drawn between ink and the shape it reads as.
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

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.mocked(track).mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe('flipRecognition', () => {
  it('recognises ink that reads as a shape and locks it, at once', () => {
    const stroke = liveStrokeOf(square());
    expect(flipRecognition(stroke, 1.5)).toBe('recognised');
    expect(stroke.shaped()?.kind).toBe('square');
    expect(stroke.keepsInk()).toBe(false);
  });

  it('leaves ink that reads as no shape as ink', () => {
    const stroke = liveStrokeOf(scribble());
    expect(flipRecognition(stroke, 1.5)).toBeNull();
    expect(stroke.shaped()).toBeNull();
    expect(stroke.keepsInk()).toBe(false);
  });

  it('breaks a shown shape back to ink, which lands as drawn', () => {
    const stroke = liveStrokeOf(square());
    flipRecognition(stroke, 1.5);
    expect(flipRecognition(stroke, 1.5)).toBe('broken');
    expect(stroke.shaped()).toBeNull();
    expect(stroke.keepsInk()).toBe(true);
  });

  it('flips back to the shape on the next press', () => {
    const stroke = liveStrokeOf(square());
    flipRecognition(stroke, 1.5);
    flipRecognition(stroke, 1.5);
    expect(flipRecognition(stroke, 1.5)).toBe('recognised');
    expect(stroke.shaped()?.kind).toBe('square');
  });
});

describe('flipStrokeRecognition', () => {
  it('tells the subscribers and reports how, by key or chip', () => {
    const stroke = liveStrokeOf(square());
    const listener = vi.fn();
    stroke.subscribe(listener);
    flipStrokeRecognition(stroke, 1.5, 'key');
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Toggled', 'RecogniseOnceKey');
    flipStrokeRecognition(stroke, 1.5, 'chip');
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Toggled', 'BreakShapeChip');
    flipStrokeRecognition(stroke, 1.5, 'chip');
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Toggled', 'RecogniseOnceChip');
    flipStrokeRecognition(stroke, 1.5, 'key');
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Toggled', 'BreakShapeKey');
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('reports and redraws nothing when there is nothing to flip', () => {
    const stroke = liveStrokeOf(scribble());
    const listener = vi.fn();
    stroke.subscribe(listener);
    expect(flipStrokeRecognition(stroke, 1.5, 'key')).toBeNull();
    expect(track).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
