import { describe, expect, it, vi } from 'vitest';
import { createLiveStroke } from './live-stroke';

// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
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
