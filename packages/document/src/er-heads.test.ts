import { describe, expect, it } from 'vitest';
import { arrowheadStartShapeOf, ARROWHEAD_SHAPES } from './arrow-style';
import { ER_GLYPHS, isErShape } from './er-heads';
import { svgArrow, svgArrowhead } from './svg-render-arrows';
import type { ArrowElement, Element } from './index';

// The ER ends (docs/specs/008-canvas/canvas-and-palette.md "Arrowhead shape").

describe('ER ends', () => {
  it('offers five ER ends among the arrowhead shapes', () => {
    expect(ARROWHEAD_SHAPES.filter(isErShape)).toEqual([
      'one',
      'zero-or-one',
      'many',
      'zero-or-many',
      'one-or-many',
    ]);
    expect(isErShape('triangle')).toBe(false);
  });

  it('draws each as its strokes in the export, a ring hollow on the paper', () => {
    for (const shape of ARROWHEAD_SHAPES.filter(isErShape)) {
      const svg = svgArrowhead({ x: 0, y: 0 }, { x: 100, y: 0 }, '#123456', shape, 6, '#fafafa');
      expect(svg.match(/<polyline/g)?.length ?? 0).toBe(ER_GLYPHS[shape].lines.length);
      expect(svg.match(/<circle/g)?.length ?? 0).toBe(ER_GLYPHS[shape].rings.length);
      expect(svg).toContain('stroke="#123456"');
      if (ER_GLYPHS[shape].rings.length) expect(svg).toContain('fill="#fafafa"');
    }
  });

  it('lays a glyph along the line: a crow at a right-going end spreads at the table', () => {
    const svg = svgArrowhead({ x: 0, y: 0 }, { x: 100, y: 0 }, '#000', 'many', 6);
    const xs = [...svg.matchAll(/points="([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)"/g)].map((m) =>
      Number(m[3]),
    );
    // Each prong ends at the table (x = 100).
    expect(xs.every((x) => Math.abs(x - 100) < 0.01)).toBe(true);
  });

  it("draws an arrow's start in its own shape when it differs", () => {
    const boxes: Element[] = [
      { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 } as Element,
      { id: 'b', type: 'shape', shape: 'square', x: 300, y: 0, width: 100, height: 60 } as Element,
    ];
    const arrow: ArrowElement = {
      id: 'r',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
      arrowEnds: 'both',
      arrowheadShape: 'many',
      arrowheadStartShape: 'one',
    };
    expect(arrowheadStartShapeOf(arrow)).toBe('one');
    expect(arrowheadStartShapeOf({ ...arrow, arrowheadStartShape: undefined })).toBe('many');
    const svg = svgArrow(arrow, [...boxes, arrow]);
    // A crow's three prongs at one end, two bars at the other.
    expect(svg.match(/<polyline points/g)?.length).toBe(5);
    // Sketched, the heads are still drawn exactly when they differ.
    const sketched = svgArrow({ ...arrow, finish: 'sketch' } as ArrowElement, [...boxes, arrow]);
    expect(sketched.match(/<polyline points/g)?.length).toBe(5);
  });
});
