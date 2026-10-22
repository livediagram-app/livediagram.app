import { describe, expect, it } from 'vitest';
import { canvasSurface, contrastRatio } from './colors';
import {
  THEME_LINE_CONTRAST,
  THEME_TEXT_CONTRAST,
  themeColourMap,
  themeHalf,
} from './theme-halves';
import { shapeColorPresets } from './theme-presets';
import { THEMES } from './themes-data';
import type { Appearance, ThemeDefinition } from './themes';

// docs/specs/011-theme/light-and-dark.md "Contrast": every theme, in both halves, meets WCAG 2.2 AA. Text on its fill
// (or on the canvas when the fill is unset) at 4.5:1, outlines and arrows on the canvas at 3:1.
function failures(t: ThemeDefinition): string[] {
  const bg = t.backgroundColor;
  const out: string[] = [];
  const paints = [
    { name: 'element', fill: t.elementFill, stroke: t.elementStroke, text: t.elementText },
    ...(t.rootColor ? [{ name: 'root', ...t.rootColor }] : []),
    ...(t.palette ?? []).map((p, i) => ({ name: `palette ${i}`, ...p })),
    ...Object.entries(t.shapeColors ?? {}).flatMap(([k, c]) => (c ? [{ name: k, ...c }] : [])),
  ];
  for (const p of paints) {
    if (p.text) {
      const on = p.fill || bg;
      const r = contrastRatio(p.text, on);
      if (!(r >= THEME_TEXT_CONTRAST))
        out.push(`${p.name} text ${p.text} on ${on}: ${r.toFixed(2)}`);
    }
    if (p.stroke) {
      const r = contrastRatio(p.stroke, bg);
      if (!(r >= THEME_LINE_CONTRAST))
        out.push(`${p.name} stroke ${p.stroke} on ${bg}: ${r.toFixed(2)}`);
    }
  }
  return out;
}

describe('every theme is accessible in both halves', () => {
  for (const theme of THEMES) {
    for (const appearance of ['light', 'dark'] as Appearance[]) {
      it(`${theme.id} (${appearance})`, () => {
        expect(failures(themeHalf(theme, appearance))).toEqual([]);
      });
    }
  }
});

describe('colour presets follow the viewer’s half', () => {
  const mono = THEMES.find((t) => t.id === 'mono')!;
  const softIn = (a: Appearance) =>
    shapeColorPresets(themeHalf(mono, a)).find((p) => p.id === 'soft')!;

  it('a dark half derives its quiet tiers toward the canvas, not white', () => {
    expect(canvasSurface(softIn('dark').fill)).toBe('dark');
    expect(canvasSurface(softIn('light').fill)).toBe('light');
  });

  it('a Soft shape written in light draws as dark’s Soft for a dark viewer', () => {
    const map = themeColourMap(mono, 'dark');
    expect(map.get(softIn('light').fill.toLowerCase())).toBe(softIn('dark').fill);
    expect(map.get(softIn('light').text.toLowerCase())).toBe(softIn('dark').text);
  });
});
