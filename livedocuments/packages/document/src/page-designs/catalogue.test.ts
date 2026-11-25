import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  designsOfFamily,
  isPageDesignId,
  PAGE_DESIGN_BY_ID,
  PAGE_DESIGN_FAMILIES,
  PAGE_DESIGN_IDS,
  PAGE_DESIGNS,
  pageDesignLabel,
} from './catalogue';
import { DESIGN_DRAWERS } from './drawers';
import { designPalette } from './palette';
import { clearPageDesignCache, paintPageDesign } from './render';
import { resolveTuning } from './tuning';

const theme = { elementStroke: '#2563eb' };
const light = designPalette(theme, {}, false);
const dark = designPalette(theme, {}, true);
const SIZES: [number, number][] = [
  [1920, 1080],
  [794, 1123],
  [320, 200],
];

// Counts the SVG elements in markup: what a page's DOM carries for the design.
const nodes = (svg: string) => (svg.match(/<[a-zA-Z]/g) ?? []).length;

describe('page design catalogue (docs/specs/011-theme/page-designs.md "The catalogue")', () => {
  it('holds 55 designs over eight families, ids unique and in catalogue order', () => {
    expect(PAGE_DESIGNS.length).toBe(55);
    expect(new Set(PAGE_DESIGN_IDS).size).toBe(PAGE_DESIGN_IDS.length);
    expect(PAGE_DESIGNS.map((d) => d.id)).toEqual([...PAGE_DESIGN_IDS]);
    expect(PAGE_DESIGN_FAMILIES).toHaveLength(8);
    for (const f of PAGE_DESIGN_FAMILIES)
      expect(designsOfFamily(f.id).length).toBeGreaterThanOrEqual(3);
  });

  it('gives every design a drawer, a name, keywords and a busy weight in range', () => {
    for (const d of PAGE_DESIGNS) {
      expect(DESIGN_DRAWERS[d.id], d.id).toBeTypeOf('function');
      expect(d.label.length).toBeGreaterThan(2);
      expect(d.keywords.length).toBeGreaterThan(2);
      expect(d.busy).toBeGreaterThan(0);
      expect(d.busy).toBeLessThanOrEqual(1);
      if (d.variants) expect(new Set(d.variants.map((v) => v.id)).size).toBe(d.variants.length);
    }
  });

  it('offers animation on at least ten designs and only on designs that draw a moving layer', () => {
    const animated = PAGE_DESIGNS.filter((d) => d.animates);
    expect(animated.length).toBeGreaterThanOrEqual(10);
    for (const d of PAGE_DESIGNS) {
      const painted = paintPageDesign({
        design: { id: d.id },
        palette: light,
        width: 1920,
        height: 1080,
      });
      expect(
        painted.layers.some((l) => l.motion),
        d.id,
      ).toBe(d.animates === true);
    }
  });

  it('draws every design, every style, at three sizes on light and dark pages, as markup of our own', () => {
    clearPageDesignCache();
    for (const d of PAGE_DESIGNS)
      for (const variant of d.variants?.map((v) => v.id) ?? [undefined])
        for (const [w, h] of SIZES)
          for (const palette of [light, dark]) {
            const painted = paintPageDesign({
              design: { id: d.id, ...(variant ? { variant } : {}) },
              palette,
              width: w,
              height: h,
            });
            const svg = painted.layers.map((l) => l.svg).join('');
            expect(svg.length, `${d.id} ${variant} ${w}x${h}`).toBeGreaterThan(20);
            expect(svg).not.toMatch(/NaN|undefined|Infinity|<script|javascript:|on[a-z]+=/i);
          }
  });

  it('keeps each design under 1,600 nodes at 1920 x 1080, even at half scale', () => {
    for (const d of PAGE_DESIGNS) {
      const painted = paintPageDesign({
        design: { id: d.id, scale: 0.5 },
        palette: light,
        width: 1920,
        height: 1080,
      });
      expect(nodes(painted.layers.map((l) => l.svg).join('')), d.id).toBeLessThan(1600);
    }
  });

  it('draws every design at 1920 x 1080 within its CPU budget', () => {
    // docs/specs/011-theme/blueprints/page-designs.md "Performance": a cold draw of the whole catalogue well under a
    // frame per design; x10 for CI and coverage.
    const all = () => {
      clearPageDesignCache();
      for (const d of PAGE_DESIGNS)
        paintPageDesign({
          design: { id: d.id, seed: 7 },
          tuning: resolveTuning({ id: d.id, seed: 7 }),
          palette: dark,
          width: 1920,
          height: 1080,
        });
    };
    all();
    let best = Infinity;
    for (let r = 0; r < 3; r += 1) best = Math.min(best, cpuMsOf(all));
    expect(best / PAGE_DESIGNS.length).toBeLessThan(cpuBudgetMs(16));
  });

  it('names designs and tells its ids', () => {
    expect(pageDesignLabel('aurora')).toBe('Aurora');
    expect(pageDesignLabel('nope')).toBe('None');
    expect(pageDesignLabel(undefined)).toBe('None');
    expect(isPageDesignId('grid')).toBe(true);
    expect(isPageDesignId(3)).toBe(false);
    expect(PAGE_DESIGN_BY_ID.memphis.family).toBe('bold');
  });
});
