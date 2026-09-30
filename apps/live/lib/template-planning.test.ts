import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { buildTemplate } from './template-builders';

// Structure pins for the planning starters redesigned together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Gantt chart, Roadmap and the
// horizontal + vertical milestone timelines. Each test maps to a sentence of
// that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Text = Extract<Element, { type: 'text' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const textsOf = (els: Element[]) => els.filter((el): el is Text => el.type === 'text');
const arrowsOf = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const text = (els: Element[], label: string) => textsOf(els).find((t) => t.label === label)!;
const byId = (els: Element[], id: string) => els.find((el) => el.id === id) as Shape;
const inside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const stickers = (els: Element[]) => shapesOf(els, 'sticker').map((s) => s.stickerId);

describe('gantt template', () => {
  const els = buildTemplate('gantt', 0, 0);
  const bars = shapesOf(els, 'progress-bar');
  const jan = text(els, 'January 2027');
  const weekW = text(els, '4').width;

  it('lays a month band over week-commencing dates beside a Task / Owner table', () => {
    for (const m of ['January 2027', 'February 2027', 'March 2027'])
      expect(text(els, m)).toBeTruthy();
    const weeks = textsOf(els).filter((t) => /^\d{1,2}$/.test(t.label ?? '') && t.width === weekW);
    expect(weeks.map((w) => w.label)).toEqual([
      '4',
      '11',
      '18',
      '25',
      '1',
      '8',
      '15',
      '22',
      '1',
      '8',
      '15',
      '22',
    ]);
    expect(text(els, 'Task')).toBeTruthy();
    expect(text(els, 'Owner')).toBeTruthy();
  });

  it('opens each of three workstreams with a summary bar spanning its tasks', () => {
    for (const s of ['Design', 'Build', 'Launch']) expect(text(els, s)).toBeTruthy();
    const summaries = shapesOf(els, 'square').filter((s) => s.height === 8);
    expect(summaries).toHaveLength(3);
    // Each summary runs from its first task's start to its last task's end.
    const groups = [bars.slice(0, 2), bars.slice(2, 4), bars.slice(4, 6)];
    summaries.forEach((sum, i) => {
      const start = Math.min(...groups[i]!.map((b) => b.x));
      const end = Math.max(...groups[i]!.map((b) => b.x + b.width));
      expect(sum.x).toBeCloseTo(start, 5);
      expect(sum.x + sum.width).toBeCloseTo(end, 5);
    });
  });

  it('draws every task as a progress bar snapped to the week columns', () => {
    expect(bars).toHaveLength(6);
    for (const b of bars) {
      // Inset 4px inside whole week columns.
      expect((b.x - 4 - jan.x) % weekW).toBeCloseTo(0, 5);
      expect((b.width + 8) % weekW).toBeCloseTo(0, 5);
      expect(b.progress).toBeGreaterThanOrEqual(0);
    }
    expect(bars.map((b) => b.progress)).toEqual([100, 100, 50, 45, 0, 0]);
  });

  it('names an owner with an initials avatar on every row', () => {
    const avatars = shapesOf(els, 'circle').filter((c) => /^[A-Z]$/.test(c.label ?? ''));
    // Six tasks plus the launch row.
    expect(avatars).toHaveLength(7);
    expect(avatars.every((a) => a.themeLockFill)).toBe(true);
  });

  it('links finish-to-start dependencies with pinned elbows, end to start', () => {
    const deps = arrowsOf(els).filter((a) => a.from.kind === 'pinned');
    expect(deps).toHaveLength(4);
    for (const d of deps) {
      expect(d.arrowStyle).toBe('angled');
      if (d.from.kind !== 'pinned' || d.to.kind !== 'pinned') throw new Error('unpinned');
      expect(d.from.anchor).toBe('e');
      expect(d.to.anchor).toBe('w');
      const from = byId(els, d.from.elementId);
      const to = byId(els, d.to.elementId);
      // The successor never starts before its predecessor ends.
      expect(to.x + to.width / 2).toBeGreaterThan(from.x + from.width);
    }
  });

  it('marks the launch with a dated amber diamond and a rocket', () => {
    const [diamond] = shapesOf(els, 'diamond');
    expect(diamond?.themeLockFill).toBe(true);
    expect(text(els, 'Wed 24 Mar')).toBeTruthy();
    expect(stickers(els)).toContain('emoji-rocket');
  });

  it('runs a dashed Today line under a pill, and badges the late task AT RISK', () => {
    const today = shapesOf(els, 'stadium').find((s) => s.label === 'Today')!;
    const line = arrowsOf(els).find((a) => a.strokeStyle === 'dashed')!;
    expect(line.from.kind === 'free' && line.from.x).toBeCloseTo(today.x + today.width / 2, 5);
    const badge = shapesOf(els, 'sticker').find((s) => s.stickerId === 'badge-at-risk')!;
    const api = bars[2]!;
    // Stuck on the API bar's top-right corner.
    expect(badge.x).toBeGreaterThan(api.x);
    expect(badge.x).toBeLessThan(api.x + api.width);
    expect(badge.y).toBeLessThan(api.y);
  });
});

describe('roadmap template', () => {
  const els = buildTemplate('roadmap', 0, 0);
  const lanes = shapesOf(els, 'lane');
  const cards = shapesOf(els, 'square');

  it('states one goal in a pill with a target glyph', () => {
    const goal = shapesOf(els, 'stadium')[0]!;
    expect(goal.label).toMatch(/^Goal: /);
    expect(goal.iconId).toBe('target');
  });

  it('gives each horizon a confidence meter that empties with distance', () => {
    const dots = shapesOf(els, 'circle');
    expect(dots).toHaveLength(9);
    const filled = [0, 1, 2].map(
      (h) => dots.slice(h * 3, h * 3 + 3).filter((d) => d.fillColor === '#334155').length,
    );
    expect(filled).toEqual([3, 2, 1]);
    for (const h of ['Now', 'Next', 'Later']) expect(text(els, h)).toBeTruthy();
  });

  it('runs three theme swimlanes as lane elements, one card per horizon', () => {
    expect(lanes.map((l) => l.label)).toEqual(['Activation', 'Collaboration', 'Reliability']);
    expect(cards).toHaveLength(9);
    for (const lane of lanes) {
      expect(cards.filter((c) => inside(c, lane))).toHaveLength(3);
    }
  });

  it('pairs every initiative with the outcome it should move', () => {
    for (const card of cards) {
      expect(textsOf(els).filter((t) => inside(t, card))).toHaveLength(2);
    }
    expect(text(els, 'Day-1 activation 38% → 50%')).toBeTruthy();
  });

  it('encodes confidence in the card border: thick, normal, then dashed', () => {
    const columnXs = [...new Set(cards.map((c) => c.x))].sort((a, b) => a - b);
    expect(columnXs).toHaveLength(3);
    const col = (i: number) => cards.filter((c) => c.x === columnXs[i]);
    expect(col(0).every((c) => c.strokeWidth === 'thick')).toBe(true);
    expect(col(1).every((c) => c.strokeStyle === 'solid' && c.strokeWidth === 'medium')).toBe(true);
    expect(col(2).every((c) => c.strokeStyle === 'dashed')).toBe(true);
  });

  it('stickers a status on each Now card', () => {
    expect(stickers(els).sort()).toEqual(['badge-at-risk', 'badge-shipped', 'badge-wip']);
  });
});

describe('horizontal milestone timeline template', () => {
  const els = buildTemplate('milestone-timeline', 0, 0);
  const phases = shapesOf(els, 'stadium').filter((s) => s.themeLockFill);
  const cards = shapesOf(els, 'callout');
  const ribbonTop = phases[0]!.y;
  const ribbonBottom = ribbonTop + phases[0]!.height;

  it('runs a ribbon of four gapped, tint-locked phase segments', () => {
    expect(phases.map((p) => p.label)).toEqual(['Discover', 'Build', 'Launch', 'Grow']);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.x).toBeGreaterThan(phases[i - 1]!.x + phases[i - 1]!.width);
    }
  });

  it('places six milestones to scale, alternating above and below', () => {
    expect(cards).toHaveLength(6);
    const xs = cards.map((c) => c.x + c.width / 2);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    cards.forEach((c, i) => {
      if (i % 2 === 0) expect(c.y + c.height).toBeLessThan(ribbonTop);
      else expect(c.y).toBeGreaterThan(ribbonBottom);
    });
    // To scale, not evenly spaced.
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(new Set(gaps.map((g) => Math.round(g))).size).toBeGreaterThan(1);
  });

  it('hangs each callout card off a ring on the ribbon edge by a pinned stem', () => {
    const stems = arrowsOf(els).filter((a) => a.from.kind === 'pinned');
    expect(stems).toHaveLength(6);
    for (const s of stems) {
      if (s.from.kind !== 'pinned' || s.to.kind !== 'pinned') throw new Error('unpinned');
      const ring = byId(els, s.from.elementId);
      const ringCy = ring.y + ring.height / 2;
      expect([ribbonTop, ribbonBottom]).toContain(ringCy);
      expect(byId(els, s.to.elementId).shape).toBe('callout');
      expect(s.arrowEnds).toBe('none');
    }
    for (const c of cards) {
      expect(c.pageTitle).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.iconId).toBeTruthy();
    }
  });

  it('rides a date chip on every stem', () => {
    const chips = shapesOf(els, 'stadium').filter((s) => !s.themeLockFill);
    expect(chips.map((c) => c.label)).toEqual([
      '11 Jan',
      '26 Feb',
      '18 May',
      '7 Jul',
      '30 Sep',
      '1 Dec',
    ]);
  });

  it('makes launch day the hero: the largest, heaviest card, with stickers', () => {
    const hero = cards.find((c) => c.pageTitle === 'Launch day')!;
    expect(hero.strokeWidth).toBe('thick');
    for (const c of cards)
      expect(hero.width * hero.height).toBeGreaterThanOrEqual(c.width * c.height);
    expect(stickers(els).sort()).toEqual(['emoji-party-popper', 'emoji-rocket']);
  });
});

describe('vertical milestone timeline template', () => {
  const els = buildTemplate('milestone-timeline-vertical', 0, 0);
  const cards = shapesOf(els, 'callout');
  const spine = arrowsOf(els).find((a) => a.from.kind === 'free')!;
  const spineX = spine.from.kind === 'free' ? spine.from.x : NaN;
  const years = textsOf(els).filter((t) => /^20\d\d$/.test(t.label ?? ''));

  it('runs a downward spine', () => {
    if (spine.from.kind !== 'free' || spine.to.kind !== 'free') throw new Error('pinned spine');
    expect(spine.to.x).toBe(spine.from.x);
    expect(spine.to.y).toBeGreaterThan(spine.from.y);
  });

  it('alternates story cards and big years on opposite sides of the spine', () => {
    expect(cards).toHaveLength(7);
    expect(years.map((y) => y.label)).toEqual([
      '2016',
      '2018',
      '2020',
      '2022',
      '2024',
      '2026',
      '2027',
    ]);
    cards.forEach((card, i) => {
      const cardRight = card.x > spineX;
      expect(cardRight).toBe(i % 2 === 0);
      const year = years[i]!;
      expect(year.x > spineX).toBe(!cardRight);
      expect(year.textBold).toBe(true);
    });
  });

  it('puts a glyph disc on the spine for every chapter, stemmed to its card', () => {
    const discs = shapesOf(els, 'circle');
    expect(discs).toHaveLength(7);
    for (const d of discs) expect(d.x + d.width / 2).toBe(spineX);
    expect(shapesOf(els, 'icon')).toHaveLength(7);
    const stems = arrowsOf(els).filter((a) => a.from.kind === 'pinned');
    expect(stems).toHaveLength(7);
  });

  it('highlights B Corp, celebrates the tenth birthday and leaves a dashed next chapter', () => {
    const highlight = cards.find((c) => c.pageTitle === 'B Corp certified')!;
    expect(highlight.themeLockFill).toBe(true);
    expect(highlight.strokeWidth).toBe('thick');
    expect(stickers(els).sort()).toEqual(['emoji-cake', 'emoji-trophy']);
    const next = cards[cards.length - 1]!;
    expect(next.strokeStyle).toBe('dashed');
    expect(text(els, 'Next chapter')).toBeTruthy();
  });
});
