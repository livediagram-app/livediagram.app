import { describe, expect, it } from 'vitest';
import {
  createShape,
  renderElementsToSvg,
  SHAPE_GEOMETRY_KINDS,
  type Tab,
} from '@livediagram/diagram';
import type { ShapeKind } from '@livediagram/diagram';

// Canvas and export must agree on which shapes have a real outline.
//
// `ShapeSvgOverlay` (this directory) draws the silhouettes the browser sees;
// `svg-render-shapes.ts` in packages/diagram redraws them headlessly for the
// SVG / PNG / PDF exports, the Explorer thumbnails, the share image and the
// inline images the MCP server returns. Both now draw from one geometry table
// (shape-geometry.ts in packages/diagram), and shape-svg-overlay.test.tsx +
// the package's shape-geometry.test.ts pin each side to its exact paths.
//
// This keeps the coarser, behavioural guard it started as: every kind the
// overlay draws must export as something other than a plain box. The failure
// it catches is quiet: a kind that looks right on canvas while every export
// flattens it to a rectangle. Nobody gets an error, and the export is the
// artefact that leaves the product.
//
// Asserted BEHAVIOURALLY rather than by comparing membership lists, because
// `diamond` is drawn by the exporter natively (a bare <polygon>, no
// silhouette entry) and is perfectly fine. What matters is that the export
// draws something other than a rectangle.
//
// The overlay's kinds ARE the table's kinds: it dispatches on the table, so
// the list is imported rather than restated.
const OVERLAY_KINDS: readonly string[] = SHAPE_GEOMETRY_KINDS;

const tabOf = (elements: unknown[]) => ({ id: 't', name: 'Tab', elements }) as unknown as Tab;
const exportOf = (kind: ShapeKind) => renderElementsToSvg(tabOf([createShape(kind, 0, 0)]));

describe('canvas silhouettes survive the headless export', () => {
  it('extracted a plausible set of overlay kinds', () => {
    // Guards the list itself: a table that lost its entries must fail
    // loudly here rather than let the real assertion pass over nothing.
    expect(OVERLAY_KINDS.length).toBeGreaterThan(12);
    expect(OVERLAY_KINDS).toContain('hexagon');
    expect(OVERLAY_KINDS).toContain('actor');
  });

  it('exports every overlay-drawn kind as more than a plain box', () => {
    // Two legitimate ways to be drawn, and asserting only the first would have
    // been a false alarm — my initial version of this test failed frame /
    // phone / tablet / smartwatch, which are drawn correctly:
    //
    //  1. A silhouette: `svg-render-shapes` emits a NESTED <svg> holding the
    //     outline. Those four are device bezels built from rects, so looking
    //     for a polygon or path would miss them; the nested element is the
    //     signal that a silhouette ran at all.
    //  2. Natively in `svgBoxed`: `diamond` is a bare <polygon>, `circle` an
    //     <ellipse>, with no nested svg.
    //
    // A kind whose exporter went missing has neither: it falls through to the
    // wrapper rect, which is exactly the "looked right on canvas, exported as
    // a box" symptom this guards.
    const drawn = (svg: string) =>
      /<svg[\s\S]*<svg/.test(svg) || /<(polygon|path|ellipse)\b/.test(svg);
    const flattened = OVERLAY_KINDS.filter((kind) => !drawn(exportOf(kind as ShapeKind)));
    expect(flattened).toEqual([]);
  });
});
