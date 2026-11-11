import { describe, expect, it } from 'vitest';
import type { TextElement } from './element';
import type { ExportLabel } from './svg-render-labels';
import { svgWordmarkLabel, trackedMeasure } from './svg-render-wordmark';
import { createText } from './testing/elements';

// A text's wordmark type in the export (docs/specs/007-editor/editor-modes.md). Each product's own test also draws
// one through its renderer; these read the shared module alone.
const text = (over: Partial<TextElement> = {}): TextElement => ({
  ...createText(0, 0),
  id: 't1',
  width: 300,
  height: 120,
  ...over,
});
const label: ExportLabel = {
  text: 'Brand\nmark',
  x: 150,
  y: 60,
  anchor: 'middle',
  valign: 'middle',
  maxWidth: 280,
  color: '#112233',
  size: 20,
  bold: false,
  italic: true,
};

describe('trackedMeasure', () => {
  it('adds the tracking per glyph, and is the measure itself without any', () => {
    const measure = (s: string) => s.length * 10;
    expect(trackedMeasure(measure, undefined, 20)).toBe(measure);
    expect(trackedMeasure(measure, 0.5, 20)('abc')).toBe(30 + 0.5 * 20 * 3);
  });
});

describe('svgWordmarkLabel', () => {
  it('draws arched text on a path, in its case, weight and decoration', () => {
    const svg = svgWordmarkLabel(
      text({
        textArc: 120,
        textCase: 'upper',
        letterSpacing: 0.1,
        fontWeight: 500,
        textUnderline: true,
        textStrikethrough: true,
      }),
      label,
    );
    expect(svg).toContain('<textPath href="#lvd-arc-t1"');
    expect(svg).toContain('>BRAND MARK</textPath>');
    expect(svg).toContain('font-weight="500"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-decoration="underline line-through"');
    expect(svg).toContain('letter-spacing="2"');
  });

  it('draws arched text plain when it carries no decoration or tracking', () => {
    const svg = svgWordmarkLabel(text({ textArc: -200, textBold: true }), {
      ...label,
      italic: false,
    });
    expect(svg).toContain('font-weight="700"');
    expect(svg).not.toContain('text-decoration');
    expect(svg).not.toContain('letter-spacing');
  });

  it('wraps straight text in its case, and a rich label run by run', () => {
    expect(svgWordmarkLabel(text({ textCase: 'lower' }), { ...label, text: 'LOUD' })).toContain(
      'loud',
    );
    const runs = [{ text: 'Rich', color: '#000000', size: 20, bold: false, italic: false }];
    const rich = svgWordmarkLabel(text({ textCase: 'upper' }), { ...label, runs });
    expect(rich).toContain('RICH');
  });
});
