import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livediagram/document';
import { PAGE_LAYOUTS, type PageLayout } from '@livediagram/templates';

// docs/specs/007-editor/illustrate-pages.md "Layouts": the Steps and Time category's further
// layouts (Staircase, Customer Journey, Project Plan, Decision Flow, How-To).
const TALL = { x: 0, y: 0, width: 682, height: 1011 };
const WIDE = { x: 0, y: 0, width: 1011, height: 682 };
const SQUARE = { x: 0, y: 0, width: 930, height: 930 };
const STORY = { x: 0, y: 0, width: 930, height: 1768 };

const layout = (id: string): PageLayout => {
  const l = PAGE_LAYOUTS.find((p) => p.id === id);
  if (!l) throw new Error(`no layout ${id}`);
  return l;
};
const shapes = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);
const arrows = (els: Element[]) => els.filter((e) => e.type === 'arrow');
const labelled = (els: Element[], label: string) =>
  els.filter((e) => 'label' in e && e.label === label);

describe('Steps and Time layouts', () => {
  it('are all in the Steps and Time category, twelve in all', () => {
    for (const id of ['staircase', 'customer-journey', 'project-plan', 'decision-flow', 'how-to']) {
      expect(layout(id).category).toBe('steps');
    }
    expect(PAGE_LAYOUTS.filter((l) => l.category === 'steps')).toHaveLength(12);
  });

  it('Staircase rises as columns on a wide page and climbs as joined cards on a tall one', () => {
    const wide = layout('staircase').build(WIDE);
    const cols = shapes(wide, 'square');
    expect(cols).toHaveLength(5);
    // Each column taller than the last, all standing on the page's foot.
    for (let i = 1; i < cols.length; i += 1) {
      expect(cols[i]!.height).toBeGreaterThan(cols[i - 1]!.height);
      expect(cols[i]!.y + cols[i]!.height).toBe(cols[0]!.y + cols[0]!.height);
    }
    const tall = layout('staircase').build(TALL);
    const cards = shapes(tall, 'square');
    expect(cards).toHaveLength(5);
    expect(arrows(tall)).toHaveLength(4);
    // Level 1 at the bottom left, each further level higher and further right.
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i]!.y).toBeLessThan(cards[i - 1]!.y);
      expect(cards[i]!.x).toBeGreaterThan(cards[i - 1]!.x);
    }
  });

  it('Customer Journey plots a mood face per stage, joined across or down the page', () => {
    for (const box of [WIDE, SQUARE, TALL, STORY]) {
      const els = layout('customer-journey').build(box);
      const faces = shapes(els, 'sticker');
      expect(faces).toHaveLength(5);
      expect(arrows(els)).toHaveLength(4);
      expect(faces.every((f) => f.stickerId?.startsWith('emoji-'))).toBe(true);
    }
    // Across: the happiest face (Love) sits highest; down: furthest right.
    const across = shapes(layout('customer-journey').build(WIDE), 'sticker');
    expect(Math.min(...across.map((f) => f.y))).toBe(across[4]!.y);
    const down = shapes(layout('customer-journey').build(TALL), 'sticker');
    expect(Math.max(...down.map((f) => f.x))).toBe(down[4]!.x);
  });

  it('Project Plan draws a progress bar per workstream, a launch diamond and today', () => {
    for (const box of [WIDE, TALL]) {
      const els = layout('project-plan').build(box);
      expect(shapes(els, 'progress-bar')).toHaveLength(5);
      expect(shapes(els, 'diamond')).toHaveLength(1);
      expect(labelled(els, 'Today')).toHaveLength(1);
    }
    // The summary: a ring beside the chart on a wide page, a stat row under it on a tall one.
    expect(shapes(layout('project-plan').build(WIDE), 'progress-ring')).toHaveLength(1);
    expect(shapes(layout('project-plan').build(TALL), 'stat-row')).toHaveLength(1);
  });

  it('Decision Flow joins three questions with Yes arrows and sends each No to its outcome', () => {
    for (const box of [WIDE, SQUARE, TALL, STORY]) {
      const els = layout('decision-flow').build(box);
      expect(shapes(els, 'diamond')).toHaveLength(3);
      const labels = arrows(els).map((a) => ('label' in a ? a.label : undefined));
      expect(labels.filter((l) => l === 'Yes')).toHaveLength(3);
      expect(labels.filter((l) => l === 'No')).toHaveLength(3);
    }
  });

  it('How-To sets six numbered photo steps: one row on a wide page, two rows otherwise', () => {
    const rowsOf = (els: Element[]) =>
      new Set(els.filter((e) => e.type === 'image').map((e) => e.y)).size;
    const wide = layout('how-to').build(WIDE);
    expect(wide.filter((e) => e.type === 'image')).toHaveLength(6);
    expect(rowsOf(wide)).toBe(1);
    expect(rowsOf(layout('how-to').build(TALL))).toBe(2);
    expect(rowsOf(layout('how-to').build(SQUARE))).toBe(2);
  });
});
