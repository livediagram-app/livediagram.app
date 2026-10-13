import { describe, expect, it } from 'vitest';
import { boxedNeedsSvgRaster, svgBoxed } from './svg-render';
import { inlineIconMetrics } from './svg-render-inline-icon';
import type { ShapeElement } from './index';

// docs/specs/008-canvas/canvas-and-palette.md "Icons inside shapes": a box's icon beside its label, in every export.

const ART = { markup: '<path d="M0 0L24 24" data-glyph="1"/>', colored: false };
const resolveIconArt = (id: string) => (id === 'database' ? ART : undefined);
const box = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 220,
  height: 72,
  label: 'Orders DB',
  textSize: 'md',
  iconId: 'database',
  ...extra,
});
// The first `tag`'s `attr`, read by indexOf (a [^>]* pattern backtracks on a long run of tags).
const attrOf = (svg: string, tag: string, attr: string): number => {
  const at = svg.indexOf(`<${tag}`);
  const end = svg.indexOf('>', at);
  const head = svg.slice(at, end);
  const key = ` ${attr}="`;
  const from = head.indexOf(key) + key.length;
  return Number(head.slice(from, head.indexOf('"', from)));
};
const textX = (svg: string) => attrOf(svg, 'text', 'x');
const iconX = (svg: string) => attrOf(svg, 'svg', 'x');

describe('inline icons in an export', () => {
  it('draws the glyph left of the label by default and moves the label aside', () => {
    const plain = svgBoxed(box({ iconId: undefined }), { resolveIconArt });
    const withIcon = svgBoxed(box(), { resolveIconArt });
    expect(withIcon).toContain('data-glyph="1"');
    expect(iconX(withIcon)).toBeLessThan(textX(withIcon));
    expect(textX(withIcon)).toBeGreaterThan(textX(plain));
  });

  it('puts the glyph after the label for iconPosition right', () => {
    const svg = svgBoxed(box({ iconPosition: 'right' }), { resolveIconArt });
    expect(iconX(svg)).toBeGreaterThan(textX(svg));
  });

  it('stacks the glyph above the label for iconPosition above', () => {
    const svg = svgBoxed(box({ iconPosition: 'above', height: 120 }), { resolveIconArt });
    const iconY = attrOf(svg, 'svg', 'y');
    const textY = attrOf(svg, 'text', 'y');
    expect(iconY).toBeLessThan(textY);
  });

  it('draws nothing extra when the icon resolves to no art, and rasterises when it does', () => {
    expect(svgBoxed(box({ iconId: 'nope' }), { resolveIconArt })).not.toContain('data-glyph');
    expect(boxedNeedsSvgRaster(box(), resolveIconArt)).toBe(true);
  });

  it('shares its sizes with the canvas: the glyph follows the label, capped by the box', () => {
    expect(inlineIconMetrics({ width: 220, height: 72 }, 'A', 'md').iconSize).toBeLessThanOrEqual(
      72 * 0.32,
    );
    expect(inlineIconMetrics({ width: 400, height: 400 }, 'A', 'sm').iconSize).toBeCloseTo(
      14 * 1.6,
    );
  });
});
