import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
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
  const [pyramid] = shapesOf(els, 'pyramid');

  it('is one theme-locked Pyramid element with the five tiers, peak first', () => {
    expect(shapesOf(els, 'triangle')).toHaveLength(0);
    expect(pyramid?.conceptRows?.map((r) => r.label)).toEqual([
      'Purpose',
      'Vision',
      'Strategy',
      'Goals',
      'Initiatives',
    ]);
    expect(pyramid?.themeLockFill).toBe(true);
  });

  it('gives each tier a guiding question card on the rail', () => {
    const cards = shapesOf(els, 'card');
    expect(cards.map((c) => c.pageTitle?.endsWith('?'))).toEqual(Array(5).fill(true));
    expect(cards.every((c) => c.iconId && c.cardMedia === 'tile' && c.themeLockFill)).toBe(true);
    expect(cards.every((c) => c.accentEdge === 'left')).toBe(true);
    // The rail sits clear of the pyramid, to its right.
    expect(cards.every((c) => c.x > pyramid!.x + pyramid!.width)).toBe(true);
  });

  it('opens with a bold title', () => {
    const title = els.find((el) => el.type === 'text' && el.textSize === 'lg');
    expect(title).toMatchObject({ textBold: true });
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

  it('shows four tested ideas, each tagged with the region it landed in', () => {
    const chips = shapesOf(els, 'stadium')
      .slice(1)
      .map((s) => s.label);
    expect(chips).toEqual(['Sweet spot', 'Unbuildable', 'Unsustainable', 'Useless']);
    // The rail sits clear of the circles, to their right.
    const rightmost = Math.max(...circles.map((c) => c.x + c.width));
    const chipShapes = shapesOf(els, 'stadium').slice(1);
    expect(chipShapes.every((c) => c.x > rightmost)).toBe(true);
  });
});

describe('user journey template', () => {
  const els = buildTemplate('journey', 0, 0);
  const stickies = els.filter((el) => el.type === 'sticky');
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

  it('marks the two likely root causes in red and keys them', () => {
    const roots = els.filter((el) => el.type === 'text' && el.textColor === '#e11d48');
    expect(roots.map((r) => (r as { label?: string }).label)).toEqual([
      'Orders batched daily, not hourly',
      'Courier cut-off is 3pm',
    ]);
    expect(texts(els).some((t) => t.startsWith('Likely root cause'))).toBe(true);
  });
});

describe('timeline template', () => {
  const els = buildTemplate('timeline', 0, 0);
  const allCircles = shapesOf(els, 'circle');
  // The milestone discs; the three small ones are the legend's keys.
  const circles = allCircles.filter((c) => c.width > 30);

  it('colours six milestones by status and keys them in a legend', () => {
    expect(allCircles).toHaveLength(9);
    expect(circles).toHaveLength(6);
    const milestones = circles.map((c) => c.fillColor);
    expect(milestones.filter((f) => f === '#22c55e')).toHaveLength(3);
    expect(milestones.filter((f) => f === '#3b82f6')).toHaveLength(1);
    expect(milestones.filter((f) => f === '#ffffff')).toHaveLength(2);
    expect(allCircles.every((c) => c.themeLockFill)).toBe(true);
    const t = texts(els);
    for (const key of ['Done', 'In progress', 'Up next']) expect(t).toContain(key);
  });

  it('puts a glyph in every milestone disc', () => {
    const glyphs = shapesOf(els, 'icon');
    expect(glyphs).toHaveLength(6);
    circles.forEach((c, i) => {
      expect(centreOf(glyphs[i]!).x).toBeCloseTo(centreOf(c).x, 5);
      expect(centreOf(glyphs[i]!).y).toBeCloseTo(centreOf(c).y, 5);
    });
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
