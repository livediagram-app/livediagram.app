import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import type { FreehandElement } from './index';
import {
  eraseStrokePart,
  freehandAbsolutePoints,
  pathTouchesBrush,
  strokeTouchesBrush,
} from './whiteboard-stroke';
import { createPath } from './path-element';

// A horizontal stroke from (0, 100) to (200, 100), 4px wide.
const line = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  ...createFreehand(
    [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ],
    false,
  ),
  id: 'line',
  penWidth: 4,
  ...over,
});

let n = 0;
const mint = () => `piece-${++n}`;

const xs = (el: FreehandElement) => freehandAbsolutePoints(el).map((p) => Math.round(p.x));

describe('freehandAbsolutePoints', () => {
  it('maps normalised points back onto the canvas', () => {
    const pts = freehandAbsolutePoints(line());
    expect(pts[0]!.x).toBeCloseTo(0, 5);
    expect(pts[0]!.y).toBeCloseTo(100, 5);
    expect(pts[1]!.x).toBeCloseTo(200, 5);
  });

  it('bakes a rotation in, about the centre', () => {
    const pts = freehandAbsolutePoints(line({ rotation: 90 }));
    // A horizontal line turned a quarter becomes vertical through the centre.
    expect(pts[0]!.x).toBeCloseTo(pts[1]!.x, 3);
    expect(Math.abs(pts[0]!.y - pts[1]!.y)).toBeCloseTo(200, 0);
  });
});

describe('strokeTouchesBrush', () => {
  it('is touched where the ink is', () => {
    expect(strokeTouchesBrush(line(), { x: 100, y: 108 }, { x: 100, y: 108 }, 8)).toBe(true);
  });

  it('is not touched inside its bounding box but away from the ink', () => {
    const diagonal = {
      ...createFreehand(
        [
          { x: 0, y: 0 },
          { x: 200, y: 200 },
        ],
        false,
      ),
      penWidth: 4,
    };
    expect(strokeTouchesBrush(diagonal, { x: 180, y: 20 }, { x: 180, y: 20 }, 8)).toBe(false);
  });

  it('is touched by a fast swipe that crosses it between two samples', () => {
    expect(strokeTouchesBrush(line(), { x: 100, y: 50 }, { x: 100, y: 150 }, 2)).toBe(true);
  });
});

describe('eraseStrokePart', () => {
  it('returns null when the brush misses the stroke', () => {
    expect(eraseStrokePart(line(), { x: 100, y: 150 }, { x: 100, y: 150 }, 10, mint)).toBeNull();
  });

  it('splits a stroke into the pieces either side of the brush', () => {
    const pieces = eraseStrokePart(line(), { x: 100, y: 100 }, { x: 100, y: 100 }, 10, mint)!;
    expect(pieces).toHaveLength(2);
    const [left, right] = pieces;
    expect(xs(left!)[0]).toBe(0);
    // The ink edge is brush radius plus half the pen width from the centre.
    expect(Math.max(...xs(left!))).toBeGreaterThanOrEqual(87);
    expect(Math.max(...xs(left!))).toBeLessThanOrEqual(88);
    expect(Math.min(...xs(right!))).toBeGreaterThanOrEqual(112);
    expect(Math.min(...xs(right!))).toBeLessThanOrEqual(113);
    expect(Math.max(...xs(right!))).toBe(200);
  });

  it('keeps the colour, width and layer, with fresh ids', () => {
    const src = line({ strokeColor: '#e11d48', layerId: 'L1', opacity: 0.8 });
    const pieces = eraseStrokePart(src, { x: 100, y: 100 }, { x: 100, y: 100 }, 10, mint)!;
    for (const p of pieces) {
      expect(p).toMatchObject({ strokeColor: '#e11d48', penWidth: 4, layerId: 'L1', opacity: 0.8 });
      expect(p.closed).toBe(false);
      expect(p.id).not.toBe('line');
    }
  });

  it('keeps a pressure for every point of each piece, interpolated, and the streamline', () => {
    // docs/specs/023-whiteboard/whiteboard.md "Pens": a pen stroke's ink survives a partial erase.
    const src = line({ pressures: [0.2, 1], streamline: 0.2 });
    const pieces = eraseStrokePart(src, { x: 100, y: 100 }, { x: 100, y: 100 }, 10, mint)!;
    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      expect(piece.streamline).toBe(0.2);
      expect(piece.pressures).toHaveLength(piece.points.length);
      const xsOf = freehandAbsolutePoints(piece);
      piece.pressures!.forEach((p, i) => expect(p).toBeCloseTo(0.2 + (0.8 * xsOf[i]!.x) / 200, 6));
    }
  });

  it('leaves a stroke without pressures without them', () => {
    const pieces = eraseStrokePart(line(), { x: 100, y: 100 }, { x: 100, y: 100 }, 10, mint)!;
    for (const piece of pieces) expect(piece.pressures).toBeUndefined();
  });

  it('gives the longest piece the annotations', () => {
    const src = line({
      label: 'note',
      link: { kind: 'url', url: 'https://x.test' },
    } as Partial<FreehandElement>);
    const pieces = eraseStrokePart(src, { x: 40, y: 100 }, { x: 40, y: 100 }, 10, mint)!;
    const [short, long] = pieces;
    expect(short!.label).toBeUndefined();
    expect(long!.label).toBe('note');
  });

  it('removes the whole stroke when the brush covers it', () => {
    const tiny = {
      ...createFreehand(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
        false,
      ),
      penWidth: 2,
    };
    expect(eraseStrokePart(tiny, { x: 2, y: 0 }, { x: 2, y: 0 }, 20, mint)).toEqual([]);
  });

  it('erases along the path between two samples', () => {
    const pieces = eraseStrokePart(line(), { x: 60, y: 100 }, { x: 140, y: 100 }, 5, mint)!;
    expect(pieces).toHaveLength(2);
    expect(Math.max(...xs(pieces[0]!))).toBeLessThanOrEqual(53);
    expect(Math.min(...xs(pieces[1]!))).toBeGreaterThanOrEqual(147);
  });

  it('joins the run that wraps round a closed stroke', () => {
    const square = {
      ...createFreehand(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 },
        ],
        true,
      ),
      penWidth: 2,
    };
    // Cut the middle of the right-hand side: one open piece remains.
    const pieces = eraseStrokePart(square, { x: 100, y: 50 }, { x: 100, y: 50 }, 5, mint)!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.closed).toBe(false);
  });
});

describe('pathTouchesBrush (docs/specs/023-whiteboard/path-tool.md "Selecting and erasing")', () => {
  const arch = createPath(
    [
      { x: 0, y: 100, mode: 'corner', handleOut: { x: 0, y: 0 } },
      { x: 200, y: 100, mode: 'corner', handleIn: { x: 200, y: 0 } },
      { x: 200, y: 200, mode: 'corner' },
    ],
    true,
  );

  it('is touched on its curve, not on its bare box', () => {
    // The arch peaks at y = 25 in the middle.
    expect(pathTouchesBrush(arch, { x: 100, y: 20 }, { x: 100, y: 20 }, 8)).toBe(true);
    expect(pathTouchesBrush(arch, { x: 100, y: 60 }, { x: 100, y: 60 }, 8)).toBe(false);
  });

  it('is touched anywhere inside when closed and filled', () => {
    const filled = { ...arch, fillColor: '#ff0000' };
    expect(pathTouchesBrush(filled, { x: 100, y: 60 }, { x: 100, y: 60 }, 8)).toBe(true);
    expect(
      pathTouchesBrush(
        { ...arch, fillColor: 'transparent' },
        { x: 100, y: 60 },
        { x: 100, y: 60 },
        8,
      ),
    ).toBe(false);
  });

  it('catches a fast swipe across it', () => {
    expect(pathTouchesBrush(arch, { x: 100, y: -50 }, { x: 100, y: 60 }, 2)).toBe(true);
  });
});
