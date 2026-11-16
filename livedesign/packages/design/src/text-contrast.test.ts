import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { contrastRatio, hexToRgb } from './colors';
import { createShape, createSticky, createText } from './index';
import type { BoxedElement, Element, ShapeElement } from './index';
import { layOutPages, type Page, type PageFill } from './page';
import {
  isLargeText,
  labelDrawnPx,
  labelIsBold,
  LARGE_TEXT_CONTRAST,
  TEXT_CONTRAST,
  textContrast,
  textGroundOf,
} from './text-contrast';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground".

const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
const at = (dx: number, dy: number) => ({ x: rect.x + dx, y: rect.y + dy });
const tabOf = (elements: Element[], fill?: PageFill, layers?: object[]) => ({
  elements,
  pages: [{ ...PAGE, ...(fill ? { background: { fill } } : {}) }] as Page[],
  ...(layers ? { layers: layers as never } : {}),
});

function text(id: string, dx = 40, dy = 40, extra: object = {}): BoxedElement {
  return {
    ...createText(at(dx, dy).x, at(dx, dy).y),
    id,
    width: 120,
    height: 30,
    label: 'Hello',
    ...extra,
  };
}
function shape(id: string, extra: Partial<ShapeElement> = {}, dx = 20, dy = 20): BoxedElement {
  return {
    ...createShape('square', at(dx, dy).x, at(dx, dy).y),
    id,
    width: 200,
    height: 120,
    ...extra,
  };
}

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
    expect(labelDrawnPx(text('t', 0, 0, { textSize: 'md', textScale: undefined }))).toBe(22);
    expect(labelDrawnPx(text('t', 0, 0, { textSize: 'lg' }))).toBe(32);
    expect(labelDrawnPx(text('t', 0, 0, { textSize: 20, textScale: 1.5 }))).toBe(30);
    const sticky = { ...createSticky(0, 0), id: 's' } as BoxedElement;
    expect(labelDrawnPx(sticky)).toBe(16);
    expect(labelIsBold(text('t', 0, 0, { textBold: true }))).toBe(true);
    expect(labelIsBold(text('t', 0, 0, { textBold: true, fontWeight: 400 }))).toBe(false);
    expect(labelIsBold(text('t', 0, 0, { fontWeight: 700 }))).toBe(true);
    expect(labelIsBold(text('t'))).toBe(false);
  });
});

describe('textGroundOf', () => {
  it('reads a shape label on its own fill', () => {
    const s = shape('s', { fillColor: '#1e293b' });
    expect(textGroundOf(s, tabOf([s]), 'light')).toEqual({ tones: ['#1e293b'], on: 'shape' });
  });

  it('reads a sticky note on its paper, and text over it on the note', () => {
    const note = { ...createSticky(at(20, 20).x, at(20, 20).y), id: 'n', fillColor: '#fef08a' };
    const sticky = note as BoxedElement;
    expect(textGroundOf(sticky, tabOf([sticky]), 'light')).toEqual({
      tones: ['#fef08a'],
      on: 'shape',
    });
    const t = { ...text('t'), x: sticky.x + 10, y: sticky.y + 10, width: 40, height: 20 };
    expect(textGroundOf(t, tabOf([sticky, t]), 'light')!.on).toBe('card');
  });

  it('reads a shape with no fill on its page', () => {
    const s = shape('s', { fillColor: 'transparent' });
    const tab = tabOf([s], { kind: 'solid', color: '#fef3c7' });
    expect(textGroundOf(s, tab, 'light')).toEqual({ tones: ['#fef3c7'], on: 'page' });
  });

  it('reads text on the plain paper as white', () => {
    const t = text('t');
    expect(textGroundOf(t, tabOf([t]), 'light')).toEqual({ tones: ['#ffffff'], on: 'page' });
  });

  it('reads text on the topmost filled box under it', () => {
    const low = shape('low', { fillColor: '#fecaca' });
    const high = shape('high', { fillColor: '#bfdbfe' });
    const t = text('t', 60, 60);
    expect(textGroundOf(t, tabOf([low, high, t]), 'light')).toEqual({
      tones: ['#bfdbfe'],
      on: 'card',
    });
    // A box painted after the text is over it, not under it.
    expect(textGroundOf(t, tabOf([low, t, high]), 'light')!.tones).toEqual(['#fecaca']);
    // A box that doesn't hold its centre is not under it.
    const away = shape('away', { fillColor: '#000000' }, 400, 400);
    expect(textGroundOf(t, tabOf([away, t]), 'light')!.on).toBe('page');
    // A box with no fill lets the page show through.
    const hollow = shape('hollow', { fillColor: 'transparent' });
    expect(textGroundOf(t, tabOf([hollow, t]), 'light')!.on).toBe('page');
  });

  it('reads every colour a gradient runs through under the text', () => {
    const t = text('t');
    const tab = tabOf([t], { kind: 'gradient', from: '#0f172a', to: '#f8fafc', angle: 180 });
    const ground = textGroundOf(t, tab, 'light')!;
    expect(ground.on).toBe('page');
    expect(ground.tones.length).toBeGreaterThan(1);
  });

  it('judges nothing on a picture', () => {
    const t = text('t');
    const picture = { kind: 'image', imageId: 'img-1', tone: '#808080' } as PageFill;
    expect(textGroundOf(t, tabOf([t], picture), 'light')).toBeNull();
    const image = {
      id: 'img',
      type: 'image',
      x: at(0, 0).x,
      y: at(0, 0).y,
      width: 400,
      height: 400,
      imageId: null,
    } as unknown as Element;
    expect(textGroundOf(t, tabOf([image, t]), 'light')).toBeNull();
  });

  it('judges nothing off every page', () => {
    const t = { ...text('t'), x: rect.x - 5000, y: rect.y - 5000 };
    expect(textGroundOf(t, tabOf([t]), 'light')).toBeNull();
  });

  it('stays quick on a large tab: one walk, worked out when the picker opens', () => {
    const many: Element[] = [];
    for (let i = 0; i < 5000; i += 1) many.push(shape(`s${i}`, { fillColor: 'transparent' }));
    const t = text('t', 60, 60);
    const tab = tabOf([...many, t]);
    const t0 = cpuNowMs();
    for (let i = 0; i < 20; i += 1) textGroundOf(t, tab, 'light');
    const ms = (cpuNowMs() - t0) / 20;
    // Measured 2.4 ms a call on an M-series Mac; the budget leaves room for a loaded CI runner.
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
