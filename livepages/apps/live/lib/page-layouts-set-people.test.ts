import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livepages/document';
import { PAGE_LAYOUTS } from '@livepages/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the People and Ideas set.
const TALL = { x: 0, y: 0, width: 683, height: 1000 };
const WIDE = { x: 0, y: 0, width: 1000, height: 683 };
const STORY = { x: 0, y: 0, width: 929, height: 1769 };
const build = (id: string, box = TALL) => PAGE_LAYOUTS.find((l) => l.id === id)!.build(box);
const shapes = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);
const labels = (els: Element[]) => els.map((e) => ('label' in e ? (e.label ?? '') : ''));

const IDS = [
  'org-chart',
  'testimonials',
  'meet-the-speakers',
  'employee-spotlight',
  'values',
  'idea-board',
  'persona',
  'shout-outs',
];

describe('People and Ideas layouts', () => {
  it('fill the category to twelve, each with its own label', () => {
    const people = PAGE_LAYOUTS.filter((l) => l.category === 'people');
    expect(people).toHaveLength(12);
    for (const id of IDS) expect(people.some((l) => l.id === id)).toBe(true);
    expect(new Set(people.map((l) => l.label)).size).toBe(12);
  });

  it('org chart: a lead over three crews, joined by lines', () => {
    const els = build('org-chart');
    expect(labels(els)).toEqual(expect.arrayContaining(['Hannah Brooks', 'Marcus Bell']));
    // The lead's card and three crew cards.
    expect(shapes(els, 'square').filter((e) => e.height > 100)).toHaveLength(4);
    // A story page closes on the team's numbers.
    expect(shapes(build('org-chart', STORY), 'stat-row')).toHaveLength(1);
    expect(shapes(els, 'stat-row')).toHaveLength(0);
  });

  it('testimonials: three star ratings and a source line', () => {
    for (const box of [TALL, WIDE]) {
      const els = build('testimonials', box);
      expect(shapes(els, 'rating')).toHaveLength(3);
      expect(labels(els).some((l) => l.startsWith('Source:'))).toBe(true);
    }
  });

  it('testimonials: cards side by side on a wide page, stacked on a tall one', () => {
    const ratingYs = (box: typeof TALL) =>
      new Set(shapes(build('testimonials', box), 'rating').map((e) => e.y)).size;
    expect(ratingYs(WIDE)).toBe(1);
    expect(ratingYs(TALL)).toBe(3);
  });

  it('speakers: four photos with times, four across when wide, two when tall', () => {
    const rows = (box: typeof TALL) =>
      new Set(
        build('meet-the-speakers', box)
          .filter((e) => e.type === 'image')
          .map((e) => (e.type === 'image' ? e.y : 0)),
      ).size;
    expect(rows(WIDE)).toBe(1);
    expect(rows(TALL)).toBe(2);
    expect(shapes(build('meet-the-speakers'), 'stadium')).toHaveLength(4);
    expect(shapes(build('meet-the-speakers'), 'banner')).toHaveLength(1);
  });

  it('spotlight: one photo and three questions', () => {
    for (const box of [TALL, WIDE, STORY]) {
      const els = build('employee-spotlight', box);
      expect(els.filter((e) => e.type === 'image')).toHaveLength(1);
      expect(labels(els).filter((l) => l.endsWith('?'))).toHaveLength(3);
    }
  });

  it('values: six icons in discs', () => {
    const els = build('values');
    expect(shapes(els, 'icon')).toHaveLength(6);
    expect(shapes(els, 'circle')).toHaveLength(6);
  });

  it('idea board: six turned sticky notes, each with its votes, and a next step', () => {
    const els = build('idea-board', WIDE);
    const notes = els.filter((e) => e.type === 'sticky');
    expect(notes).toHaveLength(6);
    expect(notes.every((n) => n.rotation !== 0)).toBe(true);
    expect(shapes(els, 'circle')).toHaveLength(6);
    expect(shapes(els, 'card')).toHaveLength(1);
  });

  it('persona: a quote, goals and frustrations, and two traits', () => {
    for (const box of [TALL, WIDE]) {
      const els = build('persona', box);
      expect(shapes(els, 'speech-bubble')).toHaveLength(1);
      expect(labels(els)).toEqual(expect.arrayContaining(['Goals', 'Frustrations']));
      expect(shapes(els, 'progress-bar')).toHaveLength(2);
    }
  });

  it('shout-outs: a colleague of the month with an award, and three notes', () => {
    const els = build('shout-outs');
    expect(
      shapes(els, 'icon').filter((e) => e.type === 'shape' && e.iconId === 'heart'),
    ).toHaveLength(3);
    expect(shapes(els, 'icon').some((e) => e.type === 'shape' && e.iconId === 'award')).toBe(true);
  });
});
