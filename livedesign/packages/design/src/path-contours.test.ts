import { describe, expect, it } from 'vitest';
import type { PathElement, PathNode } from './element-types';
import {
  isCompoundPath,
  pathAnchors,
  pathContours,
  pathElementD,
  pathOfContours,
  pathWorldAnchors,
  reshapeContour,
} from './path-element';
import { svgPathElementShape } from './svg-render-shapes';
import { elementValidationIssue } from './validate';

// docs/specs/007-editor/logo-pages.md "Combine": a combined shape is a closed path of several
// contours, filled even-odd so its holes show through.
const square = (a: number, b: number): PathNode[] => [
  { nx: a, ny: a, mode: 'corner' },
  { nx: b, ny: a, mode: 'corner' },
  { nx: b, ny: b, mode: 'corner' },
  { nx: a, ny: b, mode: 'corner' },
];

const ring: PathElement = {
  id: 'r',
  type: 'path',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  closed: true,
  nodes: square(0, 1),
  subpaths: [square(0.25, 0.75)],
  fillColor: '#000000',
};

describe('combined paths', () => {
  it('list every contour and know they are combined', () => {
    expect(pathContours(ring)).toHaveLength(2);
    expect(isCompoundPath(ring)).toBe(true);
    const plain = { ...ring, subpaths: undefined };
    expect(pathContours(plain)).toHaveLength(1);
    expect(isCompoundPath(plain)).toBe(false);
  });

  it('draw every contour, even-odd', () => {
    expect(pathElementD(ring).match(/M /g)).toHaveLength(2);
    const svg = svgPathElementShape(ring, '#111111', '#000000');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('M 25 25');
  });

  it('validate: three nodes a closed contour, two an open one, within the node budget', () => {
    expect(elementValidationIssue(ring)).toBeNull();
    // An open path's contours are open lines, two nodes or more each.
    expect(elementValidationIssue({ ...ring, closed: false })).toBeNull();
    expect(
      elementValidationIssue({ ...ring, closed: false, subpaths: [square(0, 1).slice(0, 1)] })
        ?.field,
    ).toBe('subpaths');
    expect(elementValidationIssue({ ...ring, subpaths: [square(0, 1).slice(0, 2)] })?.field).toBe(
      'subpaths',
    );
    expect(elementValidationIssue({ ...ring, subpaths: 'no' })?.field).toBe('subpaths');
    const many = Array.from({ length: 2000 }, () => square(0.2, 0.3)[0]!);
    expect(elementValidationIssue({ ...ring, subpaths: [many, many, many] })?.field).toBe(
      'subpaths',
    );
  });
});

describe('pathOfContours', () => {
  it('wraps every contour in one box, each normalised to it', () => {
    const line = (x: number) => [
      { x, y: 0, mode: 'corner' as const },
      { x: x + 10, y: 20, mode: 'corner' as const },
    ];
    const p = pathOfContours({ id: 'p', type: 'path', closed: false }, [line(0), line(90)]);
    expect(p).toMatchObject({ x: 0, y: 0, width: 100, height: 20 });
    expect(p.nodes[1]).toMatchObject({ nx: 0.1, ny: 1 });
    expect(p.subpaths![0]![0]).toMatchObject({ nx: 0.9, ny: 0 });
  });
});

// docs/specs/023-draw-mode/path-tool.md "Combined paths": one contour edited at a time.
describe('reshapeContour', () => {
  const inner = (el: PathElement) => pathAnchors({ ...el, nodes: el.subpaths![0]! });

  it('reshapes one contour and keeps the others where they show', () => {
    const moved = inner(ring).map((a) => ({ ...a, x: a.x + 10 }));
    const next = reshapeContour(ring, 1, moved)!;
    expect(pathAnchors(next)).toEqual(pathAnchors(ring));
    expect(inner(next).map((a) => a.x)).toEqual(moved.map((a) => a.x));
  });

  it('grows the box when a contour reaches out of it', () => {
    const out = pathAnchors(ring).map((a) => ({ ...a, x: a.x * 2 }));
    const next = reshapeContour(ring, 0, out)!;
    expect(next.width).toBe(200);
    expect(inner(next)[0]).toMatchObject({ x: 25, y: 25 });
  });

  it('drops a contour left too small, and the path with the last one', () => {
    const next = reshapeContour(ring, 1, inner(ring).slice(0, 2))!;
    expect(isCompoundPath(next)).toBe(false);
    expect(next.subpaths).toBeUndefined();
    expect(reshapeContour(next, 0, pathAnchors(next).slice(0, 1))).toBeNull();
  });

  it('leaves the path alone for a contour that is gone', () => {
    expect(reshapeContour(ring, 5, [])).toBe(ring);
  });

  it('keeps a rotated path’s other contours in place', () => {
    const turned: PathElement = { ...ring, rotation: 30 };
    const before = pathWorldAnchors(turned, turned.subpaths![0]);
    const out = pathAnchors(turned).map((a) => ({ ...a, x: a.x - 40 }));
    const next = reshapeContour(turned, 0, out)!;
    const after = pathWorldAnchors(next, next.subpaths![0]);
    after.forEach((a, i) => {
      expect(a.x).toBeCloseTo(before[i]!.x, 6);
      expect(a.y).toBeCloseTo(before[i]!.y, 6);
    });
  });
});
