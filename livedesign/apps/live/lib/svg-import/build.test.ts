// docs/specs/020-import-export/svg-import.md "Geometry" and "Style": contours to path nodes, smooth nodes marked,
// three-node contours for subpaths, stroke presets and opacity.
import { describe, expect, it } from 'vitest';
import { isValidElement } from '@livedesign/design';
import { contourAnchors, drawnToPath, strokePreset, withThreeNodes } from './build';
import { parsePathData } from './path-data';

const contour = (d: string) => parsePathData(d)[0]!;
const fill = { hex: '#112233', alpha: 1 };

describe('contourAnchors', () => {
  it('marks smooth nodes aligned or mirrored and the rest corner', () => {
    const a = contourAnchors(contour('M0 0 C0 10 10 10 10 0 C10 -10 30 -20 20 0 L30 0'), false);
    // Node 1: handles (10,10) and (10,-10) point straight through (10,0) with equal length.
    expect(a[1]!.mode).toBe('mirrored');
    const b = contourAnchors(contour('M0 0 C0 10 10 10 10 0 C10 -20 30 -20 20 0'), false);
    expect(b[1]!.mode).toBe('aligned');
    const c = contourAnchors(contour('M0 0 C0 10 10 10 10 0 C20 0 30 -20 20 0'), false);
    expect(c[1]!.mode).toBe('corner');
    // Handles on the same side are a cusp, a corner.
    const d = contourAnchors(contour('M0 0 C0 10 10 10 10 0 C10 10 30 10 20 0'), false);
    expect(d[1]!.mode).toBe('corner');
  });

  it('omits a handle that sits on its node and folds a closing node into the start', () => {
    const a = contourAnchors(contour('M0 0 C0 0 10 10 10 0 C10 -10 0 -10 0 0 Z'), true);
    expect(a).toHaveLength(2);
    expect(a[0]!.handleOut).toBeUndefined();
    expect(a[0]!.handleIn).toEqual({ x: 0, y: -10 });
    // An open path keeps the closing node, so it still draws closed.
    expect(contourAnchors(contour('M0 0 L10 0 L10 10 Z'), false)).toHaveLength(4);
  });
});

describe('withThreeNodes', () => {
  it('splits a ring drawn as two arcs so it has three nodes', () => {
    const ring = contour('M0 50 C0 -16.67 100 -16.67 100 50 C100 116.67 0 116.67 0 50 Z');
    expect(ring.segments).toHaveLength(2);
    const split = withThreeNodes(ring);
    expect(split.segments).toHaveLength(3);
    // The split keeps the curve: the new node is on the circle.
    const mid = split.segments[0]!.to;
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(0, 0);
  });

  it('leaves straight lines alone and a three-segment contour as it is', () => {
    const line = contour('M0 0 L10 0 Z');
    expect(withThreeNodes(line).segments).toHaveLength(2);
    const tri = contour('M0 0 L10 0 L10 10 Z');
    expect(withThreeNodes(tri)).toEqual(tri);
  });
});

describe('strokePreset', () => {
  it('snaps to the nearest of the presets', () => {
    expect([0.2, 1.4, 2.6, 5, 6, 40].map(strokePreset)).toEqual([
      'thin',
      'thin',
      'medium',
      'thick',
      'extra-thick',
      'extra-thick',
    ]);
  });
});

describe('drawnToPath', () => {
  it('builds a valid compound path, a ring of two arcs included as a subpath', () => {
    const p = drawnToPath(
      {
        contours: parsePathData(
          'M0 0 H100 V100 H0 Z M25 50 A25 25 0 0 0 75 50 A25 25 0 0 0 25 50 Z',
        ),
        fill,
        stroke: { hex: '#ff0000', alpha: 0.5, width: 2 },
        fillRule: 'evenodd',
        opacity: 0.8,
      },
      'p1',
    )!;
    expect(isValidElement(p)).toBe(true);
    expect(p.subpaths![0]!.length).toBeGreaterThanOrEqual(3);
    expect(p).toMatchObject({
      fillColor: '#112233',
      strokeColor: '#ff0000',
      strokeWidth: 'medium',
      opacity: 0.8,
    });
  });

  it('takes the stroke alpha for opacity when unfilled, and drops contours too small to draw', () => {
    const p = drawnToPath(
      {
        contours: parsePathData('M0 0 L10 10 M20 20 L20 20'),
        fill: null,
        stroke: { hex: '#000000', alpha: 0.4, width: 1 },
        fillRule: 'nonzero',
        opacity: 1,
      },
      'p2',
    )!;
    expect(p.opacity).toBe(0.4);
    expect(p.subpaths).toBeUndefined();
    expect(
      drawnToPath(
        {
          contours: parsePathData('M0 0 L10 0 Z'),
          fill,
          stroke: null,
          fillRule: 'nonzero',
          opacity: 1,
        },
        'p3',
      ),
    ).toBeNull();
  });
});
