import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { contrastRatio, hexToRgb } from './colour-math';
import type { BoxedElement, Element, TableElement } from './element';
import { mixHex } from './page-ink-contrast';
import { tableHeaderColours } from './table-header-colours';
import {
  cellTextGround,
  cellTextSize,
  isLargeText,
  labelDrawnPx,
  labelIsBold,
  LARGE_TEXT_CONTRAST,
  TEXT_CONTRAST,
  textContrast,
  textGroundIn,
  ZEBRA_TINT,
  type GroundBelow,
  type TextGround,
} from './text-contrast';

// Each product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground": the shared judge's table.

const PAPER: TextGround = { tones: ['#ffffff'], on: 'page' };
const paper: GroundBelow = () => PAPER;

const box = (id: string, type: string, extra: object = {}, x = 0, y = 0): BoxedElement =>
  ({ id, type, x, y, width: 200, height: 120, ...extra }) as unknown as BoxedElement;
const text = (id: string, extra: object = {}, x = 40, y = 40) =>
  box(id, 'text', { width: 120, height: 30, label: 'Hello', ...extra }, x, y);
const square = (id: string, extra: object = {}, x = 20, y = 20) =>
  box(id, 'shape', { shape: 'square', ...extra }, x, y);

// The hue of a #rrggbb, in degrees (HSL).
function hue(hex: string): number {
  const { r, g, b } = hexToRgb(hex)!;
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  if (d === 0) return 0;
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('textContrast', () => {
  it('matches the WCAG example ratios', () => {
    expect(textContrast('#000000', ['#ffffff'], false)!.ratio).toBeCloseTo(21, 5);
    expect(textContrast('#ffffff', ['#ffffff'], false)!.ratio).toBeCloseTo(1, 5);
    // #767676 on white is the classic AA pass at 4.54:1; #777777 the classic miss at 4.48:1.
    expect(textContrast('#767676', ['#ffffff'], false)!.ratio).toBeCloseTo(4.54, 2);
    expect(textContrast('#767676', ['#ffffff'], false)!.passes).toBe(true);
    expect(textContrast('#777777', ['#ffffff'], false)!.passes).toBe(false);
  });

  it('holds large text to 3:1 and normal text to 4.5:1', () => {
    // #949494 on white: about 3.03:1, large text only.
    const large = textContrast('#949494', ['#ffffff'], true)!;
    const normal = textContrast('#949494', ['#ffffff'], false)!;
    expect(large.needed).toBe(LARGE_TEXT_CONTRAST);
    expect(large.passes).toBe(true);
    expect(large.suggestion).toBeNull();
    expect(normal.needed).toBe(TEXT_CONTRAST);
    expect(normal.passes).toBe(false);
  });

  it('suggests the nearest shade of the same hue that passes', () => {
    for (const [colour, ground] of [
      ['#fde047', '#ffffff'], // yellow on white: darkened
      ['#60a5fa', '#ffffff'], // light blue on white
      ['#1e3a8a', '#0f172a'], // navy on a dark page: lightened
      ['#f97316', '#fb923c'], // orange on orange
    ] as const) {
      const c = textContrast(colour, [ground], false)!;
      expect(c.passes).toBe(false);
      expect(c.suggestion).not.toBeNull();
      expect(contrastRatio(c.suggestion!, ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      // The least change: only just past the target, not black or white.
      expect(contrastRatio(c.suggestion!, ground)).toBeLessThan(TEXT_CONTRAST + 0.3);
      expect(Math.abs(hue(c.suggestion!) - hue(colour))).toBeLessThan(4);
    }
  });

  it('reads the worst tone of a gradient and names it', () => {
    const c = textContrast('#334155', ['#ffffff', '#64748b'], false)!;
    expect(c.tone).toBe('#64748b');
    expect(c.ratio).toBeCloseTo(contrastRatio('#334155', '#64748b'), 5);
  });

  it('offers no shade when none of its hue passes on every tone', () => {
    const c = textContrast('#808080', ['#000000', '#ffffff'], false)!;
    expect(c.passes).toBe(false);
    expect(c.suggestion).toBeNull();
  });

  it('reads nothing it cannot judge', () => {
    expect(textContrast('transparent', ['#ffffff'], false)).toBeNull();
    expect(textContrast('#000000', [], false)).toBeNull();
    expect(textContrast('#000000', ['not-a-colour'], false)).toBeNull();
  });
});

describe('large text', () => {
  it('is 24px, or 18.66px in bold', () => {
    expect(isLargeText(24, false)).toBe(true);
    expect(isLargeText(23, false)).toBe(false);
    expect(isLargeText(19, true)).toBe(true);
    expect(isLargeText(18, true)).toBe(false);
  });

  it('measures a label as drawn, scale and weight included', () => {
    expect(labelDrawnPx(text('t', { textSize: 'md' }))).toBe(22);
    expect(labelDrawnPx(text('t', { textSize: 'lg' }))).toBe(32);
    expect(labelDrawnPx(text('t', { textSize: 20, textScale: 1.5 }))).toBe(30);
    expect(labelDrawnPx(square('s', { textSize: 20, textScale: 2 }))).toBe(40);
    // Only a text or a shape carries a scale; a sticky note's sizes run smaller.
    expect(labelDrawnPx(box('n', 'sticky', { textScale: 3 }))).toBe(16);
    expect(labelIsBold(text('t', { textBold: true }))).toBe(true);
    expect(labelIsBold(text('t', { textBold: true, fontWeight: 400 }))).toBe(false);
    expect(labelIsBold(text('t', { fontWeight: 700 }))).toBe(true);
    expect(labelIsBold(text('t'))).toBe(false);
  });
});

describe('textGroundIn', () => {
  it('reads a shape label on its own fill, and a sticky note on its paper', () => {
    const s = square('s', { fillColor: '#1e293b' });
    expect(textGroundIn(s, [s], 'light', paper)).toEqual({ tones: ['#1e293b'], on: 'shape' });
    const note = box('n', 'sticky', { fillColor: '#fef08a' });
    expect(textGroundIn(note, [note], 'light', paper)).toEqual({
      tones: ['#fef08a'],
      on: 'shape',
    });
  });

  it('reads text on the topmost filled box painted under it, else below', () => {
    const low = square('low', { fillColor: '#fecaca' });
    const high = square('high', { fillColor: '#bfdbfe' });
    const t = text('t', {}, 60, 60);
    expect(textGroundIn(t, [low, high, t], 'light', paper)).toEqual({
      tones: ['#bfdbfe'],
      on: 'card',
    });
    // A box painted after the text is over it, not under it.
    expect(textGroundIn(t, [low, t, high], 'light', paper)!.tones).toEqual(['#fecaca']);
    // A box that doesn't hold its centre is not under it; a hollow one lets what is below show.
    const away = square('away', { fillColor: '#000000' }, 400, 400);
    const hollow = square('hollow', { fillColor: 'transparent' });
    expect(textGroundIn(t, [away, hollow, t], 'light', paper)).toBe(PAPER);
    // A line is never under it.
    const line = { id: 'a', type: 'arrow' } as unknown as Element;
    expect(textGroundIn(t, [line, t], 'light', paper)).toBe(PAPER);
  });

  it('hands what is below the box its rectangle, and judges nothing on a picture', () => {
    const t = text('t');
    let asked: unknown;
    textGroundIn(t, [t], 'light', (b) => {
      asked = b;
      return null;
    });
    expect(asked).toEqual({ x: 40, y: 40, width: 120, height: 30 });
    const image = box('img', 'image', {}, 0, 0);
    expect(textGroundIn(t, [image, t], 'light', paper)).toBeNull();
  });

  it('stays quick on a large tab: one walk, worked out when the picker opens', () => {
    const many: Element[] = [];
    for (let i = 0; i < 5000; i += 1) many.push(square(`s${i}`, { fillColor: 'transparent' }));
    const t = text('t', {}, 60, 60);
    const painted = [...many, t];
    const t0 = cpuNowMs();
    for (let i = 0; i < 20; i += 1) textGroundIn(t, painted, 'light', paper);
    const ms = (cpuNowMs() - t0) / 20;
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('table cells', () => {
  const table = (extra: Partial<TableElement> = {}): TableElement => ({
    id: 'tbl',
    type: 'table',
    x: 0,
    y: 0,
    width: 300,
    height: 120,
    cells: [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ],
    ...extra,
  });

  it('reads a cell on its own background first', () => {
    const t = table({ cellStyles: [[{ bg: '#1e293b' }]] });
    expect(cellTextGround(t, 0, 0, 'light', PAPER)).toEqual({ tones: ['#1e293b'], on: 'cell' });
  });

  it('reads a header cell on its band', () => {
    const t = table({ headerRow: true });
    const band = tableHeaderColours(t, 'light').fill;
    expect(cellTextGround(t, 0, 1, 'light', PAPER)).toEqual({ tones: [band], on: 'cell' });
    // A header asking for no band reads on what is under it.
    const bare = table({ headerColumn: true, headerFill: 'transparent' });
    expect(cellTextGround(bare, 1, 0, 'light', PAPER)).toBe(PAPER);
  });

  it('reads a body cell on the table fill, a zebra row tinted with the grid', () => {
    const t = table({ fillColor: '#fef3c7', zebra: true, strokeColor: '#334155' });
    expect(cellTextGround(t, 0, 0, 'light', PAPER)!.tones).toEqual(['#fef3c7']);
    expect(cellTextGround(t, 1, 0, 'light', PAPER)!.tones).toEqual([
      mixHex('#fef3c7', '#334155', ZEBRA_TINT),
    ]);
  });

  it('reads an unfilled table on what is under it, banded rows tinted too', () => {
    const t = table({
      zebra: true,
      headerRow: true,
      headerFill: 'transparent',
      strokeColor: '#000000',
    });
    expect(cellTextGround(t, 1, 0, 'light', PAPER)).toBe(PAPER);
    expect(cellTextGround(t, 2, 0, 'light', PAPER)!.tones).toEqual([
      mixHex('#ffffff', '#000000', ZEBRA_TINT),
    ]);
    expect(cellTextGround(t, 2, 0, 'light', null)).toBeNull();
    // A grid colour that can't be read leaves the band out.
    const odd = table({ zebra: true, strokeColor: 'currentColor' });
    expect(cellTextGround(odd, 1, 0, 'light', PAPER)).toBe(PAPER);
  });

  it('measures a cell at its own size and weight, a header bold', () => {
    const t = table({ headerRow: true, cellStyles: [[], [{ textSize: 30, bold: false }]] });
    expect(cellTextSize(t, 0, 0)).toEqual({ px: 13, bold: true });
    expect(cellTextSize(t, 1, 0)).toEqual({ px: 30, bold: false });
    expect(cellTextSize(table({ textBold: true, cells: undefined }), 0, 0).bold).toBe(true);
  });
});
