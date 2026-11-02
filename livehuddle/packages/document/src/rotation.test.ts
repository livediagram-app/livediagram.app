import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import { drawnBounds, rotationOf, supportsRotation } from './rotation';
import { svgBoxed } from './svg-render';
import type { BoxedElement, Element } from './index';

// docs/specs/009-elements/blueprints/annotations.md [QD8]: Rotation is hidden for annotations.
describe('supportsRotation', () => {
  it('lets a boxed element rotate', () => {
    expect(supportsRotation(createShape('square', 0, 0))).toBe(true);
  });

  it('never rotates an annotation marker', () => {
    const marker = { ...createShape('square', 0, 0), type: 'annotation' } as unknown as Element;
    expect(supportsRotation(marker)).toBe(false);
  });

  it('never rotates a pointer note, and draws a stored turn on one upright', () => {
    // docs/specs/009-elements/pointer-note.md: the tip is pinned to a point, so the note does not turn.
    const note = { ...createShape('pointer-note', 0, 0), rotation: 30 } as BoxedElement;
    expect(supportsRotation(note)).toBe(false);
    expect(rotationOf(note)).toBe(0);
    expect(svgBoxed(note)).not.toContain('rotate(');
    const square = { ...createShape('square', 0, 0), rotation: 30 } as BoxedElement;
    expect(rotationOf(square)).toBe(30);
    expect(svgBoxed(square)).toContain('rotate(30');
  });

  it('never rotates an arrow', () => {
    expect(supportsRotation(createPinnedArrow('a', 'e', 'b', 'w'))).toBe(false);
  });
});

// The box a boxed element is drawn in (docs/specs/008-canvas/canvas-and-palette.md "Rotation"): its
// corners turned about its centre, so the marquee judges what the person sees.
const bar = (rotation?: number, type = 'shape') =>
  ({
    id: 'b',
    type,
    shape: 'square',
    x: 20,
    y: 45,
    width: 60,
    height: 10,
    rotation,
  }) as BoxedElement;

describe('drawnBounds', () => {
  it('is the box itself when unrotated or turned a whole turn', () => {
    expect(drawnBounds(bar())).toEqual({ x: 20, y: 45, width: 60, height: 10 });
    expect(drawnBounds(bar(360))).toEqual({ x: 20, y: 45, width: 60, height: 10 });
  });

  it('stands a bar upright at 90 degrees', () => {
    const b = drawnBounds(bar(90));
    expect(b.x).toBeCloseTo(45);
    expect(b.y).toBeCloseTo(20);
    expect(b.width).toBeCloseTo(10);
    expect(b.height).toBeCloseTo(60);
  });

  it('widens to the turned corners at 45 degrees', () => {
    const b = drawnBounds(bar(45));
    const half = (60 + 10) / 2 / Math.SQRT2;
    expect(b.x).toBeCloseTo(50 - half);
    expect(b.width).toBeCloseTo(2 * half);
  });

  it('never turns an annotation marker, which does not rotate', () => {
    expect(drawnBounds(bar(90, 'annotation'))).toEqual({ x: 20, y: 45, width: 60, height: 10 });
  });
});
