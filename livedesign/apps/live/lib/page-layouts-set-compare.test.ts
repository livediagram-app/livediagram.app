import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livedesign/document';
import { PAGE_LAYOUTS } from '@livedesign/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the Compare set beyond the core four.
const IDS = [
  'versus',
  'pricing-tiers',
  'swot',
  'effort-impact',
  'scorecard',
  'spectrum',
  'venn',
  'three-options',
] as const;

// Content boxes shaped like A4 portrait, A4 landscape, a square and a story.
const TALL = { x: 0, y: 0, width: 683, height: 1012 };
const WIDE = { x: 0, y: 0, width: 1012, height: 683 };
const SQUARE = { x: 0, y: 0, width: 928, height: 928 };
const STORY = { x: 0, y: 0, width: 928, height: 1768 };

const build = (id: string, box: typeof TALL) => PAGE_LAYOUTS.find((l) => l.id === id)!.build(box);
const shapes = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);
type Box = { x: number; y: number; width: number; height: number };
const labelled = (els: Element[], label: string) =>
  els.find((e) => 'label' in e && e.label === label) as Box | undefined;

describe('the Compare set', () => {
  it('lists every layout once, in the Compare category, twelve in all', () => {
    for (const id of IDS) {
      const found = PAGE_LAYOUTS.filter((l) => l.id === id);
      expect(found).toHaveLength(1);
      expect(found[0]!.category).toBe('compare');
    }
    expect(PAGE_LAYOUTS.filter((l) => l.category === 'compare')).toHaveLength(12);
  });

  it('Versus: a VS badge and a pair of bars for each of four stats, a source line', () => {
    for (const box of [TALL, WIDE, SQUARE]) {
      const els = build('versus', box);
      expect(labelled(els, 'VS')).toBeDefined();
      expect(shapes(els, 'progress-bar')).toHaveLength(8);
      expect(els.some((e) => 'label' in e && e.label?.startsWith('Source:'))).toBe(true);
    }
  });

  it('Versus: the contenders face to face on top when tall, out at the sides otherwise', () => {
    const name = (els: Element[], n: string) => labelled(els, n)!;
    const tall = build('versus', TALL);
    expect(name(tall, 'Remote').y).toBe(name(tall, 'Office').y);
    expect(name(tall, 'Remote').y).toBeLessThan(shapes(tall, 'progress-bar')[0]!.y);
    const wide = build('versus', WIDE);
    expect(name(wide, 'Remote').x + name(wide, 'Remote').width).toBeLessThanOrEqual(
      shapes(wide, 'progress-bar')[0]!.x,
    );
  });

  it('Pricing Tiers: three cards, one drawn heavier and badged Most popular', () => {
    for (const box of [TALL, WIDE, STORY]) {
      const els = build('pricing-tiers', box);
      expect(labelled(els, 'Most popular')).toBeDefined();
      const heavy = shapes(els, 'square').filter((s) => s.strokeWidth === 'extra-thick');
      expect(heavy).toHaveLength(1);
      expect(shapes(els, 'stadium').length).toBe(4);
    }
  });

  it('SWOT: two by two on a tall page, four in a row on a wide one, stacked on a story', () => {
    const cards = (els: Element[]) => shapes(els, 'square').filter((s) => s.strokeWidth === 'none');
    const rows = (els: Element[]) => new Set(cards(els).map((c) => c.y)).size;
    expect(rows(build('swot', TALL))).toBe(2);
    expect(rows(build('swot', WIDE))).toBe(1);
    expect(rows(build('swot', STORY))).toBe(4);
    for (const l of ['S', 'W', 'O', 'T']) expect(labelled(build('swot', TALL), l)).toBeDefined();
  });

  it('Effort vs Impact: every idea sits inside its quadrant, clear of the quadrant names', () => {
    for (const box of [TALL, WIDE, SQUARE, STORY]) {
      const els = build('effort-impact', box);
      const quads = shapes(els, 'square').filter((s) => s.borderRadius === 'md');
      expect(quads).toHaveLength(4);
      const names = ['Quick wins', 'Big bets', 'Fill-ins', 'Money pits'].map((n) =>
        labelled(els, n)!,
      );
      // The plotted ideas are Step numbers inside the grid; the key repeats the numbers beside it.
      const steps = shapes(els, 'step');
      expect(steps).toHaveLength(14);
      const inside = (d: (typeof steps)[number]) =>
        quads.some(
          (s) =>
            d.x >= s.x &&
            d.x + d.width <= s.x + s.width &&
            d.y >= s.y &&
            d.y + d.height <= s.y + s.height,
        );
      const discs = steps.filter(inside);
      expect(discs).toHaveLength(7);
      for (const d of discs) {
        for (const n of names) {
          const apart =
            d.x + d.width <= n.x ||
            d.x >= n.x + n.width ||
            d.y + d.height <= n.y ||
            d.y >= n.y + n.height;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it('Scorecard: three scores and a rating on each of four criteria per option', () => {
    for (const box of [TALL, WIDE, SQUARE]) {
      const els = build('scorecard', box);
      expect(shapes(els, 'rating')).toHaveLength(12);
      for (const s of ['4.8', '3.8', '3.0']) expect(labelled(els, s)).toBeDefined();
      expect(labelled(els, 'Top score')).toBeDefined();
    }
  });

  it('Spectrum: five discs on one rail, the trade-offs only where a tall page has room', () => {
    for (const box of [TALL, WIDE, SQUARE]) {
      const els = build('spectrum', box);
      const discs = shapes(els, 'circle');
      expect(discs).toHaveLength(5);
      expect(new Set(discs.map((d) => d.y)).size).toBe(1);
      expect(labelled(els, 'Our pick')).toBeDefined();
    }
    expect(labelled(build('spectrum', TALL), 'SET-UP TIME')).toBeDefined();
    expect(labelled(build('spectrum', WIDE), 'SET-UP TIME')).toBeUndefined();
  });

  it('Venn: two circles side by side on a wide page, one over the other on a tall one', () => {
    const circles = (box: typeof TALL) => shapes(build('venn', box), 'circle');
    const [a, b] = circles(WIDE);
    expect(a!.y).toBe(b!.y);
    expect(b!.x).toBeLessThan(a!.x + a!.width);
    const [c, d] = circles(TALL);
    expect(c!.x).toBe(d!.x);
    expect(d!.y).toBeLessThan(c!.y + c!.height);
  });

  it('Three Options: three cards, each an image, two ticks and a cross; one recommended', () => {
    for (const box of [TALL, WIDE, SQUARE]) {
      const els = build('three-options', box);
      expect(els.filter((e) => e.type === 'image')).toHaveLength(3);
      const icons = shapes(els, 'icon');
      expect(icons.filter((i) => i.iconId === 'check')).toHaveLength(6);
      expect(icons.filter((i) => i.iconId === 'x')).toHaveLength(3);
      expect(labelled(els, 'Recommended')).toBeDefined();
    }
  });
});
