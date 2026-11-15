import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './element';
import { svgIconShape, svgImageShape } from './svg-render-image-icon';
import { inlineIconGap, inlineIconLayout, inlineIconMetrics } from './svg-render-inline-icon';
import type { ExportLabel } from './svg-render-labels';
import { createShape } from './testing/elements';

// The export's image and icon bodies (docs/specs/020-import-export/export-fidelity.md) and the inline icon beside
// a label. Each product's export tests also draw them through its renderer.
const box = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('square', 10, 20),
  id: 'el:1',
  width: 120,
  height: 80,
  ...over,
});
const line: ExportLabel = {
  text: 'Hello',
  x: 70,
  y: 60,
  anchor: 'middle',
  valign: 'middle',
  maxWidth: 100,
  color: '#000',
  size: 14,
  bold: false,
  italic: false,
};

describe('svgImageShape', () => {
  it('clips the picture to its rounded box on white, by its fit', () => {
    const cover = svgImageShape(box(), 'a.png?x=1&y=2', 'cover', 100);
    expect(cover).toContain('<clipPath id="lvd-img-el1">');
    expect(cover).toContain('rx="40"');
    expect(cover).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(cover).toContain('href="a.png?x=1&amp;y=2"');
    expect(svgImageShape(box(), 'a.png', 'contain', 4)).toContain('xMidYMid meet');
  });

  // docs/specs/009-elements/picture-crop-and-mask.md, in livedocuments and livedesign: read off any image element.
  const pic = (over: Record<string, unknown>) =>
    ({ ...box(), type: 'image', naturalWidth: 240, naturalHeight: 80, ...over }) as unknown as ShapeElement;

  it('cuts a masked picture to its shape and greys it by a colour matrix', () => {
    const svg = svgImageShape(pic({ mask: 'circle', greyscale: true }), 'a.png', 'cover', 0);
    expect(svg).toContain('<clipPath id="lvd-img-el1"><path d="');
    expect(svg).toContain('<filter id="lvd-img-el1-grey"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('lays a crop out, a letterboxed one inside its part', () => {
    const wide = svgImageShape(pic({ crop: { x: 0, y: 0, width: 1, height: 1 } }), 'a.png', 'contain', 0);
    expect(wide).toContain('lvd-img-el1-part');
    const fits = svgImageShape(pic({ crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }), 'a.png', 'contain', 0);
    expect(fits).not.toContain('-part');
  });

  it('names the picture by its alt text only when asked', () => {
    const alt = pic({ alt: ' Harbour <dawn> ' });
    expect(svgImageShape(alt, 'a.png', 'cover', 0, { altTitle: true })).toContain(
      '<title>Harbour &lt;dawn&gt;</title></image>',
    );
    expect(svgImageShape(alt, 'a.png', 'cover', 0)).not.toContain('<title>');
    expect(svgImageShape(pic({ alt: '  ' }), 'a.png', 'cover', 0, { altTitle: true })).not.toContain(
      '<title>',
    );
  });
});

describe('svgIconShape', () => {
  it('draws a coloured glyph at its mark size, unstroked', () => {
    const svg = svgIconShape(box({ iconSize: 'lg' }), { markup: '<path/>', colored: true }, '#f00');
    expect(svg).toContain('<path/>');
    expect(svg).not.toContain('stroke="#f00"');
    expect(svgIconShape(box(), { markup: '', colored: true }, '#f00')).toContain('stroke-width=');
  });

  it('strokes a line glyph in the given ink at its weight', () => {
    const thin = svgIconShape(
      box({ iconWeight: 'thin' }),
      { markup: '<path/>', colored: false },
      '#f00',
    );
    const bold = svgIconShape(
      box({ iconWeight: 'bold' }),
      { markup: '<path/>', colored: false },
      '#f00',
    );
    expect(thin).toContain('stroke="#f00"');
    expect(thin).not.toBe(bold);
    expect(
      svgIconShape(box({ width: 0, height: 0 }), { markup: '', colored: false }, '#000'),
    ).toContain('stroke-width=');
  });
});

describe('inlineIconMetrics and inlineIconGap', () => {
  it('follows the label size, capped by the box, and scales with a page re-fit', () => {
    const md = inlineIconMetrics({ width: 120, height: 80 }, 'Hi', 'md');
    const scaled = inlineIconMetrics({ width: 120, height: 80, textScale: 0.5 }, 'Hi', 'md');
    expect(scaled.fontSize).toBeCloseTo(md.fontSize / 2);
    expect(md.iconSize).toBeLessThanOrEqual(md.elementIconSize);
    expect(inlineIconMetrics({ width: 120, height: 80 }, '  ', 'md').iconSize).toBe(
      md.elementIconSize,
    );
    expect(inlineIconMetrics({ width: 120, height: 80 }, 'Hi', 'scale').fontSize).toBeCloseTo(20.8);
  });

  it('spaces a row wider than a column', () => {
    expect(inlineIconGap(20, true)).toBe(8);
    expect(inlineIconGap(40, true)).toBe(13);
    expect(inlineIconGap(20, false)).toBe(4);
  });
});

describe('inlineIconLayout', () => {
  const art = { markup: '<path/>', colored: false };

  it('centres a lone icon in the box', () => {
    const out = inlineIconLayout(box(), null, art, '#000', 'md');
    expect(out.label).toBeNull();
    expect(out.icon).toContain('<path/>');
  });

  it('sets the icon beside the label in a row, before or after it', () => {
    const left = inlineIconLayout(box(), line, art, '#000', 'md');
    const right = inlineIconLayout(box({ iconPosition: 'right' }), line, art, '#000', 'md');
    expect(left.label!.anchor).toBe('middle');
    expect(left.label!.x).toBeGreaterThan(right.label!.x);
    const start = inlineIconLayout(box(), { ...line, anchor: 'start', x: 20 }, art, '#000', 'md');
    const end = inlineIconLayout(box(), { ...line, anchor: 'end', x: 120 }, art, '#000', 'md');
    expect(start.label!.x).toBeLessThan(end.label!.x);
  });

  it('measures a rich label run by run', () => {
    const runs = [{ text: 'Bold', color: '#000000', size: 14, bold: true, italic: false }];
    const out = inlineIconLayout(box(), { ...line, runs }, art, '#000', 'md');
    expect(out.label!.maxWidth).toBeGreaterThan(0);
  });

  it('stacks the icon above or below the label, hung as the label was', () => {
    const above = inlineIconLayout(box({ iconPosition: 'above' }), line, art, '#000', 'md');
    const below = inlineIconLayout(box({ iconPosition: 'below' }), line, art, '#000', 'md');
    expect(above.label!.valign).toBe('middle');
    expect(above.label!.y).toBeGreaterThan(below.label!.y);
    const top = inlineIconLayout(
      box({ iconPosition: 'above' }),
      { ...line, valign: 'top' },
      art,
      '#000',
      'md',
    );
    const bottom = inlineIconLayout(
      box({ iconPosition: 'above' }),
      { ...line, valign: 'bottom' },
      art,
      '#000',
      'md',
    );
    expect(top.label!.y).toBeGreaterThan(bottom.label!.y);
  });
});
