import { describe, expect, it } from 'vitest';
import {
  arrowPolyline,
  buildElementIndex,
  pathPassesThrough,
  pathsCross,
  type ArrowElement,
  type ShapeElement,
} from './index';

const box = (id: string, x = 0, y = 0, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
  ...extra,
});

describe('pathPassesThrough (docs/specs/008-canvas/arrow-anchors.md "The trigger")', () => {
  const a = box('a');

  it('sees a straight path through the shape', () => {
    expect(
      pathPassesThrough(
        [
          { x: 100, y: 50 },
          { x: -200, y: 50 },
        ],
        a,
      ),
    ).toBe(true);
  });

  it('ignores a path leaving the shape', () => {
    expect(
      pathPassesThrough(
        [
          { x: 100, y: 50 },
          { x: 300, y: 50 },
        ],
        a,
      ),
    ).toBe(false);
  });

  it('ignores a path grazing an edge within the tolerance', () => {
    expect(
      pathPassesThrough(
        [
          { x: 0, y: 1 },
          { x: 100, y: 1 },
        ],
        a,
      ),
    ).toBe(false);
    expect(
      pathPassesThrough(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        a,
      ),
    ).toBe(false);
  });

  it('sees a path that only clips a corner deeply', () => {
    expect(
      pathPassesThrough(
        [
          { x: 70, y: -20 },
          { x: 120, y: 30 },
        ],
        a,
      ),
    ).toBe(true);
  });

  it('tests against the drawn outline, rotated', () => {
    const d = box('d', 0, 0, { shape: 'diamond' });
    // Through the empty bounding-box corner, clear of the diamond itself.
    expect(
      pathPassesThrough(
        [
          { x: 0, y: 20 },
          { x: 20, y: 0 },
        ],
        d,
      ),
    ).toBe(false);
    const spun = box('s', 0, 0, { width: 200, height: 20, rotation: 90 });
    // Upright now: x 90..110, y -90..110.
    expect(
      pathPassesThrough(
        [
          { x: 60, y: -50 },
          { x: 140, y: -50 },
        ],
        spun,
      ),
    ).toBe(true);
    expect(
      pathPassesThrough(
        [
          { x: 0, y: 5 },
          { x: 60, y: 5 },
        ],
        spun,
      ),
    ).toBe(false);
  });

  it('follows curved and angled arrows, not their chords', () => {
    const b = box('b', 300, 0);
    const curved: ArrowElement = {
      id: 'c',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 's' },
      to: { kind: 'pinned', elementId: 'b', anchor: 's' },
      arrowStyle: 'curved',
      curveOffset: { dx: 0, dy: -100 },
    };
    const index = buildElementIndex([a, b, curved]);
    expect(pathPassesThrough(arrowPolyline(curved, index), a)).toBe(true);
    const straight = { ...curved, arrowStyle: 'straight' as const };
    expect(pathPassesThrough(arrowPolyline(straight, index), a)).toBe(false);
    const angled: ArrowElement = {
      id: 'g',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'n' },
      to: { kind: 'free', x: 300, y: 350 },
      arrowStyle: 'angled',
    };
    expect(pathPassesThrough(arrowPolyline(angled, index), a)).toBe(true);
  });
});

describe('pathsCross', () => {
  it('sees two paths crossing', () => {
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        [
          { x: 100, y: 0 },
          { x: 0, y: 100 },
        ],
      ),
    ).toBe(true);
  });

  it('does not count paths meeting at an end point', () => {
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        [
          { x: 200, y: 0 },
          { x: 100, y: 100 },
        ],
      ),
    ).toBe(false);
  });

  it('does not count collinear overlap or disjoint paths', () => {
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [
          { x: 50, y: 0 },
          { x: 150, y: 0 },
        ],
      ),
    ).toBe(false);
    expect(
      pathsCross(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      ),
    ).toBe(false);
  });
});
