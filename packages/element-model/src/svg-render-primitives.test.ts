import { describe, expect, it } from 'vitest';
import {
  estimatedLabelMeasure,
  fontSizeFor,
  graphemes,
  labelMaxWidth,
  labelMeasure,
  r2,
  svgIconGlyph,
  wrapLabel,
} from './svg-render-primitives';

// One unit a character, so a width is a character count.
const chars = (s: string) => [...s].length;

describe('wrapLabel', () => {
  it('wraps greedily at spaces and keeps explicit newlines and empty lines', () => {
    expect(wrapLabel('one two three', 7, chars)).toEqual(['one two', 'three']);
    expect(wrapLabel('a\n\nb', 10, chars)).toEqual(['a', '', 'b']);
  });

  it('keeps a word wider than the line whole without breakWords', () => {
    expect(wrapLabel('smartwatch', 4, chars)).toEqual(['smartwatch']);
  });

  it('breaks a too-wide word between characters with breakWords', () => {
    expect(wrapLabel('smartwatch', 8, chars, true)).toEqual(['smartwat', 'ch']);
    expect(wrapLabel('abcdefghij', 3, chars, true)).toEqual(['abc', 'def', 'ghi', 'j']);
  });

  it('never cuts an emoji or a joined emoji in half', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    const lines = wrapLabel(`${family}${family}${family}`, 2, (s) => graphemes(s).length, true);
    expect(lines).toEqual([family + family, family]);
    for (const l of wrapLabel('\u{1F600}\u{1F600}\u{1F600}', 1, (s) => graphemes(s).length, true))
      expect(l).toBe('\u{1F600}');
  });

  it('cuts plain Latin text at every character, as the grapheme path would', () => {
    const word = 'Ünïcödé-Latin';
    const plain = wrapLabel(word, 3, chars, true);
    expect(plain.join('')).toBe(word);
    expect(plain.every((l) => l.length <= 3)).toBe(true);
  });

  it('wraps a long too-wide word quickly', () => {
    const word = 'x'.repeat(20_000);
    const start = performance.now();
    const lines = wrapLabel(word, 100, chars, true);
    expect(lines).toHaveLength(200);
    // Measured about 20 ms (it took 83 s before the fit was halved); the budget leaves room for a busy CI machine.
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});

describe('the measuring helpers', () => {
  it('estimates a label without a canvas', () => {
    expect(estimatedLabelMeasure(20)('abcd')).toBeCloseTo(4 * 20 * 0.55);
    // No DOM here: labelMeasure falls back to the estimate.
    expect(labelMeasure(20, true, false)('abcd')).toBeCloseTo(4 * 20 * 0.55);
  });

  it('rounds, sizes and insets as the canvas does', () => {
    expect(r2(1.23456)).toBe(1.23);
    expect(fontSizeFor('md')).toBeGreaterThan(fontSizeFor('sm'));
    const box = (width: number) => ({ width }) as Parameters<typeof labelMaxWidth>[0];
    expect(labelMaxWidth(box(100))).toBe(84);
    expect(labelMaxWidth(box(10), 8)).toBe(8);
  });

  it('counts graphemes, falling back to code points', () => {
    expect(graphemes('a\u{1F600}b')).toEqual(['a', '\u{1F600}', 'b']);
  });
});

describe('svgIconGlyph', () => {
  const r = { x: 4, y: 6, width: 24, height: 24 };
  it('strokes a line icon in the colour given', () => {
    const svg = svgIconGlyph({ x: 10, y: 20 }, { markup: '<path d="M0 0"/>', colored: false }, r, '#123456');
    expect(svg).toContain('x="14" y="26"');
    expect(svg).toContain('stroke="#123456"');
  });
  it('keeps a coloured icon its own paint', () => {
    const svg = svgIconGlyph({ x: 0, y: 0 }, { markup: '<g/>', colored: true }, r, '#123456');
    expect(svg).not.toContain('stroke=');
  });
});
