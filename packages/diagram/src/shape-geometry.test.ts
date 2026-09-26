import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import {
  BROWSER_CHROME,
  browserChromeLayout,
  CHAIR_GEOMETRY,
  chairSeatFill,
  DIAMOND_POINTS,
  SHAPE_GEOMETRY_KINDS,
  shapeGeometry,
  type ShapePart,
} from './shape-geometry';
import { scaledPolygonPoints } from './svg-render-shapes';
import { SHAPE_KINDS } from './validate';
import type { ShapeKind, Tab } from './index';

// The geometry table is the one copy of every drawn silhouette (the canvas
// overlays read it in apps/live, the headless render reads it here). These
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
        (part.rx !== undefined ? ` rx="${n(part.rx)}"` : '')
      );
    case 'ellipse':
      return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}"`;
    case 'circle':
      return `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}"`;
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
      expect(svg).toContain(
        `viewBox="${geometry.viewBox}" preserveAspectRatio="${geometry.preserveAspectRatio}"`,
      );
      for (const part of geometry.parts) expect(svg).toContain(partMark(part));
    },
  );

  it('the export draws the diamond natively from the table points', () => {
    const svg = renderElementsToSvg(tabOf([shapeAt('diamond')]));
    expect(svg).toContain(
      `<polygon points="${scaledPolygonPoints(DIAMOND_POINTS, 10, 20, 160, 100)}"`,
    );
    expect(scaledPolygonPoints(DIAMOND_POINTS, 10, 20, 160, 100)).toBe('90,20 170,70 90,120 10,70');
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

describe('the chair', () => {
  it('the export draws the table chair, washed seat and all', () => {
    const svg = renderElementsToSvg(
      tabOf([
        shapeAt('chair', {
          width: 76,
          height: 84,
          fillColor: 'transparent',
          strokeColor: '#94a3b8',
        }),
      ]),
    );
    const g = CHAIR_GEOMETRY;
    expect(svg).toContain(`viewBox="${g.viewBox}"`);
    for (const d of [g.slat, g.stretcher, g.legs]) expect(svg).toContain(`<path d="${d}"`);
    // Its default transparent fill washes its stroke, never an invisible seat.
    expect(svg).toContain(`fill="${chairSeatFill('transparent', '#94a3b8')}"`);
    expect(chairSeatFill('transparent', '#94a3b8')).toBe('rgba(148, 163, 184, 0.32)');
    expect(chairSeatFill('#fde68a', '#94a3b8')).toBe('#fde68a');
  });

  it('turns the export for its facing, about the box centre', () => {
    const facing = (chairFacing: string) =>
      renderElementsToSvg(tabOf([shapeAt('chair', { width: 80, height: 80, chairFacing })]));
    expect(facing('n')).not.toContain('rotate(');
    expect(facing('e')).toContain('<g transform="rotate(90 50 60)">');
    expect(facing('w')).toContain('<g transform="rotate(270 50 60)">');
  });
});
