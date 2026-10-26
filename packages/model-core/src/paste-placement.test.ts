import { describe, expect, it } from 'vitest';
import { landInView, PASTE_OFFSET, pasteBounds } from './paste-placement';

// A tiny model: boxes, and arrows whose ends are free points, pinned to a box's centre or on another arrow's start.
type End =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: string }
  | { kind: 'on-arrow'; arrowId: string }
  | { kind: 'other' };
type El =
  | { id: string; type: 'box'; x: number; y: number; width: number; height: number }
  | { id: string; type: 'arrow'; from: End; to: End };

const geometry = {
  elementBounds: (el: El) => (el.type === 'box' ? el : { x: 0, y: 0, width: 0, height: 0 }),
  endpointPosition: (end: End, all: El[]): { x: number; y: number } => {
    if (end.kind === 'free') return { x: end.x, y: end.y };
    if (end.kind === 'pinned') {
      const box = all.find((el) => el.id === end.elementId);
      return box?.type === 'box'
        ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  },
};

const box = (id: string, x: number, y: number): El => ({
  id,
  type: 'box',
  x,
  y,
  width: 100,
  height: 50,
});
const arrow = (id: string, from: End, to: End): El => ({ id, type: 'arrow', from, to });

describe('pasteBounds', () => {
  it('is null for nothing, and the boxes around what is copied', () => {
    expect(pasteBounds([], geometry)).toBeNull();
    expect(pasteBounds([box('a', 100, 100), box('b', 300, 400)], geometry)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 350,
    });
  });

  it("measures an arrow's free ends and ends held by something copied", () => {
    const copied = [
      box('a', 1000, 1000),
      arrow('x', { kind: 'free', x: 900, y: 900 }, { kind: 'pinned', elementId: 'a' }),
    ];
    expect(pasteBounds(copied, geometry)).toEqual({ x: 900, y: 900, width: 200, height: 150 });
  });

  it('skips ends pinned to, or resting on arrows through, something left behind', () => {
    const copied = [
      box('a', 1000, 1000),
      arrow('x', { kind: 'pinned', elementId: 'gone' }, { kind: 'pinned', elementId: 'a' }),
      // On x, whose own start is left behind: not held.
      arrow('y', { kind: 'on-arrow', arrowId: 'x' }, { kind: 'free', x: 1100, y: 1050 }),
      // On an arrow not copied, on a box (not an arrow), an unknown kind, and a loop of arrows.
      arrow('z', { kind: 'on-arrow', arrowId: 'gone' }, { kind: 'on-arrow', arrowId: 'a' }),
      arrow('w', { kind: 'other' }, { kind: 'on-arrow', arrowId: 'v' }),
      arrow('v', { kind: 'on-arrow', arrowId: 'w' }, { kind: 'free', x: 1000, y: 1000 }),
    ];
    expect(pasteBounds(copied, geometry)).toEqual({ x: 1000, y: 1000, width: 100, height: 50 });
  });

  it('holds an end on an arrow whose own ends are held', () => {
    const copied = [
      arrow('x', { kind: 'free', x: 0, y: 0 }, { kind: 'free', x: 10, y: 10 }),
      arrow('y', { kind: 'on-arrow', arrowId: 'x' }, { kind: 'free', x: 20, y: 20 }),
    ];
    expect(pasteBounds(copied, geometry)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
});

describe('landInView', () => {
  const view = { x: 0, y: 0, width: 1000, height: 800 };
  const at = (x: number, y: number) => ({ x, y, width: 100, height: 50 });

  it('keeps the offset with no view or nothing measured, or when the copies land in view', () => {
    expect(landInView(at(5000, 5000), PASTE_OFFSET, PASTE_OFFSET, null)).toEqual({
      dx: 24,
      dy: 24,
    });
    expect(landInView(null, PASTE_OFFSET, PASTE_OFFSET, view)).toEqual({ dx: 24, dy: 24 });
    expect(landInView(at(100, 100), PASTE_OFFSET, PASTE_OFFSET, view)).toEqual({ dx: 24, dy: 24 });
  });

  it('centres copies that would land out of view, on whole pixels', () => {
    expect(landInView(at(5000.4, 5000), PASTE_OFFSET, PASTE_OFFSET, view)).toEqual({
      dx: -4550,
      dy: -4625,
    });
    expect(landInView(at(-500, 100), 24, 0, view)).toEqual({ dx: 950, dy: 275 });
  });
});
