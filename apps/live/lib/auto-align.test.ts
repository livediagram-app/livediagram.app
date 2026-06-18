import type { ArrowElement, ShapeElement, StickyElement, TextElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { AUTO_ALIGN_GRID, autoAlignElement, autoAlignElements } from './auto-align';
import { MIN_SIZE } from './canvas';

const square = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  ...overrides,
});

const arrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 100 },
  ...overrides,
});

describe('autoAlignElement', () => {
  it(`snaps position and size to the ${AUTO_ALIGN_GRID}px grid`, () => {
    const out = autoAlignElement(square({ x: 13, y: 27, width: 97, height: 52 })) as ShapeElement;
    expect(out.x).toBe(10);
    expect(out.y).toBe(30);
    expect(out.width).toBe(100);
    expect(out.height).toBe(50);
  });

  it('rounds half-step values to the nearest grid line', () => {
    const out = autoAlignElement(square({ x: 15, y: 25 })) as ShapeElement;
    // 15 rounds to 20 (banker's would be 10 or 20 depending on impl,
    // Math.round goes up at 0.5), 25 -> 30. Either way the result is
    // a multiple of the grid step.
    expect(out.x % AUTO_ALIGN_GRID).toBe(0);
    expect(out.y % AUTO_ALIGN_GRID).toBe(0);
  });

  it('keeps circles square by snapping to the larger side', () => {
    const out = autoAlignElement(
      square({ shape: 'circle', width: 97, height: 52 }),
    ) as ShapeElement;
    // 97 -> 100, 52 -> 50; larger side wins so both become 100.
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
  });

  it('keeps diamonds square the same way', () => {
    const out = autoAlignElement(
      square({ shape: 'diamond', width: 43, height: 100 }),
    ) as ShapeElement;
    // 43 -> 40, 100 -> 100; larger side wins.
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
  });

  it('preserves an explicit aspect-lock by anchoring on the larger axis change', () => {
    // 200 x 100 = 2:1 ratio. Snap target on the user-set width (197)
    // would land at 200 (no change); height (100) is already exact.
    // The aspect-lock branch should keep the height in sync.
    const out = autoAlignElement(
      square({ aspectLocked: true, width: 197, height: 100 }),
    ) as ShapeElement;
    expect(out.width).toBe(200);
    expect(out.height).toBe(100);
  });

  it('floors width and height at MIN_SIZE so a tiny shape never collapses below the grab threshold', () => {
    const out = autoAlignElement(square({ width: 2, height: 3 })) as ShapeElement;
    expect(out.width).toBeGreaterThanOrEqual(MIN_SIZE);
    expect(out.height).toBeGreaterThanOrEqual(MIN_SIZE);
  });

  it('snaps free arrow endpoints but leaves pinned ones attached', () => {
    const a = arrow({
      from: { kind: 'free', x: 13, y: 27 },
      to: { kind: 'pinned', elementId: 'el-2', anchor: 'n' },
    });
    const out = autoAlignElement(a) as ArrowElement;
    expect(out.from).toEqual({ kind: 'free', x: 10, y: 30 });
    // Pinned endpoint is returned by reference (no work needed,
    // follows the target element's snap).
    expect(out.to).toEqual({ kind: 'pinned', elementId: 'el-2', anchor: 'n' });
  });

  it('leaves text + sticky elements snapped on the grid same as shapes', () => {
    const t: TextElement = {
      id: 't',
      type: 'text',
      x: 13,
      y: 27,
      width: 97,
      height: 32,
      label: 'hi',
    };
    const out = autoAlignElement(t) as TextElement;
    expect(out.x).toBe(10);
    expect(out.y).toBe(30);
    expect(out.width).toBe(100);
    expect(out.height).toBe(30);
    const n: StickyElement = { id: 'n', type: 'sticky', x: 13, y: 27, width: 199, height: 201 };
    const outN = autoAlignElement(n) as StickyElement;
    expect(outN.x).toBe(10);
    expect(outN.width).toBe(200);
    expect(outN.height).toBe(200);
  });

  it('is idempotent (running auto-align twice gives the same result as once)', () => {
    const once = autoAlignElement(square({ x: 13, y: 27, width: 97, height: 52 }));
    const twice = autoAlignElement(once);
    expect(twice).toEqual(once);
  });
});

describe('autoAlignElements', () => {
  it('returns a new array with the same length as the input', () => {
    const input = [square({ id: 'a' }), arrow({ id: 'b' })];
    const out = autoAlignElements(input);
    expect(out).toHaveLength(input.length);
  });

  it('passes each element through autoAlignElement', () => {
    const sq = square({ x: 13, y: 27 });
    const ar = arrow({ from: { kind: 'free', x: 13, y: 27 } });
    const out = autoAlignElements([sq, ar]);
    expect((out[0] as ShapeElement).x).toBe(10);
    expect(((out[1] as ArrowElement).from as { x: number; y: number }).x).toBe(10);
  });

  it('snaps each element independently without resizing relative to neighbours', () => {
    // Two squares of deliberately different widths stay their own (grid-
    // snapped) size — Auto-align never homogenises sizes (that overreach is
    // gone; structural work is Auto Layout's job).
    const out = autoAlignElements([
      square({ id: 'a', x: 0, y: 0, width: 100, height: 50 }),
      square({ id: 'b', x: 0, y: 200, width: 120, height: 50 }),
    ]);
    expect((out[0] as ShapeElement).width).toBe(100);
    expect((out[1] as ShapeElement).width).toBe(120);
  });

  it('never moves an element more than half a grid step', () => {
    // A 15px-drifted element snaps to its OWN nearest grid line (20), it is
    // not pulled across a gap onto a neighbour's column.
    const out = autoAlignElements([
      square({ id: 'a', x: 0, y: 0, width: 100, height: 50 }),
      square({ id: 'b', x: 15, y: 200, width: 100, height: 50 }),
    ]);
    expect((out[0] as ShapeElement).x).toBe(0);
    expect((out[1] as ShapeElement).x).toBe(20);
  });

  it('is idempotent (running it twice matches once)', () => {
    const input = [
      square({ id: 'a', x: 0, y: 0, width: 100, height: 50 }),
      square({ id: 'b', x: 15, y: 200, width: 120, height: 50 }),
    ];
    const once = autoAlignElements(input);
    expect(autoAlignElements(once)).toEqual(once);
  });
});
