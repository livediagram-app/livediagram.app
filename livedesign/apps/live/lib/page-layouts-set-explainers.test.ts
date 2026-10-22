import { describe, expect, it } from 'vitest';
import type { Element } from '@livepages/document';
import { PAGE_LAYOUTS } from '@livepages/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the Explainers category's layouts, each a
// page that teaches one thing. A4's content boxes, portrait and landscape, and a story's.
const TALL = { x: 0, y: 0, width: 682, height: 1011 };
const WIDE = { x: 0, y: 0, width: 1011, height: 682 };
const SQUARE = { x: 0, y: 0, width: 928, height: 928 };
const STORY = { x: 0, y: 0, width: 928, height: 1768 };

const IDS = [
  'explain-how-it-works',
  'explain-anatomy',
  'explain-key-concepts',
  'explain-cheat-sheet',
  'explain-glossary',
  'explain-myths-facts',
  'explain-fact-file',
  'explain-lesson-summary',
  'explain-formula',
] as const;

const layout = (id: (typeof IDS)[number]) => PAGE_LAYOUTS.find((l) => l.id === id)!;
const kinds = (els: Element[]) =>
  els.map((e) => (e.type === 'shape' ? e.shape : e.type)).filter(Boolean);
// The box of an element that has one (every kind but an arrow).
const box = (e: Element) => e as Element & { x: number; y: number; width: number; height: number };
const labelled = (els: Element[], label: string) =>
  els.find((e) => 'label' in e && e.label === label);

describe('explainer layouts', () => {
  it('are all in the Explainers category, in order, with Title Case labels', () => {
    const set = PAGE_LAYOUTS.filter((l) => l.category === 'explainers');
    expect(set.map((l) => l.id)).toEqual([...IDS]);
    for (const l of set) {
      expect(l.label).toMatch(/^[A-Z][a-z]*( (and|[A-Z][a-z]*))*$/);
      expect(l.description).not.toMatch(/\u2014/);
    }
  });

  it('How It Works puts a numbered hotspot on its image for each step of its key', () => {
    for (const page of [TALL, WIDE, SQUARE]) {
      const els = layout('explain-how-it-works').build(page);
      expect(els.filter((e) => e.type === 'image')).toHaveLength(1);
      // Four hotspots and four key discs.
      for (const n of ['1', '2', '3', '4']) {
        expect(els.filter((e) => e.type === 'shape' && e.label === n)).toHaveLength(2);
      }
    }
  });

  it('Anatomy joins each of its six labels to a spot on the image by a headless leader', () => {
    const els = layout('explain-anatomy').build(TALL);
    const leaders = els.filter((e) => e.type === 'arrow');
    expect(leaders).toHaveLength(6);
    for (const a of leaders) expect(a.type === 'arrow' && a.arrowEnds).toBe('none');
  });

  it('Key Concepts arrows run from its hub to all six ideas, on a tall and a wide page', () => {
    for (const page of [TALL, WIDE, SQUARE]) {
      const els = layout('explain-key-concepts').build(page);
      const hub = labelled(els, 'Strong password')!;
      const arrows = els.filter((e) => e.type === 'arrow');
      expect(arrows).toHaveLength(6);
      for (const a of arrows) {
        expect(a.type === 'arrow' && a.from.kind === 'pinned' && a.from.elementId).toBe(hub.id);
      }
    }
    // Wide: ideas either side of the hub. Tall: above and below it.
    const wide = layout('explain-key-concepts').build(WIDE);
    const hubW = labelled(wide, 'Strong password')!;
    expect(
      wide
        .filter((e) => e.type === 'shape' && e.shape === 'circle')
        .some((c) => box(c).x + box(c).width < box(hubW).x),
    ).toBe(true);
    const tall = layout('explain-key-concepts').build(TALL);
    const hubT = labelled(tall, 'Strong password')!;
    expect(
      tall
        .filter((e) => e.type === 'shape' && e.shape === 'circle')
        .some((c) => box(c).y + box(c).height < box(hubT).y),
    ).toBe(true);
  });

  it('Cheat Sheet sets sixteen keycaps, in one column on a story and two elsewhere', () => {
    const caps = (els: Element[]) =>
      els.filter(
        (e) => e.type === 'shape' && e.shape === 'square' && /\+|F2|Page Down/.test(e.label ?? ''),
      );
    const tall = caps(layout('explain-cheat-sheet').build(TALL));
    expect(tall).toHaveLength(16);
    expect(new Set(tall.map((c) => box(c).x)).size).toBe(2);
    expect(
      new Set(caps(layout('explain-cheat-sheet').build(STORY)).map((c) => box(c).x)).size,
    ).toBe(1);
  });

  it('Glossary is in A to Z order, each term under its letter tile', () => {
    const els = layout('explain-glossary').build(TALL);
    const letters = els
      .filter((e) => e.type === 'shape' && e.shape === 'square')
      .map((e) => ('label' in e ? e.label : ''));
    expect(letters).toEqual([...letters].sort());
    expect(letters).toHaveLength(8);
  });

  it('Myths and Facts joins each myth to its fact, side by side or, on a story, one over the other', () => {
    for (const [page, from, to] of [
      [TALL, 'e', 'w'],
      [STORY, 's', 'n'],
    ] as const) {
      const arrows = layout('explain-myths-facts')
        .build(page)
        .filter((e) => e.type === 'arrow');
      expect(arrows).toHaveLength(4);
      for (const a of arrows) {
        if (a.type !== 'arrow' || a.from.kind !== 'pinned' || a.to.kind !== 'pinned')
          throw new Error('expected an arrow pinned at both ends');
        expect([a.from.anchor, a.to.anchor]).toEqual([from, to]);
      }
    }
  });

  it('Fact File holds a table of six facts beside its image on a wide page, under it on a tall one', () => {
    for (const [page, beside] of [
      [WIDE, true],
      [TALL, false],
    ] as const) {
      const els = layout('explain-fact-file').build(page);
      const table = els.find((e) => e.type === 'table')!;
      const image = els.find((e) => e.type === 'image')!;
      expect(table.type === 'table' && table.cells).toHaveLength(6);
      expect(box(table).x > box(image).x + box(image).width - 1).toBe(beside);
      expect(box(table).y > box(image).y + box(image).height - 1).toBe(!beside);
    }
  });

  it('Lesson Summary asks one question with four answers and gives the answer at the foot', () => {
    const els = layout('explain-lesson-summary').build(TALL);
    for (const l of ['A  Oxygen', 'B  Carbon dioxide', 'C  Nitrogen', 'D  Hydrogen']) {
      expect(labelled(els, l)).toBeTruthy();
    }
    const answer = els.find((e) => 'label' in e && e.label?.startsWith('Answer: B'))!;
    expect(Math.max(...els.map((e) => box(e).y))).toBe(box(answer).y);
  });

  it('Formula Explained leads each term to its meaning only where they sit in a row', () => {
    const lines = (page: typeof TALL) =>
      layout('explain-formula')
        .build(page)
        .filter((e) => e.type === 'arrow').length;
    expect(lines(WIDE)).toBe(4);
    expect(lines(SQUARE)).toBe(4);
    expect(lines(TALL)).toBe(0);
    expect(kinds(layout('explain-formula').build(TALL))).toContain('bar-chart');
  });
});
