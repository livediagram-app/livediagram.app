import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createShape, renderElementsToSvg, type Tab } from '@livediagram/diagram';
import type { ShapeKind } from '@livediagram/diagram';

// Canvas and export must agree on which shapes have a real outline.
//
// `ShapeSvgOverlay` (this directory) draws the silhouettes the browser sees;
// `svg-render-shapes.ts` in packages/diagram redraws them headlessly for the
// SVG / PNG / PDF exports, the Explorer thumbnails, the share image and the
// inline images the MCP server returns. Its header asks for the obvious thing
// — "Keep the two in sync when a silhouette changes" — and nothing checked it.
//
// The failure that asks for is quiet: add an overlay case and forget the
// exporter, and the shape looks right on canvas while every export flattens it
// to a plain rectangle. Nobody gets an error, and the export is the artefact
// that leaves the product. Four other pairs of lists in this repo have drifted
// exactly this way, so the guard is worth more than the comment.
//
// Asserted BEHAVIOURALLY rather than by comparing the two membership lists,
// because equal lists is not the property that matters — `diamond` is drawn by
// the exporter natively (a bare <polygon>, no silhouette entry) and is
// perfectly fine. What matters is that the export draws something other than a
// rectangle.
const OVERLAY_SRC = readFileSync(
  fileURLToPath(new URL('./shape-svg-overlay.tsx', import.meta.url)),
  'utf8',
);

// The overlay dispatches on inline `shape === 'kind'` conditionals rather than
// a table, so the kinds are read out of its source. Read, not restated: a
// second hand-written copy is the thing that drifts.
const OVERLAY_KINDS = [
  ...new Set([...OVERLAY_SRC.matchAll(/shape === '([a-z0-9-]+)'/g)].map((m) => m[1]!)),
];

const tabOf = (elements: unknown[]) => ({ id: 't', name: 'Tab', elements }) as unknown as Tab;
const exportOf = (kind: ShapeKind) => renderElementsToSvg(tabOf([createShape(kind, 0, 0)]));

describe('canvas silhouettes survive the headless export', () => {
  it('extracted a plausible set of overlay kinds', () => {
    // Guards the extraction itself: a refactor that renames the conditional
    // must fail loudly here rather than let the real assertion pass over an
    // empty list.
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
