import { describe, expect, it } from 'vitest';
import {
  exportRunEffects,
  hasTextEffects,
  highlightBandRect,
  sameEffects,
  svgLineEffects,
  textEffectIdPrefix,
} from './svg-render-text-effects';
import { svgRichWrappedLabel } from './svg-render-labels';

describe('text effects in exports (docs/specs/008-canvas/text-effects.md "Rendering")', () => {
  it('keeps only the effects a renderer knows', () => {
    expect(exportRunEffects({ highlight: '#fde68a', gradient: 'ocean' })).toEqual({
      highlight: '#fde68a',
      gradient: { from: '#0ea5e9', to: '#6366f1' },
    });
    expect(exportRunEffects({ highlight: 'javascript:x', gradient: 'nope' })).toEqual({});
  });

  it('compares effects for the wrap', () => {
    expect(sameEffects({}, {})).toBe(true);
    expect(sameEffects({ highlight: '#fff' }, {})).toBe(false);
    expect(
      sameEffects({ gradient: { from: 'a', to: 'b' } }, { gradient: { from: 'a', to: 'c' } }),
    ).toBe(false);
  });

  it('puts the band over the lower part of the line, padded either side', () => {
    const b = highlightBandRect(100, 20, 50, 40);
    expect(b.x).toBe(47.5);
    expect(b.width).toBe(45);
    expect(b.y).toBeCloseTo(100 - 12.5 + 25 * 0.38, 6);
    expect(b.height).toBeCloseTo(25 * 0.56, 6);
    expect(b.radius).toBe(4);
  });

  it('names gradient defs safely and in order', () => {
    expect(textEffectIdPrefix('a b/c')).toBe('tg-a_b_c');
    const next = { n: 0 };
    const out = svgLineEffects(
      [
        { x: 0, width: 10, size: 10, gradient: { from: '#000', to: '#fff' } },
        { x: 10, width: 10, size: 10 },
        {
          x: 20,
          width: 10,
          size: 10,
          highlight: '#fde68a',
          gradient: { from: '#111', to: '#222' },
        },
        { x: 30, width: 0, size: 10, highlight: '#fde68a' },
      ],
      50,
      'tg-e',
      next,
    );
    expect(out.fills).toEqual(['url(#tg-e-0)', null, 'url(#tg-e-1)', null]);
    expect(out.defs.match(/<linearGradient/g)).toHaveLength(2);
    expect(out.bands.match(/<rect/g)).toHaveLength(1);
    expect(next.n).toBe(2);
  });

  it('draws bands before the text and fills gradient fragments with their def', () => {
    const svg = svgRichWrappedLabel(
      [
        { text: 'We grew ', color: '#111111', size: 20, bold: false, italic: false },
        {
          text: '40%',
          color: '#111111',
          size: 20,
          bold: true,
          italic: false,
          highlight: '#fde68a',
          gradient: { from: '#f97316', to: '#db2777' },
        },
      ],
      0,
      0,
      'start',
      400,
      'middle',
      undefined,
      undefined,
      'tg-el',
    );
    expect(svg.indexOf('<rect')).toBeLessThan(svg.indexOf('<text'));
    expect(svg).toContain('<defs><linearGradient id="tg-el-0"');
    expect(svg).toContain('fill="url(#tg-el-0)"');
    expect(svg).toContain('fill="#111111"');
  });

  it('measures nothing and adds nothing for a label without effects', () => {
    const svg = svgRichWrappedLabel(
      [{ text: 'Plain', color: '#111111', size: 20, bold: true, italic: false }],
      0,
      0,
      'middle',
      400,
    );
    expect(svg.startsWith('<text')).toBe(true);
  });

  it('tells a label with an effect from a plain one', () => {
    expect(hasTextEffects({})).toBe(false);
    expect(hasTextEffects({ richText: [{ text: 'a' }] })).toBe(false);
    expect(hasTextEffects({ richText: [{ text: 'a', highlight: '#fde68a' }] })).toBe(true);
    expect(hasTextEffects({ richText: [{ text: 'a', gradient: 'sunset' }] })).toBe(true);
  });
});
