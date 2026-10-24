// An exact text px from the Text Size slider (docs/specs/004-interface-design/fonts.md "Text size"):
// what the slider stores draws at that px on every surface, and a preset still reads its table.
import { describe, expect, it } from 'vitest';
import {
  clampTextPx,
  isTextPx,
  isTextSize,
  LABEL_FONT_PX,
  labelFontPx,
  legendFontPx,
  NOTE_FONT_PX,
  TEXT_PX_MAX,
  TEXT_PX_MIN,
} from '@liveworkspace/document-core/label-font';
import {
  CELL_FONT_PX,
  scaleCellFontPx,
  tableCellFontPx,
} from '@liveworkspace/document-core/table-cell-font';
import { arrowLabelFontSize } from '@liveworkspace/document-core/arrow-label';
import { sankeyLabelPx } from './sankey-frame';
import { svgBoxed } from './svg-render';
import { createShape } from './factories';

describe('the Text Size range', () => {
  it('runs 6 to 48 px', () => {
    expect([TEXT_PX_MIN, TEXT_PX_MAX]).toEqual([6, 48]);
  });

  it('clamps and rounds a slider value into whole px', () => {
    expect(clampTextPx(3)).toBe(6);
    expect(clampTextPx(64)).toBe(48);
    expect(clampTextPx(17.6)).toBe(18);
    expect(clampTextPx(Number.NaN)).toBe(TEXT_PX_MIN);
  });

  it('tells a px from a preset', () => {
    expect(isTextPx(18)).toBe(true);
    expect(isTextPx('md')).toBe(false);
    expect(isTextPx(undefined)).toBe(false);
  });

  it('accepts the presets and whole px in range, nothing else', () => {
    for (const ok of ['scale', 'sm', 'md', 'lg', 6, 18, 48]) expect(isTextSize(ok)).toBe(true);
    for (const bad of ['xl', 5, 49, 12.5, '18', null, undefined])
      expect(isTextSize(bad)).toBe(false);
  });
});

describe('an exact px draws at itself on every surface', () => {
  it('on a label and on a note alike', () => {
    expect(labelFontPx(9)).toBe(9);
    expect(labelFontPx(9, true)).toBe(9);
  });

  it('on a chart key, an arrow caption and a Sankey', () => {
    expect(legendFontPx(20)).toBe(20);
    expect(arrowLabelFontSize(20)).toBe(20);
    expect(sankeyLabelPx(20)).toBe(20);
  });

  it('in an export, where the label carries its font-size', () => {
    const svg = svgBoxed({ ...createShape('square', 0, 0), label: 'Hi', textSize: 27 });
    expect(svg).toContain('font-size="27"');
  });

  it('leaves the presets on their own tables', () => {
    expect(labelFontPx('md')).toBe(LABEL_FONT_PX.md);
    expect(labelFontPx('sm', true)).toBe(NOTE_FONT_PX.sm);
  });
});

describe('tableCellFontPx', () => {
  it('reads a preset, a px, Scale and the fallback', () => {
    expect(tableCellFontPx('lg', 40)).toBe(CELL_FONT_PX.lg);
    expect(tableCellFontPx(21, 40)).toBe(21);
    expect(tableCellFontPx('scale', 40)).toBe(scaleCellFontPx(40));
    expect(tableCellFontPx(undefined, 40)).toBe(CELL_FONT_PX.md);
    expect(tableCellFontPx(undefined, 40, 19)).toBe(19);
  });
});
