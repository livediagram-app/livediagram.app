import { describe, expect, it, vi } from 'vitest';
import {
  ALL_ANCHORS,
  anchorOutline,
  anchorPosition,
  bestAnchorTowards,
  exitSideTowards,
  facingSideTowards,
  nearestOfferedAnchor,
  offeredAnchors,
  pointInsideOutline,
  sampleSvgPath,
  type Anchor,
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

  it.each([
    'stadium',
    'actor',
    'triangle',
    'hexagon',
    'parallelogram',
    'trapezoid',
    'cylinder',
  ] as const)('puts every %s anchor on its outline, never inside it', (kind) => {
    const el = shape({ shape: kind, width: 180, height: 120 });
    for (const a of offeredAnchors(el)) {
      const p = anchorPosition(el, a);
      expect(pointInsideOutline(el, p, 0.01), `${kind} ${a}`).toBe(false);
      // A point a hair towards the centre is inside: p is on the outline.
      const inward = { x: p.x + (90 - p.x) * 0.02, y: p.y + (60 - p.y) * 0.02 };
      expect(pointInsideOutline(el, inward, 0), `${kind} ${a} inward`).toBe(true);
    }
  });

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
    expect(anchorOutline(shape({ shape: 'star' }))).toBeNull();
    expect(anchorOutline(shape({ shape: 'speech-bubble' }))).toBeNull();
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

describe('anchor sets in snapping and outlines', () => {
  it('never snaps a circle to a quarter it does not offer', () => {
    const c = shape({ shape: 'circle' });
    const nne = anchorPosition(shape(), 'nne');
    expect(snapToAnchor(nne, [c], 30)?.anchor).not.toBe('nne');
  });

  it.each(['cloud', 'document'] as const)('puts every %s anchor on its drawn path', (kind) => {
    const el = shape({ shape: kind, width: 180, height: 120 });
    expect(anchorOutline(el)?.kind).toBe('polygon');
    for (const a of ALL_ANCHORS) {
      const p = anchorPosition(el, a);
      expect(pointInsideOutline(el, p, 0.01), `${kind} ${a}`).toBe(false);
      const inward = { x: p.x + (90 - p.x) * 0.02, y: p.y + (60 - p.y) * 0.02 };
      expect(pointInsideOutline(el, inward, 0), `${kind} ${a} inward`).toBe(true);
    }
  });

  it("follows the document's wavy bottom and the cloud's top bump", () => {
    const doc = shape({ shape: 'document' });
    // Between the waves the bottom edge rises well above the box bottom.
    expect(anchorPosition(doc, 's').y).toBeLessThan(97);
    expect(anchorPosition(shape({ shape: 'cloud' }), 'n').y).toBeLessThan(2);
  });

  it('samples an absolute M/L/C/Z path and rejects other commands', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(sampleSvgPath('M 0 0 L 10 0 C 10 5, 5 10, 0 10 Z', 4)).toHaveLength(6);
    expect(sampleSvgPath('M 0 0 A 5 5 0 0 1 10 0 Z')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[shape-outline] unsupported path command=A');
    warn.mockRestore();
  });
});

describe('face-placed anchors (docs/specs/008-canvas/arrow-anchors.md "Anchors per shape")', () => {
  const at = (kind: ShapeElement['shape'], a: Anchor) => {
    const p = anchorPosition(shape({ shape: kind }), a);
    return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
  };

  it("puts a parallelogram's corners on its corners and quarters halfway to the nearer corner", () => {
    expect(at('parallelogram', 'nw')).toEqual([20, 0]);
    expect(at('parallelogram', 'n')).toEqual([50, 0]);
    expect(at('parallelogram', 'nnw')).toEqual([35, 0]);
    expect(at('parallelogram', 'nne')).toEqual([75, 0]);
    expect(at('parallelogram', 'sse')).toEqual([65, 100]);
    expect(at('parallelogram', 'ssw')).toEqual([25, 100]);
    expect(at('parallelogram', 'ene')).toEqual([95, 25]);
  });

  it('does the same on a trapezoid', () => {
    expect(at('trapezoid', 'ne')).toEqual([78, 4]);
    expect(at('trapezoid', 'nnw')).toEqual([36, 4]);
    expect(at('trapezoid', 'sse')).toEqual([74, 96]);
    expect(at('trapezoid', 'e')).toEqual([88, 50]);
  });

  it('gives a hexagon three on top and splits its slanted faces into thirds', () => {
    expect(at('hexagon', 'nnw')).toEqual([37.5, 0]);
    expect(at('hexagon', 'nne')).toEqual([62.5, 0]);
    expect(at('hexagon', 'ne')).toEqual([83.33, 16.67]);
    expect(at('hexagon', 'ene')).toEqual([91.67, 33.33]);
    expect(at('hexagon', 'e')).toEqual([100, 50]);
    expect(at('hexagon', 'sw')).toEqual([16.67, 83.33]);
    expect(at('hexagon', 'wsw')).toEqual([8.33, 66.67]);
  });

  it('gives a triangle a middle and two quarters on each face', () => {
    expect(at('triangle', 'w')).toEqual([26, 50]);
    expect(at('triangle', 'wnw')).toEqual([38, 26]);
    expect(at('triangle', 'wsw')).toEqual([14, 74]);
    expect(at('triangle', 'ene')).toEqual([62, 26]);
    expect(at('triangle', 's')).toEqual([50, 98]);
    expect(at('triangle', 'sse')).toEqual([74, 98]);
  });

  it('keeps a star on its bounding rectangle and a cylinder on its curved caps', () => {
    expect(at('star', 'ne')).toEqual([100, 0]);
    expect(at('star', 'nne')).toEqual([75, 0]);
    expect(at('cylinder', 'n')[1]).toBeCloseTo(3, 1);
    expect(at('cylinder', 's')[1]).toBeCloseTo(97, 1);
  });

  it('faces a triangle away from its anchorless top and never creates an arrow there', () => {
    const tri = shape({ shape: 'triangle' });
    expect(facingSideTowards(tri, { x: 50, y: -300 })).not.toBe('n');
    expect(facingSideTowards(tri, { x: 20, y: -300 })).toBe('w');
    expect(bestAnchorTowards(tri, { x: 60, y: -300 })).toBe('e');
    expect(nearestOfferedAnchor(tri, 'n')).toBe('ene');
    expect(nearestOfferedAnchor(shape(), 'n')).toBe('n');
  });
});

describe('anchor fallback logging', () => {
  it('logs a quick-connect remap and a creation side fallback, never the plain case', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const tri = shape({ id: 't', shape: 'triangle' });
    nearestOfferedAnchor(tri, 'n');
    expect(debug).toHaveBeenCalledWith('[arrow-anchors] remap element=t n->ene');
    bestAnchorTowards(tri, { x: 60, y: -300 });
    expect(debug).toHaveBeenCalledWith('[arrow-anchors] creation element=t side=e fallback=side');
    debug.mockClear();
    nearestOfferedAnchor(shape(), 'n');
    bestAnchorTowards(shape(), { x: 400, y: 50 });
    expect(debug).not.toHaveBeenCalled();
    debug.mockRestore();
  });
});
