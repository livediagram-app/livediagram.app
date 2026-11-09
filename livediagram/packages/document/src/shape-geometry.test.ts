import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import {
  BROWSER_CHROME,
  browserChromeLayout,
  DIAMOND_POINTS,
  SHAPE_GEOMETRY_KINDS,
  shapeGeometry,
  type ShapePart,
} from './shape-geometry';
import { scaledPolygonPoints } from './svg-render-shapes';
import { boxFit, fitShapePart } from './svg-shape-fit';
import { SHAPE_KINDS } from './validate';
import type { ShapeKind, Tab } from './index';

// The geometry table is the one copy of every drawn silhouette (the canvas
// overlays read it in apps/editor, the headless render reads it here). These
// pin the export side to it, so a path edited in one renderer instead of the
// table shows up as a failure rather than as a quiet drift.

const tabOf = (elements: unknown[]) => ({ id: 't', name: 'Tab', elements }) as unknown as Tab;
const shapeAt = (shape: ShapeKind, o: Record<string, unknown> = {}) => ({
  id: 's',
  type: 'shape',
  shape,
  x: 10,
  y: 20,
  width: 160,
  height: 100,
  ...o,
});

// The geometry of a part as it appears in the string emitter's markup.
function partMark(part: ShapePart): string {
  const n = (v: number) => String(Math.round(v * 100) / 100);
  switch (part.tag) {
    case 'path':
      return `<path d="${part.d}"`;
    case 'polygon':
      return `<polygon points="${part.points}"`;
    case 'rect':
      return (
        `<rect x="${n(part.x)}" y="${n(part.y)}" width="${n(part.width)}" height="${n(part.height)}"` +
        (part.rx !== undefined ? ` rx="${n(part.rx)}"` : '') +
        (part.ry !== undefined ? ` ry="${n(part.ry)}"` : '')
      );
    case 'ellipse':
      return `<ellipse cx="${n(part.cx)}" cy="${n(part.cy)}" rx="${n(part.rx)}" ry="${n(part.ry)}"`;
    case 'circle':
      return `<circle cx="${n(part.cx)}" cy="${n(part.cy)}" r="${n(part.r)}"`;
  }
}

describe('the shape geometry table', () => {
  it('only names real shape kinds', () => {
    for (const kind of SHAPE_GEOMETRY_KINDS) expect(SHAPE_KINDS.has(kind)).toBe(true);
  });

  it.each(SHAPE_GEOMETRY_KINDS.filter((k) => k !== 'diamond'))(
    'the export draws exactly the table geometry for %s',
    (kind) => {
      const svg = renderElementsToSvg(tabOf([shapeAt(kind)]));
      const geometry = shapeGeometry(kind, 160 / 100)!;
      // A stroke-inside kind lands in the box inset by half the medium (2px) stroke.
      const box = geometry.strokeInside
        ? { x: 11, y: 21, width: 158, height: 98 }
        : { x: 10, y: 20, width: 160, height: 100 };
      const fit = boxFit(geometry, box);
      for (const part of geometry.parts) expect(svg).toContain(partMark(fitShapePart(part, fit)));
      // Mapped into the box, never a stretched viewBox: resvg (the MCP
      // preview) ignores non-scaling-stroke and would scale the border.
      expect(svg).not.toContain('preserveAspectRatio="none"');
    },
  );

  it('keeps the stroke inside the box for every shape drawn to its edge', () => {
    expect(SHAPE_GEOMETRY_KINDS.filter((kind) => shapeGeometry(kind)?.strokeInside)).toEqual([
      'diamond',
      'parallelogram',
      'hexagon',
      'document',
      'cylinder',
      'cloud',
    ]);
  });

  it('maps a stretched part into the box, stroke untouched', () => {
    const frame = shapeGeometry('frame', 1.6)!;
    const fit = boxFit(frame, { x: 10, y: 20, width: 160, height: 100 });
    expect(fitShapePart(frame.parts[0]!, fit)).toMatchObject({
      x: 11.6,
      y: 21,
      width: 156.8,
      height: 98,
    });
    const cylinder = shapeGeometry('cylinder', 2)!;
    const body = fitShapePart(
      cylinder.parts[0]!,
      boxFit(cylinder, { x: 0, y: 0, width: 200, height: 100 }),
    );
    expect(body).toMatchObject({ d: 'M 0 15 L 200 15 L 200 85 A 100 12 0 0 1 0 85 Z' });
  });

  it('keeps a proportional part proportional and centred', () => {
    const fit = boxFit(
      { viewBox: '0 0 90 130', preserveAspectRatio: 'xMidYMid meet' },
      { x: 0, y: 0, width: 180, height: 130 },
    );
    expect(fit).toEqual({ sx: 1, sy: 1, ox: 45, oy: 0 });
  });

  it('the export draws the diamond natively from the table points, inset by half the stroke', () => {
    const svg = renderElementsToSvg(tabOf([shapeAt('diamond', { strokeWidth: 'thick' })]));
    expect(svg).toContain(
      `<polygon points="${scaledPolygonPoints(DIAMOND_POINTS, 12, 22, 156, 96)}"`,
    );
    expect(scaledPolygonPoints(DIAMOND_POINTS, 12, 22, 156, 96)).toBe('90,22 168,70 90,118 12,70');
  });

  it('keeps the laptop bezel even on a wide box, as the canvas does', () => {
    const wide = shapeGeometry('laptop', 2)!.parts[1] as Extract<ShapePart, { tag: 'rect' }>;
    const square = shapeGeometry('laptop', 1)!.parts[1] as Extract<ShapePart, { tag: 'rect' }>;
    expect(square.x).toBe(11);
    expect(wide.x).toBe(9.5);
  });
});

describe('the browser chrome strip', () => {
  it('lays out like the canvas flex strip: pad, dots, gap, nav, gap, pill', () => {
    expect(browserChromeLayout()).toEqual({ dotX: [16, 34, 52], navX: 74, pillX: 140 });
  });

  it('the export draws the table nav glyphs at the table size', () => {
    const svg = renderElementsToSvg(tabOf([shapeAt('browser', { width: 300, height: 200 })]));
    const n = BROWSER_CHROME.nav;
    expect(svg).toContain(
      `<svg x="84" y="35" width="${n.widthPx}" height="${n.heightPx}" viewBox="${n.viewBox}"`,
    );
    for (const d of n.paths) expect(svg).toContain(`<path d="${d}"`);
  });
});
