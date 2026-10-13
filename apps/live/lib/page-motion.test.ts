import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  getBuiltInTheme,
  illustratePagesOf,
  PAGE_MOTIONS,
  sameFill,
  type PageFill,
} from '@livediagram/document';
import { backgroundCategoryOf, isCustomGradient } from './illustrate-page-paint';
import {
  colouringOf,
  hueTurned,
  motionFill,
  motionPaint,
  motionSeed,
  PAGE_MOTION_CATALOGUE,
  PAGE_MOTION_COLOURINGS,
} from './page-motion';

// docs/specs/007-editor/illustrate-pages.md "Animated backgrounds".
const theme = getBuiltInTheme('ocean');

describe('animated backgrounds', () => {
  it('offers every motion once, each with a label and a colouring', () => {
    expect(PAGE_MOTION_CATALOGUE.map((m) => m.id).sort()).toEqual([...PAGE_MOTIONS].sort());
    for (const m of PAGE_MOTION_CATALOGUE) expect(m.label.length).toBeGreaterThan(0);
  });

  it('is stored as a gradient with a motion, kept through a reload and told apart from a plain one', () => {
    const fill = motionFill(theme, 'aurora', 'deep');
    expect(fill.kind).toBe('gradient');
    const tab = {
      pages: [{ id: 'p', orientation: 'landscape', kind: 'slide', background: { fill } }],
    };
    const back = illustratePagesOf(JSON.parse(JSON.stringify(tab)))[0]!.background!.fill!;
    expect(back).toEqual(fill);
    const still = { ...fill, motion: undefined } as PageFill;
    expect(sameFill(fill, still)).toBe(false);
    expect(backgroundCategoryOf(fill)).toBe('animated');
    expect(isCustomGradient(fill, [])).toBe(false);
  });

  it('drops a motion it does not know', () => {
    const tab = {
      pages: [
        {
          id: 'p',
          orientation: 'landscape',
          background: {
            fill: {
              kind: 'gradient',
              from: '#000000',
              to: '#111111',
              angle: 160,
              motion: 'lasers',
            },
          },
        },
      ],
    };
    expect(illustratePagesOf(tab)[0]!.background!.fill).not.toHaveProperty('motion');
  });

  it('finds the colouring a fill is in, for this theme', () => {
    for (const { id } of PAGE_MOTION_COLOURINGS) {
      expect(colouringOf(theme, motionFill(theme, 'waves', id))).toBe(id);
    }
  });

  it('paints its moving parts in a light that reads on a dark page', () => {
    const fill = motionFill(theme, 'starfield', 'night');
    if (fill.kind !== 'gradient') throw new Error('gradient');
    const p = motionPaint(fill);
    expect(contrastRatio(p.hi, fill.from)).toBeGreaterThan(4.5);
    expect(p.warm).not.toBe(p.cool);
  });

  it('turns a hue round the wheel and keeps the same seeds everywhere', () => {
    expect(hueTurned('#ff0000', 120, 0.5)).toBe('#20df20');
    expect(motionSeed(3, 7)).toBe(motionSeed(3, 7));
    expect(motionSeed(3, 7)).toBeGreaterThanOrEqual(0);
    expect(motionSeed(3, 7)).toBeLessThan(1);
  });
});
