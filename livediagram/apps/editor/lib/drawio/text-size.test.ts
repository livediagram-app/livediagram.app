import { describe, expect, it } from 'vitest';
import {
  DRAWIO_XS_BELOW_PX,
  belowExtraSmall,
  elementTextSize,
  htmlFontSizePx,
  labelIsExtraSmall,
  runTextSize,
} from './text-size';

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

  it('maps a span under 12 px to xs, and 12 px to the nearest preset', () => {
    expect(runTextSize(11.9, 12, 'label')).toBe('xs');
    expect(runTextSize(7, 12, 'label')).toBe('xs');
    expect(runTextSize(9, 22, 'note')).toBe('xs');
    expect(runTextSize(12, 22, 'label')).toBe('sm');
    expect(runTextSize(12, 12, 'label')).toBeUndefined();
  });

  it('compares a span in a small label against xs, so a larger span keeps its preset', () => {
    expect(runTextSize(9, 9, 'label')).toBeUndefined();
    expect(runTextSize(13, 9, 'label')).toBe('sm');
  });

  it('has no xs for arrow captions, which carry no runs', () => {
    expect(runTextSize(9, 11, 'arrow')).toBeUndefined();
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

describe('the extra-small edges', () => {
  it('reads a label under 12 px as small, and text under 10 px as below what xs shows', () => {
    expect([11.9, 12].map((px) => labelIsExtraSmall(px, 'label'))).toEqual([true, false]);
    expect(labelIsExtraSmall(9, 'arrow')).toBe(false);
    expect([9.9, 10].map(belowExtraSmall)).toEqual([true, false]);
    expect(DRAWIO_XS_BELOW_PX).toBe(12);
  });
});
