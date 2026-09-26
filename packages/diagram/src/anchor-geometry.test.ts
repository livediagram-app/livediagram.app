import { describe, expect, it } from 'vitest';
import {
  ALL_ANCHORS,
  anchorOutline,
  anchorPosition,
  bestAnchorTowards,
  exitSideTowards,
  pointInsideOutline,
  snapToAnchor,
  type ShapeElement,
} from './index';

const shape = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const close = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('sixteen anchor positions (docs/specs/008-canvas/arrow-anchors.md)', () => {
  it('places every anchor on a plain box at its fraction', () => {
    const box = shape({ x: 10, y: 20, width: 200, height: 80 });
    close(anchorPosition(box, 'nne'), 160, 20);
    close(anchorPosition(box, 'nnw'), 60, 20);
    close(anchorPosition(box, 'ene'), 210, 40);
    close(anchorPosition(box, 'ese'), 210, 80);
    close(anchorPosition(box, 'sse'), 160, 100);
    close(anchorPosition(box, 'ssw'), 60, 100);
    close(anchorPosition(box, 'wsw'), 10, 80);
    close(anchorPosition(box, 'wnw'), 10, 40);
  });

  it('projects a diamond quarter onto the slanted edge', () => {
    // Ray from the centre (50,50) through (25,0) meets the NW edge at (100/3, 100/6).
    close(anchorPosition(shape({ shape: 'diamond' }), 'nnw'), 100 / 3, 100 / 6);
  });

  it('projects a circle quarter onto the ellipse', () => {
    const c = shape({ shape: 'circle', width: 200, height: 100 });
    const p = anchorPosition(c, 'nne');
    expect(((p.x - 100) / 100) ** 2 + ((p.y - 50) / 50) ** 2).toBeCloseTo(1, 6);
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeLessThan(50);
  });

  it.each(['star', 'stadium', 'actor', 'triangle', 'hexagon'] as const)(
    'puts every %s anchor on its outline, never inside it',
    (kind) => {
      const el = shape({ shape: kind, width: 180, height: 120 });
      for (const a of ALL_ANCHORS) {
        const p = anchorPosition(el, a);
        expect(pointInsideOutline(el, p, 0.01), `${kind} ${a}`).toBe(false);
        // A point a hair towards the centre is inside: p is on the outline.
        const inward = { x: p.x + (90 - p.x) * 0.02, y: p.y + (60 - p.y) * 0.02 };
        expect(pointInsideOutline(el, inward, 0), `${kind} ${a} inward`).toBe(true);
      }
    },
  );

  it('keeps the actor corners on the figure rather than the empty box corner', () => {
    const actor = shape({ shape: 'actor', width: 90, height: 130 });
    const se = anchorPosition(actor, 'se');
    expect(se.x).toBeLessThan(80);
    close(anchorPosition(actor, 's'), 45, 130);
  });

  it('rotates a quarter with the element', () => {
    // 90deg clockwise: the top edge's east quarter (75,0) swings to (100,75).
    close(anchorPosition(shape({ rotation: 90 }), 'nne'), 100, 75);
  });

  it("pushes every anchor on a tech icon caption's side to the element edge", () => {
    const tech = shape({
      shape: 'icon',
      iconId: 'aws-ec2',
      width: 200,
      height: 100,
      label: 'EC2',
    });
    expect(anchorPosition(tech, 'ssw').y).toBe(100);
    expect(anchorPosition(tech, 's').y).toBe(100);
    expect(anchorPosition(tech, 'sse').y).toBe(100);
    expect(anchorPosition(tech, 'ese').y).toBeLessThan(100);
  });

  it('snaps an endpoint dragged near a quarter to it', () => {
    expect(snapToAnchor({ x: 76, y: -3 }, [shape()], 10)).toEqual({
      elementId: 's',
      anchor: 'nne',
    });
  });
});

describe('anchoring outlines', () => {
  it('has no outline for box-shaped kinds', () => {
    expect(anchorOutline(shape())).toBeNull();
    expect(anchorOutline(shape({ shape: 'cloud' }))).toBeNull();
  });

  it('tests inside a box with an inset', () => {
    const el = shape();
    expect(pointInsideOutline(el, { x: 50, y: 50 }, 2)).toBe(true);
    expect(pointInsideOutline(el, { x: 1, y: 50 }, 2)).toBe(false);
    expect(pointInsideOutline(el, { x: 150, y: 50 }, 0)).toBe(false);
  });

  it('tests inside an ellipse, rotated', () => {
    const el = shape({ shape: 'circle', width: 200, height: 50, rotation: 90 });
    // Rotated upright: centre (100,25), now 50 wide and 200 tall.
    expect(pointInsideOutline(el, { x: 100, y: 110 }, 2)).toBe(true);
    expect(pointInsideOutline(el, { x: 180, y: 25 }, 2)).toBe(false);
  });

  it('tests inside a polygon by the diamond edges', () => {
    const el = shape({ shape: 'diamond' });
    expect(pointInsideOutline(el, { x: 50, y: 50 }, 2)).toBe(true);
    expect(pointInsideOutline(el, { x: 10, y: 10 }, 0)).toBe(false);
  });
});

describe('creation anchor', () => {
  it('takes the middle of the side facing the target', () => {
    const el = shape();
    expect(bestAnchorTowards(el, { x: 400, y: 50 })).toBe('e');
    expect(bestAnchorTowards(el, { x: 50, y: -300 })).toBe('n');
    expect(bestAnchorTowards(el, { x: -300, y: 60 })).toBe('w');
    expect(bestAnchorTowards(el, { x: 60, y: 400 })).toBe('s');
  });

  it('is aspect-ratio aware', () => {
    const wide = shape({ width: 200, height: 20 });
    expect(exitSideTowards(wide, { x: 210, y: 110 })).toBe('s');
    const tall = shape({ width: 20, height: 200 });
    expect(exitSideTowards(tall, { x: 110, y: 210 })).toBe('e');
  });

  it('is rotation aware and has no side for a zero direction', () => {
    expect(exitSideTowards(shape({ rotation: 90 }), { x: 300, y: 50 })).toBe('n');
    expect(exitSideTowards(shape(), { x: 50, y: 50 })).toBeNull();
    expect(bestAnchorTowards(shape(), { x: 50, y: 50 })).toBe('e');
  });
});
