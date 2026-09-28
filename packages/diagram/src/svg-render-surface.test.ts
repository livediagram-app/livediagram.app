import { describe, expect, it } from 'vitest';
import { REVEAL_COVER_BASE } from './colors';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import { svgBoxed } from './svg-render';
import type { ShapeKind } from './index';

// Surface fidelity (docs/specs/008-canvas/minimap.md "Fidelity"). The headless
// renderer draws the Map, the layer thumbnails and the exports, and it has to
// paint an element on dark paper the way the canvas does. The canvas never
// shows a light card on a dark board unless the element stores that colour
// itself, so neither may the renderer: a hard-coded light base is how the
// Reveal cover came out as a white panel on a dark board's map.

const KINDS = Object.keys(SHAPE_DEFAULT_SIZE) as ShapeKind[];

// Relative luminance on 0..255, the same weighting the colour helpers use.
function isLight(hex: string): boolean {
  const h =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 200;
}

// A rect painting the element's whole box: its base, as opposed to a mark on it.
function fullSizeFills(svg: string, width: number, height: number): string[] {
  return [...svg.matchAll(/<rect\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(`width="${width}"`) && tag.includes(`height="${height}"`))
    .map((tag) => /fill="(#[0-9a-fA-F]{3,8})"/.exec(tag)?.[1])
    .filter((c): c is string => c !== undefined);
}

describe('svgBoxed on dark paper', () => {
  it('paints no element kind on a light base unless the element stores that fill', () => {
    const offenders = KINDS.flatMap((kind) => {
      const el = createShape(kind, 0, 0);
      // A stored fill is the element's identity (a Page is a white sheet on
      // any board) and the canvas paints it as-is, so it is exempt.
      if (el.fillColor) return [];
      const light = fullSizeFills(svgBoxed(el, { surface: 'dark' }), el.width, el.height).filter(
        isLight,
      );
      return light.length ? [`${kind}: ${light.join(',')}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('draws the Reveal cover on the base the canvas face uses for each paper', () => {
    const el = createShape('reveal', 0, 0);
    for (const surface of ['light', 'dark'] as const) {
      expect(svgBoxed(el, { surface })).toContain(`fill="${REVEAL_COVER_BASE[surface]}"`);
    }
  });
});
