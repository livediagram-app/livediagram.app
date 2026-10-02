import { describe, expect, it } from 'vitest';
import { elementTextSize, htmlFontSizePx, runTextSize } from './text-size';

// docs/specs/020-import-export/drawio-import.md "Text": draw.io's font sizes (px) to livediagram's
// presets, for a whole element and for a span inside its label. One module, so the mapping of
// text smaller than livediagram's smallest size is decided in one place.

describe('elementTextSize', () => {
  it('takes the preset nearest on the element own scale', () => {
    expect(elementTextSize(12, 'label')).toBe('sm');
    expect(elementTextSize(20, 'label')).toBe('md');
    expect(elementTextSize(36, 'label')).toBe('lg');
  });
});

describe('runTextSize', () => {
  it('sizes a span that reads larger than its label', () => {
    expect(runTextSize(22, 12, 'label')).toBe('md');
    expect(runTextSize(32, 12, 'label')).toBe('lg');
  });

  it('leaves a span that lands on its label size to inherit it', () => {
    expect(runTextSize(13, 12, 'label')).toBeUndefined();
    expect(runTextSize(22, 22, 'label')).toBeUndefined();
  });

  it('leaves text below the smallest size at the smallest size, for now', () => {
    // The open question (operator): an `xs` run size, a report rule, or both. This is the one place.
    expect(runTextSize(7, 12, 'label')).toBeUndefined();
    expect(runTextSize(9, 22, 'label')).toBe('sm');
  });
});

describe('htmlFontSizePx', () => {
  it('reads the HTML <font size> scale as browsers draw it', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(htmlFontSizePx)).toEqual([10, 13, 16, 18, 24, 32, 48]);
    expect(htmlFontSizePx(0)).toBeUndefined();
    expect(htmlFontSizePx(8)).toBeUndefined();
  });
});

describe('elementTextSize, every scale', () => {
  it('picks the nearest preset on the element scale', () => {
    expect(elementTextSize(12, 'label')).toBe('sm');
    expect(elementTextSize(20, 'label')).toBe('md');
    expect(elementTextSize(28, 'label')).toBe('lg');
    expect(elementTextSize(18, 'label')).toBe('sm');
    expect(elementTextSize(14, 'note')).toBe('sm');
    expect(elementTextSize(11, 'arrow')).toBe('sm');
    expect(elementTextSize(20, 'arrow')).toBe('lg');
  });
});
