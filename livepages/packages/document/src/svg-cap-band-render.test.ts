import { capBandBaselineY } from '@livediagram/icons';
import { describe, expect, it } from 'vitest';
import { createComponent, createShape, renderElementsToSvg, type Tab } from './index';

// SVG text in a shape sits on its cap band (docs/specs/004-interface-design/optical-alignment.md): the
// glyph drawn over a disc keeps the alphabetic baseline, half a cap height below the disc's centre.
// `dominant-baseline: central` would centre the em box instead, leaving a digit high.

const colors = { accent: '#be123c', surface: '#ffe4e6', ink: '#881337' };
const svgOf = (elements: unknown[]) =>
  renderElementsToSvg({ id: 't', name: 'T', elements } as unknown as Tab, { padding: 0 });

// Every <circle> immediately followed by a <text>: the glyph drawn in that disc.
function discGlyphs(svg: string) {
  const re =
    /<circle cx="([\d.-]+)" cy="([\d.-]+)" r="[\d.]+"[^<>]*\/>(<text [^<>]*>)([^<]*)<\/text>/g;
  return [...svg.matchAll(re)].map(([, , cy, open, glyph]) => ({
    cy: Number(cy),
    y: Number(/ y="([\d.-]+)"/.exec(open!)![1]),
    px: Number(/ font-size="([\d.]+)"/.exec(open!)![1]),
    central: /dominant-baseline="central"/.test(open!),
    glyph,
  }));
}

describe('SVG disc glyphs', () => {
  it.each(['process', 'callout', 'header'] as const)(
    '%s centres its disc glyph on its cap band',
    (kind) => {
      const glyphs = discGlyphs(svgOf([createComponent(kind, 0, 0, colors)]));
      expect(glyphs.length).toBeGreaterThan(0);
      for (const g of glyphs) {
        expect(g.central, `${kind} "${g.glyph}"`).toBe(false);
        expect(g.y).toBeCloseTo(capBandBaselineY(g.cy, g.px), 1);
      }
    },
  );
});

describe('SVG progress label', () => {
  it.each(['progress-bar', 'progress-ring'] as const)(
    '%s centres its percentage on its cap band',
    (kind) => {
      const el = createShape(kind, 0, 0);
      const svg = svgOf([el]);
      const open = /<text [^<>]*>(?=\d+%<\/text>)/.exec(svg)?.[0] ?? '';
      expect(open, 'the label').not.toBe('');
      expect(open).not.toMatch(/dominant-baseline="central"/);
      const y = Number(/ y="([\d.-]+)"/.exec(open)![1]);
      const top = Number(/<svg[^<>]* viewBox="([\d.-]+) ([\d.-]+)/.exec(svg)![2]);
      expect(y - top).toBeCloseTo(capBandBaselineY(el.height / 2, 14), 1);
    },
  );
});
