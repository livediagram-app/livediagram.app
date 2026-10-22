import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  getBuiltInTheme,
  PAGE_MOTIONS,
  parseColourBackground,
  sameFill,
  type PageColourFill,
} from '@liveplanner/project';
import { backgroundCategoryOf, isCustomGradient } from './page-paint';
import {
  colouringOf,
  hueTurned,
  motionFill,
  motionPaint,
  motionSeed,
  PAGE_MOTION_CATALOGUE,
  PAGE_MOTION_COLOURINGS,
} from './page-motion';

// docs/specs/030-forms/forms.md "The form card, top to bottom", Cover: an animated background.
const theme = getBuiltInTheme('ocean');

describe('animated backgrounds', () => {
  it('offers every motion once, each with a label and a colouring', () => {
    expect(PAGE_MOTION_CATALOGUE.map((m) => m.id).sort()).toEqual([...PAGE_MOTIONS].sort());
    for (const m of PAGE_MOTION_CATALOGUE) expect(m.label.length).toBeGreaterThan(0);
  });

  it('is stored as a gradient with a motion, kept through a reload and told apart from a plain one', () => {
    const fill = motionFill(theme, 'aurora', 'deep');
    expect(fill.kind).toBe('gradient');
    const back = parseColourBackground(JSON.parse(JSON.stringify({ fill })))!.fill!;
    expect(back).toEqual(fill);
    const still = { ...fill, motion: undefined } as PageColourFill;
    expect(sameFill(fill, still)).toBe(false);
    expect(backgroundCategoryOf(fill)).toBe('animated');
    expect(isCustomGradient(fill, [])).toBe(false);
  });

  it('drops a motion it does not know', () => {
    const background = {
      fill: { kind: 'gradient', from: '#000000', to: '#111111', angle: 160, motion: 'lasers' },
    };
    expect(parseColourBackground(background)!.fill).not.toHaveProperty('motion');
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
  const read = (speed: unknown) =>
    parseColourBackground({ fill: { ...motionFill(theme, 'waves', 'deep'), speed } })!.fill;

  it('keeps a speed in range through a reload, and drops one out of it or the default', () => {
    expect(read(2)).toMatchObject({ speed: 2 });
    expect(read(0.1)).not.toHaveProperty('speed');
    expect(read(9)).not.toHaveProperty('speed');
    expect(read(1)).not.toHaveProperty('speed');
  });

  it('tells two speeds of the same motion apart', () => {
    const f = motionFill(theme, 'waves', 'deep');
    expect(sameFill(f, { ...f, speed: 2 } as PageColourFill)).toBe(false);
    expect(sameFill(f, { ...f, speed: 1 } as PageColourFill)).toBe(true);
  });
});
