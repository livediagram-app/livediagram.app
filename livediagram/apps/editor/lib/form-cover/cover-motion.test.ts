import { describe, expect, it } from 'vitest';
import { contrastRatio, getBuiltInTheme } from '@livediagram/document';
import { sameFill, type PageColourFill, type PageMotion } from './colour-background';
import { backgroundCategoryOf, isCustomGradient } from './cover-paint';
import {
  colouringOf,
  hueTurned,
  motionFill,
  motionPaint,
  motionSeed,
  PAGE_MOTION_CATALOGUE,
  PAGE_MOTION_COLOURINGS,
} from './cover-motion';

// docs/specs/030-forms/forms.md "The form card, top to bottom", Cover: an animated background.
const theme = getBuiltInTheme('ocean');

describe('animated backgrounds', () => {
  it('offers every motion once, each with a label and a colouring', () => {
    // Keyed by the stored type, so a motion the type gains and this list lacks fails the typecheck.
    const every: Record<PageMotion, true> = {
      flow: true,
      drift: true,
      aurora: true,
      ripple: true,
      ribbons: true,
      mesh: true,
      starfield: true,
      'retro-grid': true,
      bokeh: true,
      waves: true,
      spotlight: true,
      beams: true,
      sunburst: true,
      fireflies: true,
      snowfall: true,
      lava: true,
      'dot-wave': true,
      clouds: true,
      warp: true,
      orbits: true,
      radar: true,
      equaliser: true,
      confetti: true,
      threads: true,
    };
    expect(PAGE_MOTION_CATALOGUE.map((m) => m.id).sort()).toEqual(Object.keys(every).sort());
    for (const m of PAGE_MOTION_CATALOGUE) expect(m.label.length).toBeGreaterThan(0);
  });

  // Reading a stored cover back (a reload, an unknown motion, a speed out of range) is @livediagram/page-background's,
  // tested there.
  it('is stored as a gradient with a motion, told apart from a plain one', () => {
    const fill = motionFill(theme, 'aurora', 'deep');
    expect(fill.kind).toBe('gradient');
    const still = { ...fill, motion: undefined } as PageColourFill;
    expect(sameFill(fill, still)).toBe(false);
    expect(backgroundCategoryOf(fill)).toBe('animated');
    expect(isCustomGradient(fill, [])).toBe(false);
  });

  it('finds the colouring a fill is in, for this theme', () => {
    for (const { id } of PAGE_MOTION_COLOURINGS) {
      expect(colouringOf(theme, motionFill(theme, 'waves', id))).toBe(id);
    }
  });

  it('paints its moving parts in a light that reads on a dark fill', () => {
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

describe('animated background speed', () => {
  it('tells two speeds of the same motion apart', () => {
    const f = motionFill(theme, 'waves', 'deep');
    expect(sameFill(f, { ...f, speed: 2 } as PageColourFill)).toBe(false);
    expect(sameFill(f, { ...f, speed: 1 } as PageColourFill)).toBe(true);
  });
});
