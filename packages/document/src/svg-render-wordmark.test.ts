import { describe, expect, it } from 'vitest';
import type { TextElement } from './element-types';
import { boxedNeedsSvgRaster, svgBoxed } from './svg-render';
import { trackedMeasure } from './svg-render-wordmark';

// docs/specs/007-editor/logo-pages.md "Wordmark type": tracking, weight, case and arc in exports.
describe('wordmark type in an export', () => {
  const text = (extra: Partial<TextElement>): TextElement => ({
    id: 't1',
    type: 'text',
    x: 10,
    y: 20,
    width: 300,
    height: 300,
    label: 'Brand co',
    textSize: 'lg',
    ...extra,
  });

  it('leaves plain text exactly as before', () => {
    const svg = svgBoxed(text({}));
    expect(svg).not.toContain('letter-spacing');
    expect(svg).toContain('>Brand co<');
    expect(boxedNeedsSvgRaster(text({}))).toBe(false);
  });

  it('writes tracking in px, its weight and its case on flat text', () => {
    const svg = svgBoxed(text({ letterSpacing: 0.25, fontWeight: 500, textCase: 'upper' }));
    expect(svg).toContain('letter-spacing="8"');
    expect(svg).toContain('font-weight="500"');
    expect(svg).toContain('>BRAND CO<');
  });

  it('keeps bold at the export weight when no weight is set', () => {
    expect(svgBoxed(text({ textBold: true, letterSpacing: 0.1 }))).toContain('font-weight="600"');
  });

  it('applies the case and tracking to rich runs, a non-bold run in the element weight', () => {
    const svg = svgBoxed(
      text({
        textCase: 'lower',
        fontWeight: 500,
        letterSpacing: 0.1,
        richText: [{ text: 'Brand ', bold: true }, { text: 'CO' }],
      }),
    );
    expect(svg).toContain('font-weight="600">brand</tspan>');
    expect(svg).toContain('font-weight="500"> co</tspan>');
    expect(svg).toContain('letter-spacing="3.2"');
  });

  it('runs arched text along a path in the box, as one line', () => {
    const svg = svgBoxed(text({ textArc: 180, label: 'Brand\nco', textCase: 'upper' }));
    expect(svg).toContain('<g transform="translate(10 20)">');
    expect(svg).toContain('<path id="lvd-arc-t1"');
    expect(svg).toContain(
      '<textPath href="#lvd-arc-t1" startOffset="50%" text-anchor="middle">BRAND CO</textPath>',
    );
    expect(boxedNeedsSvgRaster(text({ textArc: 90 }))).toBe(true);
  });

  it('draws nothing for an empty arched label', () => {
    expect(svgBoxed(text({ textArc: 90, label: '' }))).not.toContain('textPath');
  });

  it('measures tracked text wider by a spacing per glyph', () => {
    const m = trackedMeasure((s) => s.length * 10, 0.5, 20);
    expect(m('abc')).toBe(30 + 30);
    expect(trackedMeasure((s) => s.length, undefined, 20)('ab')).toBe(2);
  });

  it('wraps tracked rich text counting its tracking', () => {
    const runs = [{ text: 'AAAA BBBB', bold: true }];
    const loose = svgBoxed(text({ width: 400, richText: runs, label: 'AAAA BBBB' }));
    const tracked = svgBoxed(
      text({ width: 400, richText: runs, label: 'AAAA BBBB', letterSpacing: 1 }),
    );
    const lines = (svg: string) => (svg.match(/<tspan x=/g) ?? []).length;
    expect(lines(loose)).toBe(1);
    expect(lines(tracked)).toBe(2);
  });
});
