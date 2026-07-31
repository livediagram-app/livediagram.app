import { describe, expect, it } from 'vitest';
import { createArrow, createShape } from '@livediagram/diagram';
import { paintableArrowFields, paintableBoxedFields } from './format-painter';
import {
  DEFAULT_FORMAT_CONFIG,
  filterPaintedFields,
  formatCopiesSummary,
  formatGroupOf,
  formatPaintsAnything,
  parseFormatConfig,
  FORMAT_GROUPS,
} from './format-config';

// A source with every paintable field actually set, so the projections below
// produce their full key set rather than a sparse one.
const richShape = {
  ...createShape('square', 0, 0),
  fillColor: '#fff',
  strokeColor: '#000',
  strokeWidth: 'bold' as const,
  strokeStyle: 'dashed' as const,
  borderRadius: 'lg' as const,
  colorPreset: 'brand',
  textColor: '#111',
  textSize: 'lg' as const,
  textAlignX: 'left' as const,
  textAlignY: 'top' as const,
  textBold: true,
  textItalic: true,
  textUnderline: true,
  textStrikethrough: true,
  font: 'mono',
  padding: 'lg' as const,
  opacity: 0.5,
  shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.2 },
  animation: 'pulse' as const,
  animationSpeed: 'slow' as const,
  animationRepeat: true,
  iconAnimation: 'spin' as const,
  iconAnimationSpeed: 'fast' as const,
  iconAnimationRepeat: true,
  iconSize: 'lg' as const,
  aspectLocked: true,
} as unknown as Parameters<typeof paintableBoxedFields>[0];

const richArrow = {
  ...createArrow(0, 0, 10, 10),
  strokeColor: '#000',
  strokeWidth: 'bold' as const,
  strokeStyle: 'dashed' as const,
  opacity: 0.7,
  arrowEnds: 'both' as const,
  arrowheadSize: 'lg' as const,
  arrowheadShape: 'triangle' as const,
  arrowStyle: 'curved' as const,
  routeBehind: true,
  flow: 'dash' as const,
  flowSpeed: 'slow' as const,
  flowRepeat: true,
  textColor: '#111',
  textSize: 'sm' as const,
  textBold: true,
  textItalic: true,
  textUnderline: true,
  textStrikethrough: true,
  font: 'mono',
} as unknown as Parameters<typeof paintableArrowFields>[0];

describe('the field → toggle mapping', () => {
  // The load-bearing test: lib/format-painter.ts decides what CAN be painted,
  // and the panel decides which of it does. A field added there but not here
  // would travel regardless of every toggle — silently, and only on some
  // elements. This makes that a failing test instead of a bug report.
  it('assigns every field the boxed projection can produce', () => {
    const unmapped = Object.keys(paintableBoxedFields(richShape)).filter(
      (field) => formatGroupOf(field) === undefined,
    );
    expect(unmapped).toEqual([]);
  });

  it('assigns every field the arrow projection can produce', () => {
    const unmapped = Object.keys(paintableArrowFields(richArrow)).filter(
      (field) => formatGroupOf(field) === undefined,
    );
    expect(unmapped).toEqual([]);
  });
});

describe('filterPaintedFields', () => {
  it('passes everything through with the default config', () => {
    const projection = paintableBoxedFields(richShape);
    expect(filterPaintedFields(projection, DEFAULT_FORMAT_CONFIG)).toEqual(projection);
  });

  it('keeps only the enabled groups', () => {
    const config = {
      ...DEFAULT_FORMAT_CONFIG,
      copies: { fill: true, border: false, text: false, effects: false, size: false },
    };
    const painted = filterPaintedFields(paintableBoxedFields(richShape), config);
    expect(painted).toEqual({ fillColor: '#fff', colorPreset: 'brand' });
  });

  it('leaves an arrow’s line look under Border', () => {
    const config = {
      ...DEFAULT_FORMAT_CONFIG,
      copies: { fill: false, border: true, text: false, effects: false, size: false },
    };
    const painted = filterPaintedFields(paintableArrowFields(richArrow), config);
    expect(Object.keys(painted).sort()).toEqual([
      'arrowEnds',
      'arrowStyle',
      'arrowheadShape',
      'arrowheadSize',
      'routeBehind',
      'strokeColor',
      'strokeStyle',
      'strokeWidth',
    ]);
  });

  it('paints nothing when every toggle is off', () => {
    const config = {
      ...DEFAULT_FORMAT_CONFIG,
      copies: { fill: false, border: false, text: false, effects: false, size: false },
    };
    expect(filterPaintedFields(paintableBoxedFields(richShape), config)).toEqual({});
    expect(formatPaintsAnything(config)).toBe(false);
  });
});

describe('formatCopiesSummary', () => {
  it('reads as "Everything" when nothing has been turned off', () => {
    expect(formatCopiesSummary(DEFAULT_FORMAT_CONFIG)).toBe('Everything');
  });

  it('names the enabled groups in panel order', () => {
    expect(
      formatCopiesSummary({
        ...DEFAULT_FORMAT_CONFIG,
        copies: { fill: false, border: true, text: true, effects: false, size: false },
      }),
    ).toBe('Border, Text');
  });

  it('says so when nothing is enabled', () => {
    expect(
      formatCopiesSummary({
        ...DEFAULT_FORMAT_CONFIG,
        copies: { fill: false, border: false, text: false, effects: false, size: false },
      }),
    ).toBe('Nothing');
  });
});

describe('parseFormatConfig', () => {
  it('costs one toggle, not the set, when an entry is unreadable', () => {
    const parsed = parseFormatConfig({ copies: { fill: false, border: 'yes' }, mode: 'once' });
    expect(parsed.copies.fill).toBe(false);
    // 'yes' isn't a boolean, so Border keeps its default rather than the set
    // collapsing.
    expect(parsed.copies.border).toBe(true);
    expect(parsed.mode).toBe('once');
  });

  it('falls back completely for junk, and covers every group', () => {
    const parsed = parseFormatConfig('not json');
    expect(parsed).toEqual(DEFAULT_FORMAT_CONFIG);
    for (const group of FORMAT_GROUPS) expect(parsed.copies[group.id]).toBe(true);
  });
});
