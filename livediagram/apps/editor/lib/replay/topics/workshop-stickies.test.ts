import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { ADD, CHAPTERS, DEMO_IDS, NOTES, STICK, stickies, WRITE } from './workshop-stickies';

// Stickies and Stickers (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop). What every topic must
// hold is in topics.test.ts.

const tab = { id: 't', name: 'Tab', elements: [], backgroundColor: '#ffffff' } as unknown as Tab;
const centre = { x: 400, y: 300 };
const layout = stickies.layout({ centre, tab });
const labels = (index: number, ms: number) =>
  stickies
    .frame(index, ms, layout)
    .elements.filter((e) => e.type === 'sticky')
    .map((e) => (e.type === 'sticky' ? e.label : undefined));

describe('Stickies and Stickers', () => {
  it('plays Stickies, Write, Stickers', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'stickies-add',
      'stickies-write',
      'stickies-stickers',
    ]);
  });

  it('lays three stickies in a row and fits them to a phone-wide view', () => {
    expect(layout.notes.map((n) => n.type)).toEqual(['sticky', 'sticky', 'sticky']);
    expect(layout.notes[1]!.x - layout.notes[0]!.x).toBe(layout.notes[0]!.width + 24);
    const phone = stickies.layout({ centre, tab, size: { width: 390, height: 700 } } as never);
    const right = phone.notes[2]!.x + phone.notes[2]!.width;
    expect(phone.notes[0]!.x).toBeGreaterThanOrEqual(centre.x - 195);
    expect(right).toBeLessThanOrEqual(centre.x + 195);
  });

  it('drags the stickies out blank, one per visit to Write', () => {
    const open = (ms: number) => stickies.frame(0, ms, layout).open;
    expect(open(ADD[0]!.open)).toEqual(['bar-write']);
    expect(open(ADD[0]!.carry[0] + 300)).toEqual([]);
    expect(open(ADD[1]!.open)).toEqual(['bar-write']);
    expect(labels(0, ADD[1]!.carry[0] - 1)).toEqual(['']);
    expect(labels(0, CHAPTERS[0]!.ms)).toEqual(['', '', '']);
  });

  it('types each idea in turn, the sticky selected while it is typed on', () => {
    expect(labels(1, 0)).toEqual(['', '', '']);
    const mid = labels(1, (WRITE[0]!.type[0] + WRITE[0]!.type[1]) / 2)[0]!;
    expect(NOTES[0].startsWith(mid) && mid.length > 0).toBe(true);
    expect(stickies.frame(1, WRITE[1]!.select, layout).selectedId).toBe(DEMO_IDS.notes[1]);
    expect(labels(1, WRITE[1]!.select)).toEqual([NOTES[0], '', '']);
    expect(labels(1, CHAPTERS[1]!.ms)).toEqual([...NOTES]);
    expect(stickies.frame(1, CHAPTERS[1]!.ms, layout).selectedId).toBeNull();
  });

  it('opens Stickers on Reactions for each sticker and puts both back as the carry leaves', () => {
    const open = (ms: number) => stickies.frame(2, ms, layout).open;
    expect(open(STICK[0].open)).toEqual(['bar-stickers']);
    expect(open(STICK[0].group)).toEqual(['bar-stickers', 'stickers-reactions']);
    expect(open(STICK[0].carry[0] + 300)).toEqual([]);
    expect(open(STICK[1].group)).toEqual(['bar-stickers', 'stickers-reactions']);
  });

  it('lands a thumbs up and a heart on the corners of the first and last stickies', () => {
    const end = stickies.frame(2, CHAPTERS[2]!.ms, layout).elements;
    const thumbs = end.find((e) => e.id === DEMO_IDS.thumbs) as ShapeElement;
    const heart = end.find((e) => e.id === DEMO_IDS.heart) as ShapeElement;
    expect(thumbs).toMatchObject({ shape: 'sticker', stickerId: 'emoji-thumbs-up' });
    expect(heart).toMatchObject({ shape: 'sticker', stickerId: 'emoji-heart' });
    const [first, , last] = layout.notes;
    expect(thumbs.x).toBeGreaterThan(first!.x);
    expect(thumbs.x).toBeLessThan(first!.x + first!.width);
    expect(heart.x).toBeGreaterThan(last!.x);
    expect(end.at(-1)!.id).toBe(DEMO_IDS.heart);
  });

  it('presses the rail row for Reactions and the sticker tiles', () => {
    const finds = stickies
      .plan(2, layout)
      .flatMap((w) => (w.to.kind === 'find' ? [w.to.selector] : []));
    expect(finds).toEqual([
      'nav[aria-label="stickers groups"] > button:nth-child(2)',
      '[data-tour-id="palette-category-menu"] [aria-label="Thumbs up"]',
      'nav[aria-label="stickers groups"] > button:nth-child(2)',
      '[data-tour-id="palette-category-menu"] [aria-label="Red heart"]',
    ]);
  });
});
