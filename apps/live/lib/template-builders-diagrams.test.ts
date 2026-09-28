import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { buildTemplate } from './template-builders';

// Structure pins for the strategy / diagram starters redesigned together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): pyramid, Venn, user journey,
// fishbone and the quick timeline. Each test maps to a sentence of that spec.

const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text').map((el) => (el as { label?: string }).label ?? '');
const shapesOf = (els: Element[], shape: string) =>
  els.filter((el) => el.type === 'shape' && el.shape === shape) as Extract<
    Element,
    { type: 'shape' }
  >[];
const centreOf = (el: { x: number; y: number; width: number; height: number }) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

describe('pyramid template', () => {
  const els = buildTemplate('pyramid', 0, 0);
  const bands = shapesOf(els, 'triangle');

  it('bands one triangle into five theme-locked tiers that share an apex', () => {
    expect(bands).toHaveLength(5);
    // The triangle silhouette's apex sits at 50% across, 2% down its box.
    const apexes = bands.map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height * 0.02 }));
    for (const a of apexes) {
      expect(a.x).toBeCloseTo(apexes[0]!.x, 5);
      expect(a.y).toBeCloseTo(apexes[0]!.y, 5);
    }
    // Largest band first, so each smaller one paints over the top of it.
    const widths = bands.map((b) => b.width);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
    expect(bands.every((b) => b.themeLockFill)).toBe(true);
  });

  it('names each tier and gives it a guiding question on the rail', () => {
    const t = texts(els);
    for (const tier of ['Purpose', 'Vision', 'Strategy', 'Goals', 'Initiatives'])
      expect(t).toContain(tier);
    expect(t.filter((l) => l.endsWith('?'))).toHaveLength(5);
  });
});

describe('venn template', () => {
  const els = buildTemplate('venn', 0, 0);
  const circles = shapesOf(els, 'circle');
  const byLabel = (label: string) =>
    els.find((el) => el.type === 'text' && el.label === label) as Extract<
      Element,
      { type: 'text' }
    >;
  const inside = (p: { x: number; y: number }, c: (typeof circles)[number]) =>
    Math.hypot(p.x - centreOf(c).x, p.y - centreOf(c).y) < c.width / 2;
  // Circles in builder order: Desirable, Feasible, Viable.
  const membership = (label: string) => circles.map((c) => inside(centreOf(byLabel(label)), c));

  it('draws three translucent, theme-locked circles', () => {
    expect(circles).toHaveLength(3);
    for (const c of circles) {
      expect(c.themeLockFill).toBe(true);
      expect(c.opacity).toBeLessThan(1);
    }
  });

  it('places each set heading in the region only its own circle covers', () => {
    expect(membership('Desirable')).toEqual([true, false, false]);
    expect(membership('Feasible')).toEqual([false, true, false]);
    expect(membership('Viable')).toEqual([false, false, true]);
  });

  it('names every pairwise overlap for the lens it is missing', () => {
    expect(membership('Unsustainable')).toEqual([true, true, false]);
    expect(membership('Useless')).toEqual([false, true, true]);
    expect(membership('Unbuildable')).toEqual([true, false, true]);
  });

  it('crowns the three-way centre with a bold sweet-spot pill', () => {
    const spot = shapesOf(els, 'stadium').find((s) => s.label === 'Sweet spot');
    expect(spot?.colorPreset).toBe('bold');
    expect(circles.map((c) => inside(centreOf(spot!), c))).toEqual([true, true, true]);
  });
});

describe('user journey template', () => {
  const els = buildTemplate('journey', 0, 0);
  const stickies = els.filter((el) => el.type === 'sticky') as Extract<
    Element,
    { type: 'sticky' }
  >[];
  const faces = shapesOf(els, 'sticker');

  it('lays five numbered stages across the top', () => {
    const stages = shapesOf(els, 'stadium').map((s) => s.label);
    expect(stages).toEqual([
      '1  Discover',
      '2  Compare',
      '3  Book',
      '4  First class',
      '5  Come back',
    ]);
  });

  it('colours each lens row of stickies with its own fill', () => {
    // Doing / Thinking / Pain points / Opportunities: five stickies each.
    expect(stickies).toHaveLength(20);
    const fills = new Set(stickies.map((s) => s.fillColor));
    expect(fills.size).toBe(4);
    for (const f of fills) expect(stickies.filter((s) => s.fillColor === f)).toHaveLength(5);
    const t = texts(els);
    for (const row of ['Doing', 'Thinking', 'Feeling', 'Pain points', 'Opportunities'])
      expect(t).toContain(row);
  });

  it('draws the feeling curve through five emoji faces, dipping at the booking', () => {
    expect(faces).toHaveLength(5);
    expect(faces.every((f) => f.stickerId?.startsWith('emoji-'))).toBe(true);
    const ys = faces.map((f) => f.y);
    // Lower on the canvas = a worse mood; the painful sign-up is the low point.
    expect(ys.indexOf(Math.max(...ys))).toBe(2);
    const ids = new Set(faces.map((f) => f.id));
    const curve = els.filter(
      (el) =>
        el.type === 'arrow' &&
        el.from.kind === 'pinned' &&
        el.to.kind === 'pinned' &&
        ids.has(el.from.elementId) &&
        ids.has(el.to.elementId),
    );
    expect(curve).toHaveLength(4);
  });
});

describe('fishbone template', () => {
  const els = buildTemplate('fishbone', 0, 0);

  it('hangs six category bones off the spine, two sub-causes on each', () => {
    const tags = shapesOf(els, 'stadium').map((s) => s.label);
    expect(tags).toEqual(['People', 'Process', 'Tools', 'Materials', 'Measurement', 'Environment']);
    // Two rib captions per bone, right-aligned onto their ribs.
    const ribs = els.filter(
      (el) => el.type === 'text' && el.textAlignX === 'right' && el.textAlignY === 'bottom',
    );
    expect(ribs).toHaveLength(12);
  });

  it('angles every bone at the same slant', () => {
    const slants = els
      .filter(
        (el): el is Extract<Element, { type: 'arrow' }> =>
          el.type === 'arrow' &&
          el.from.kind === 'free' &&
          el.to.kind === 'free' &&
          el.strokeWidth === 2 &&
          el.from.y !== el.to.y,
      )
      .map((b) => {
        if (b.from.kind !== 'free' || b.to.kind !== 'free') throw new Error('free');
        return Math.abs((b.to.y - b.from.y) / (b.to.x - b.from.x));
      });
    expect(slants).toHaveLength(6);
    for (const s of slants) expect(s).toBeCloseTo(Math.sqrt(3), 5);
  });

  it('makes the problem the bold head of the fish', () => {
    const head = shapesOf(els, 'square')[0];
    expect(head?.label).toBe('Orders ship 2 days late');
    expect(head?.colorPreset).toBe('bold');
  });
});

describe('timeline template', () => {
  const els = buildTemplate('timeline', 0, 0);
  const circles = shapesOf(els, 'circle');

  it('colours six milestones by status and keys them in a legend', () => {
    // Six milestones plus three legend dots.
    expect(circles).toHaveLength(9);
    const milestones = circles.slice(0, 6).map((c) => c.fillColor);
    expect(milestones.filter((f) => f === '#22c55e')).toHaveLength(3);
    expect(milestones.filter((f) => f === '#3b82f6')).toHaveLength(1);
    expect(milestones.filter((f) => f === '#ffffff')).toHaveLength(2);
    expect(circles.every((c) => c.themeLockFill)).toBe(true);
    const t = texts(els);
    for (const key of ['Done', 'In progress', 'Up next']) expect(t).toContain(key);
  });

  it('marks Today between the milestone in progress and the next one', () => {
    const today = shapesOf(els, 'stadium').find((s) => s.label === 'Today')!;
    const x = centreOf(today).x;
    const inProgress = centreOf(circles[3]!).x;
    const next = centreOf(circles[4]!).x;
    expect(x).toBeGreaterThan(inProgress);
    expect(x).toBeLessThan(next);
  });
});
