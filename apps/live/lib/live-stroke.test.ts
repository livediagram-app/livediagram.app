import { describe, expect, it, vi } from 'vitest';
import { createLiveStroke } from './live-stroke';

// The stroke being drawn with a whiteboard pen (docs/specs/023-draw-mode/draw-mode.md "Pens";
// blueprint whiteboard-round-one "Pen ink").

describe('createLiveStroke', () => {
  it('records pressure for a pen, streamlined at 0.2', () => {
    const s = createLiveStroke('pen', 3);
    expect(s).toMatchObject({ pointer: 'pen', pointerId: 3, streamline: 0.2, pressures: [] });
  });

  it('records no pressure for a mouse (streamline 0.5) or a finger (0.2): a constant width', () => {
    expect(createLiveStroke('mouse', 1)).toMatchObject({ streamline: 0.5, pressures: null });
    expect(createLiveStroke('touch', 1)).toMatchObject({ streamline: 0.2, pressures: null });
    expect(createLiveStroke(undefined, undefined).pointer).toBe('mouse');
  });

  it('keeps every raw sample, dropping only an exact repeat', () => {
    const s = createLiveStroke('mouse', 1);
    expect(s.push(0, 0)).toBe(true);
    expect(s.push(0, 0)).toBe(false);
    expect(s.push(0.01, 0)).toBe(true);
    expect(s.points).toEqual([
      { x: 0, y: 0 },
      { x: 0.01, y: 0 },
    ]);
  });

  it('keeps a pressure per sample, clamped to 0 to 1, the last one when a sample has none', () => {
    const s = createLiveStroke('pen', 1);
    s.push(0, 0, 0.3);
    s.push(1, 0, 1.4);
    s.push(2, 0);
    s.push(3, 0, Number.NaN);
    expect(s.pressures).toEqual([0.3, 1, 1, 0.5]);
  });

  it('is perfect-freehand input for a pen of a width', () => {
    const s = createLiveStroke('pen', 1);
    s.push(0, 0, 0.4);
    expect(s.ink(2.5)).toEqual({
      points: [{ x: 0, y: 0 }],
      pressures: [0.4],
      width: 2.5,
      streamline: 0.2,
    });
    expect(createLiveStroke('mouse', 1).ink(1).pressures).toBeUndefined();
  });

  it('tells each subscriber on notify, until it unsubscribes', () => {
    const stroke = createLiveStroke('mouse', 1);
    const a = vi.fn();
    const b = vi.fn();
    const offA = stroke.subscribe(a);
    stroke.subscribe(b);
    stroke.notify();
    offA();
    stroke.notify();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Shift while reshaping.
describe('createLiveStroke, constrained', () => {
  const circle = {
    kind: 'circle' as const,
    bbox: { x: 0, y: 0, width: 100, height: 60 },
    confidence: 1,
  };

  it('says whether Shift changed', () => {
    const s = createLiveStroke('mouse', 1);
    expect(s.constrain(false)).toBe(false);
    expect(s.constrain(true)).toBe(true);
    expect(s.constrain(true)).toBe(false);
    expect(s.constrain(false)).toBe(true);
  });

  it('reshapes perfect while Shift is held and free again once it is not', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(100, 60);
    s.snapTo(circle);
    s.push(150, 70);
    expect(s.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 150, height: 70 });
    s.constrain(true);
    expect(s.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    s.constrain(false);
    expect(s.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 150, height: 70 });
  });

  const rect = (width: number, height: number) => ({
    kind: 'square' as const,
    bbox: { x: 0, y: 0, width, height },
    confidence: 1,
  });

  it('snaps a rectangle to the ratio nearest its own as Shift takes effect', () => {
    const square = createLiveStroke('mouse', 1);
    square.push(100, 98);
    square.snapTo(rect(100, 98));
    square.push(120, 98);
    square.constrain(true);
    expect(square.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 120, height: 120 });

    const wide = createLiveStroke('mouse', 1);
    wide.push(100, 60);
    wide.snapTo(rect(100, 60));
    wide.push(150, 60);
    wide.constrain(true);
    expect(wide.shaped()!.bbox.width).toBe(150);
    expect(wide.shaped()!.bbox.height).toBeCloseTo(90, 9);
  });

  it('measures the rectangle as it is when Shift is pressed, not as it was recognised', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(100, 100);
    s.snapTo(rect(100, 100));
    // Dragged free to 150 x 70 first: landscape by now.
    s.push(150, 70);
    s.constrain(true);
    s.push(150, 71);
    expect(s.shaped()!.bbox.width).toBe(150);
    expect(s.shaped()!.bbox.height).toBeCloseTo(90, 9);
  });

  it('measures again each time Shift is pressed', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(100, 60);
    s.snapTo(rect(100, 60));
    s.constrain(true);
    s.constrain(false);
    s.push(100, 100);
    s.constrain(true);
    expect(s.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('measures the recognised rectangle when Shift is already held as it locks', () => {
    const s = createLiveStroke('mouse', 1);
    s.constrain(true);
    s.push(60, 100);
    s.snapTo(rect(60, 100));
    s.push(60, 120);
    expect(s.shaped()!.bbox.height).toBe(120);
    expect(s.shaped()!.bbox.width).toBeCloseTo(72, 9);
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Alt (or the chip) breaks out.
describe('createLiveStroke, broken out of a shape', () => {
  const circle = {
    kind: 'circle' as const,
    bbox: { x: 0, y: 0, width: 100, height: 60 },
    confidence: 1,
  };

  it('is ink again, exactly as drawn so far, and lands as ink', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(0, 0);
    s.push(100, 60);
    s.snapTo(circle);
    s.push(120, 70);
    expect(s.keepsInk()).toBe(false);
    expect(s.unsnap()).toBe(true);
    expect(s.shaped()).toBeNull();
    expect(s.keepsInk()).toBe(true);
    expect(s.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 60 },
      { x: 120, y: 70 },
    ]);
  });

  it('breaks nothing when no shape is locked', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(0, 0);
    expect(s.unsnap()).toBe(false);
    expect(s.keepsInk()).toBe(false);
  });

  it('lands the shape again once it locks again', () => {
    const s = createLiveStroke('mouse', 1);
    s.push(100, 60);
    s.snapTo(circle);
    s.unsnap();
    s.push(110, 60);
    s.snapTo(circle);
    expect(s.keepsInk()).toBe(false);
    expect(s.shaped()!.bbox).toEqual(circle.bbox);
  });

  it('says whether the ink is held (Alt down), so the dwell leaves it', () => {
    const s = createLiveStroke('mouse', 1);
    expect(s.inkHeld()).toBe(false);
    s.holdInk(true);
    expect(s.inkHeld()).toBe(true);
    s.holdInk(false);
    expect(s.inkHeld()).toBe(false);
  });
});
