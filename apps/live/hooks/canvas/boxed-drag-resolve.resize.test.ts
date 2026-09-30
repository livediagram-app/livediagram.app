import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import type { DragMode, ShapeBounds } from '@/lib/canvas';
import { resolveBoxedResize } from './boxed-drag-resolve';

// The resize frame resolver under Shift (docs/specs/008-canvas/canvas-and-palette.md "Resize"): the
// ratio the element or selection had when the drag began survives every handle, the snap still
// applies on the leading axis, and a multi-selection scales uniformly.

const box = (id: string, x: number, y: number, width: number, height: number, extra = {}) =>
  ({ ...createShape('square', x, y), id, x, y, width, height, ...extra }) as Element;

const boundsOf = (els: Element[], ids: string[]) =>
  new Map<string, ShapeBounds>(
    els
      .filter((el) => ids.includes(el.id))
      .map((el) => {
        const b = el as unknown as ShapeBounds;
        return [el.id, { x: b.x, y: b.y, width: b.width, height: b.height }];
      }),
  );

function resize(
  elements: Element[],
  ids: string[],
  mode: DragMode,
  dx: number,
  dy: number,
  { shiftHeld = true, dragAspectLocked = false } = {},
) {
  const out = resolveBoxedResize({
    elements,
    startBounds: boundsOf(elements, ids),
    primaryId: ids[0]!,
    mode,
    dx,
    dy,
    shiftHeld,
    dragAspectLocked,
    guidesOn: true,
  });
  if (!out) throw new Error('resize did not resolve');
  return out;
}

const ratioOf = (b: ShapeBounds) => b.width / b.height;

describe('resolveBoxedResize, one element with Shift', () => {
  it('still snaps, on the leading axis, and keeps the ratio', () => {
    const elements = [box('a', 0, 0, 100, 50), box('wall', 300, 400, 80, 80)];
    const next = resize(elements, ['a'], 'resize-se', 197, 20).boundsById.get('a')!;
    expect(next).toEqual({ x: 0, y: 0, width: 300, height: 150 });
  });

  it('draws the guide for the edge the snap lined up', () => {
    const elements = [box('a', 0, 0, 100, 50), box('wall', 300, 400, 80, 80)];
    const { guides } = resize(elements, ['a'], 'resize-se', 197, 20);
    expect(guides).toContainEqual(expect.objectContaining({ axis: 'x', position: 300 }));
  });

  it('snaps nothing when no neighbour is in reach', () => {
    const elements = [box('a', 0, 0, 100, 50)];
    const next = resize(elements, ['a'], 'resize-se', 197, 20).boundsById.get('a')!;
    expect(next).toEqual({ x: 0, y: 0, width: 297, height: 148.5 });
  });

  it.each(['resize-n', 'resize-e', 'resize-s', 'resize-w'] as const)(
    'keeps the ratio from the %s edge handle',
    (mode) => {
      const elements = [box('a', 0, 0, 100, 50)];
      const next = resize(elements, ['a'], mode, 30, 30).boundsById.get('a')!;
      expect(ratioOf(next)).toBeCloseTo(2);
      expect(next.width).not.toBe(100);
    },
  );

  it('keeps the ratio of an aspect-locked element from an edge handle, Shift or not', () => {
    const elements = [box('a', 0, 0, 100, 50)];
    const next = resize(elements, ['a'], 'resize-e', 50, 0, {
      shiftHeld: false,
      dragAspectLocked: true,
    }).boundsById.get('a')!;
    expect(next).toEqual({ x: 0, y: -12.5, width: 150, height: 75 });
  });

  it('keeps the ratio of a rotated element from an edge handle', () => {
    const elements = [box('a', 0, 0, 100, 50, { rotation: 30 })];
    const next = resize(elements, ['a'], 'resize-e', 40, 10).boundsById.get('a')!;
    expect(ratioOf(next)).toBeCloseTo(2);
    expect(next.width).toBeGreaterThan(100);
  });

  it('keeps the ratio of a rotated element from a corner handle', () => {
    const elements = [box('a', 0, 0, 100, 50, { rotation: 45 })];
    const next = resize(elements, ['a'], 'resize-se', 60, -5).boundsById.get('a')!;
    expect(ratioOf(next)).toBeCloseTo(2);
  });
});

describe('resolveBoxedResize, a multi-selection with Shift', () => {
  const pair = () => [box('a', 0, 0, 100, 50), box('b', 200, 0, 50, 100)];

  it('scales the union uniformly, every member with it', () => {
    const out = resize(pair(), ['a', 'b'], 'resize-se', 250, 10).boundsById;
    expect(out.get('a')).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(out.get('b')).toEqual({ x: 400, y: 0, width: 100, height: 200 });
  });

  it('keeps every member’s ratio through a hard shrink', () => {
    const out = resize(pair(), ['a', 'b'], 'resize-se', -240, -95).boundsById;
    expect(ratioOf(out.get('a')!)).toBeCloseTo(2);
    expect(ratioOf(out.get('b')!)).toBeCloseTo(0.5);
    // The shrink stops where a member's shorter side reaches the minimum.
    expect(out.get('a')!.height).toBeCloseTo(20);
  });

  it('keeps the anchored corner where it is', () => {
    const out = resize(pair(), ['a', 'b'], 'resize-nw', -50, 0).boundsById;
    const b = out.get('b')!;
    expect(b.x + b.width).toBeCloseTo(250);
    expect(b.y + b.height).toBeCloseTo(100);
  });

  it('scales freely without Shift', () => {
    const out = resize(pair(), ['a', 'b'], 'resize-se', 250, 0, { shiftHeld: false }).boundsById;
    expect(out.get('a')).toEqual({ x: 0, y: 0, width: 200, height: 50 });
  });
});
