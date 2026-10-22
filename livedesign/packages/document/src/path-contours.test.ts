import { describe, expect, it } from 'vitest';
import type { PathElement, PathNode } from './element-types';
import { isCompoundPath, pathContours, pathElementD, pathOfContours } from './path-element';
import { svgPathElementShape } from './svg-render-shapes';
import { elementValidationIssue } from './validate';
import { pathTouchesBrush } from './whiteboard-stroke';

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

  it('are picked by their filled band, not their hole', () => {
    expect(pathTouchesBrush(ring, { x: 10, y: 50 }, { x: 10, y: 50 }, 1)).toBe(true);
    expect(pathTouchesBrush(ring, { x: 50, y: 50 }, { x: 50, y: 50 }, 1)).toBe(false);
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
