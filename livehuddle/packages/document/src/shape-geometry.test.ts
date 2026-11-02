import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import {
  chairSeatFill,
  DIAMOND_POINTS,
  SHAPE_GEOMETRY_KINDS,
  shapeGeometry,
} from './shape-geometry';
import { CHAIR_ART } from './seating';
import { scaledPolygonPoints } from './svg-render-shapes';
import { boxFit } from './svg-shape-fit';
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

describe('the shape geometry table', () => {
  it('only names real shape kinds', () => {
    for (const kind of SHAPE_GEOMETRY_KINDS) expect(SHAPE_KINDS.has(kind)).toBe(true);
  });

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
    // The chair is the furniture table's, drawn facing you (docs/specs/009-elements/chair.md "Facing").
    expect(svg).toContain(`viewBox="0 0 ${CHAIR_ART.front.width} ${CHAIR_ART.front.height}"`);
    for (const p of CHAIR_ART.front.parts)
      if (p.tag === 'path') expect(svg).toContain(`<path d="${p.d}"`);
    // Its default transparent fill washes its stroke, never an invisible seat.
    expect(svg).toContain(`fill="${chairSeatFill('transparent', '#94a3b8')}"`);
    expect(chairSeatFill('transparent', '#94a3b8')).toBe('rgba(148, 163, 184, 0.32)');
    expect(chairSeatFill('#fde68a', '#94a3b8')).toBe('#fde68a');
  });

  it('draws the export for its facing, never rotated, mirroring facing right', () => {
    const facing = (chairFacing: string) =>
      renderElementsToSvg(tabOf([shapeAt('chair', { width: 80, height: 80, chairFacing })]));
    for (const f of ['n', 'e', 's', 'w']) expect(facing(f)).not.toContain('rotate(');
    expect(facing('w')).toContain('scale(-1 1)');
    expect(facing('e')).not.toContain('scale(-1 1)');
    // Facing up, the backrest's back is drawn, its slat lower than the front view's.
    expect(facing('s')).toContain('<path d="M32 17v24"');
  });
});
