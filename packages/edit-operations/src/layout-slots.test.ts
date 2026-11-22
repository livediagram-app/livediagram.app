import { describe, expect, it } from 'vitest';
import {
  LAYOUT_SLOT_ITEMS_MAX,
  LAYOUT_TEXT_MAX,
  fillLayoutSlots,
  layoutSlots,
  readLayoutText,
  slotsInWords,
  type SlotElement,
} from './layout-slots';

type El = SlotElement & { size: number; label?: string };

const text = (id: string, label: string, size: number, y: number, extra: Partial<El> = {}): El => ({
  id,
  type: 'text',
  x: 40,
  y,
  width: 600,
  height: 40,
  label,
  size,
  ...extra,
});
// A bullet dot just left of a line at `y`, level with it.
const dot = (id: string, y: number): El => ({
  id,
  type: 'shape',
  shape: 'circle',
  x: 10,
  y: y + 15,
  width: 10,
  height: 10,
  label: '',
  size: 0,
});
const sizeOf = (el: SlotElement) => (el as El).size;
const relabel = (el: El, label: string, slot: string): El =>
  ({ ...el, label, slotSeen: slot }) as El;

// The bullets layout: a headline, five lines each beside its dot.
const BULLETS: El[] = [
  text('t', 'Slide title', 51, 0, { textBold: true }),
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    dot(`d${n}`, n * 100),
    text(`b${n}`, `Point ${n}`, 36, n * 100),
  ]),
];

describe('layoutSlots', () => {
  it('reads the headline, the line under it, bullets and the rest, in build order', () => {
    const els: El[] = [
      text('eyebrow', 'KICK-OFF', 25, 0, { textBold: true }),
      text('h', 'Building what comes next', 63, 40, { textBold: true }),
      text('s', 'Where we are going', 35, 120),
      dot('d', 200),
      text('b', 'A first detail', 36, 200),
      text('n', '01', 148, 300),
      text('f', 'Presenter name', 24, 400),
    ];
    expect(layoutSlots(els, sizeOf)).toEqual([
      { id: 'eyebrow', slot: 'body[0]' },
      { id: 'h', slot: 'title' },
      { id: 's', slot: 'subtitle' },
      { id: 'b', slot: 'bullets[0]' },
      { id: 'n', slot: 'figures[0]' },
      { id: 'f', slot: 'body[1]' },
    ]);
  });

  it('takes the first of two headlines the same size', () => {
    const slots = layoutSlots([text('a', 'One', 40, 0), text('b', 'Two', 40, 50)], sizeOf);
    expect(slots.map((s) => s.slot)).toEqual(['title', 'body[0]']);
  });

  it('reads no subtitle from a bold, a bullet, a figure or an as-large line after the headline', () => {
    const after = (next: El[]) => layoutSlots([text('h', 'Headline', 60, 0), ...next], sizeOf);
    expect(after([text('x', 'Bold line', 30, 80, { textBold: true })])[1]!.slot).toBe('body[0]');
    expect(after([dot('d', 80), text('x', 'A bullet', 30, 80)])[1]!.slot).toBe('bullets[0]');
    expect(after([text('x', '09:00', 30, 80)])[1]!.slot).toBe('figures[0]');
    expect(after([text('x', 'Same size', 60, 80)])[1]!.slot).toBe('body[0]');
    expect(after([])).toEqual([{ id: 'h', slot: 'title' }]);
  });

  it('reads figures apart: no letter, or a number with a unit or two', () => {
    const slots = layoutSlots(
      ['73%', '3.2M', 'Q3', '“', '10 min', 'Grow'].map((l, i) => text(`e${i}`, l, 30 - i, i * 50)),
      sizeOf,
    );
    expect(slots.map((s) => s.slot)).toEqual([
      'figures[0]',
      'figures[1]',
      'figures[2]',
      'figures[3]',
      'title',
      'subtitle',
    ]);
  });

  it('reads words from texts, shapes and stickies, never an icon, an empty label or another type', () => {
    const els: El[] = [
      { ...text('shape', 'A quote on a card', 39, 0), type: 'shape', shape: 'square' },
      { ...text('note', 'A sticky', 20, 50), type: 'sticky' },
      { ...text('icon', 'star', 20, 100), type: 'shape', shape: 'icon' },
      { ...text('empty', '  ', 20, 150) },
      { ...text('img', 'Photo', 20, 200), type: 'image' },
      { id: 'nolabel', type: 'text', x: 0, y: 0, width: 1, height: 1, size: 5 },
    ];
    expect(layoutSlots(els, sizeOf)).toEqual([
      { id: 'shape', slot: 'title' },
      { id: 'note', slot: 'subtitle' },
    ]);
  });

  it('takes a circle for a bullet dot only when empty, smaller, left of the line and level with it', () => {
    const line = text('l', 'Line', 30, 100, { textBold: true });
    const slotAfter = (d: El) =>
      layoutSlots([text('h', 'Head', 60, 0, { textBold: true }), d, line], sizeOf).find(
        (s) => s.id === 'l',
      )!.slot;
    expect(slotAfter(dot('d', 100))).toBe('bullets[0]');
    expect(slotAfter({ ...dot('d', 100), shape: 'square' })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), type: 'text' })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), label: '1' })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), height: 60 })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), x: 100 })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), y: 0 })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), y: 300 })).toBe('body[0]');
    expect(slotAfter({ ...dot('d', 100), label: undefined })).toBe('bullets[0]');
  });
});

describe('slotsInWords', () => {
  it('names each slot, counting the lists', () => {
    expect(slotsInWords(layoutSlots(BULLETS, sizeOf))).toBe('title, bullets ×5');
    expect(
      slotsInWords([
        { id: 'a', slot: 'title' },
        { id: 'b', slot: 'subtitle' },
        { id: 'c', slot: 'body[0]' },
        { id: 'd', slot: 'figures[0]' },
        { id: 'e', slot: null },
      ]),
    ).toBe('title, subtitle, body ×1, figures ×1');
    expect(slotsInWords([])).toBe('');
  });
});

describe('fillLayoutSlots', () => {
  it('writes each slot and says nothing when every slot is given', () => {
    const out = fillLayoutSlots(
      BULLETS,
      { title: 'Why now', bullets: ['a', 'b', 'c', 'd', 'e'] },
      sizeOf,
      relabel,
    );
    expect(out.lines).toEqual([]);
    expect(out.elements.filter((e) => e.type === 'text').map((e) => e.label)).toEqual([
      'Why now',
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect((out.elements[0] as El & { slotSeen: string }).slotSeen).toBe('title');
    expect(out.slots).toHaveLength(6);
  });

  it('removes the bullets not given, each with its dot, and keeps their slots out', () => {
    const out = fillLayoutSlots(BULLETS, { bullets: ['only', 'two'] }, sizeOf, relabel);
    expect(out.elements.map((e) => e.id)).toEqual(['t', 'd1', 'b1', 'd2', 'b2']);
    expect(out.lines).toEqual(["Removed the layout's 3 unused bullets."]);
    expect(out.slots.map((s) => s.slot)).toEqual(['title', 'bullets[0]', 'bullets[1]']);
    expect(
      fillLayoutSlots(BULLETS, { bullets: ['1', '2', '3', '4'] }, sizeOf, relabel).lines,
    ).toEqual(["Removed the layout's 1 unused bullet."]);
  });

  it('says what a list could not hold, and what kept its sample', () => {
    const els: El[] = [
      text('h', 'Head', 60, 0),
      text('a', 'Sample a', 30, 50, { textBold: true }),
      text('b', 'Sample b', 30, 90),
    ];
    expect(fillLayoutSlots(els, { body: ['x', 'y', 'z', 'w'] }, sizeOf, relabel).lines).toEqual([
      '4 body items given, and the layout holds 2: the last 2 were not placed.',
    ]);
    expect(fillLayoutSlots(els, { body: ['x'] }, sizeOf, relabel).lines).toEqual([
      "1 body text keeps the layout's sample: change it by ref (the page's texts list each).",
    ]);
    expect(fillLayoutSlots(els, { body: [] }, sizeOf, relabel).lines).toEqual([
      "2 body texts keep the layout's sample: change them by ref (the page's texts list each).",
    ]);
    expect(
      fillLayoutSlots(els, { bullets: ['p'], subtitle: 'Sub' }, sizeOf, relabel).lines,
    ).toEqual([
      'This layout has no subtitle, so "Sub" was not placed.',
      'This layout has no bullets, so 1 item given was not placed.',
    ]);
    expect(fillLayoutSlots([], { title: 'T', body: ['a', 'b'] }, sizeOf, relabel).lines).toEqual([
      'This layout has no title, so "T" was not placed.',
      'This layout has no body, so 2 items given were not placed.',
    ]);
  });

  it('writes figures by their own slot, keeping the rest, and reads slots from the sample', () => {
    const els: El[] = [
      text('n', '01', 140, 0),
      text('h', 'Section', 70, 100),
      text('b', 'Note', 30, 200, { textBold: true }),
    ];
    const out = fillLayoutSlots(els, { title: 'Results', body: ['2026'] }, sizeOf, relabel);
    expect(out.elements.map((e) => e.label)).toEqual(['01', 'Results', '2026']);
    expect(out.lines).toEqual([]);
    const two = [
      text('a', '86k', 140, 0),
      text('h', 'Traction', 70, 100),
      text('b', '4.8', 140, 200),
    ];
    const figures = fillLayoutSlots(two, { figures: ['120k'] }, sizeOf, relabel);
    expect(figures.elements.map((e) => e.label)).toEqual(['120k', 'Traction', '4.8']);
    expect(figures.lines).toEqual([
      "1 figure keeps the layout's sample: change it by ref (the page's texts list each).",
    ]);
    expect(out.slots).toEqual([
      { id: 'n', slot: 'figures[0]' },
      { id: 'h', slot: 'title' },
      { id: 'b', slot: 'body[0]' },
    ]);
  });
});

describe('readLayoutText', () => {
  it('reads the four slots', () => {
    expect(readLayoutText({ title: 'T', subtitle: 'S', bullets: ['a'], body: [] })).toEqual({
      title: 'T',
      subtitle: 'S',
      bullets: ['a'],
      body: [],
    });
    expect(readLayoutText({})).toEqual({});
  });

  it('refuses what is not slots, in words', () => {
    expect(readLayoutText('Title')).toEqual({
      refused: '"text" is an object of slots: title, subtitle, bullets, body, figures.',
    });
    expect(readLayoutText(null)).toHaveProperty('refused');
    expect(readLayoutText(['a'])).toHaveProperty('refused');
    expect(readLayoutText({ heading: 'x' })).toEqual({
      refused: '"text" takes no "heading" (it takes title, subtitle, bullets, body, figures).',
    });
    expect(readLayoutText({ title: 3 })).toEqual({
      refused: `"text.title" is text of at most ${LAYOUT_TEXT_MAX} characters.`,
    });
    expect(readLayoutText({ subtitle: 'x'.repeat(LAYOUT_TEXT_MAX + 1) })).toHaveProperty('refused');
    const list = `"text.bullets" is a list of at most ${LAYOUT_SLOT_ITEMS_MAX} texts, each at most ${LAYOUT_TEXT_MAX} characters.`;
    expect(readLayoutText({ bullets: 'a' })).toEqual({ refused: list });
    expect(readLayoutText({ bullets: [1] })).toEqual({ refused: list });
    expect(readLayoutText({ bullets: ['x'.repeat(LAYOUT_TEXT_MAX + 1)] })).toEqual({
      refused: list,
    });
    expect(readLayoutText({ body: Array(LAYOUT_SLOT_ITEMS_MAX + 1).fill('a') })).toHaveProperty(
      'refused',
    );
  });
});

describe('an element with no box', () => {
  it('reads a dot or line with no box as one at the origin, never a bullet', () => {
    const bare = { id: 'c', type: 'shape', shape: 'circle', label: '', size: 0 } as El;
    const line = { id: 'l', type: 'text', label: 'A line', size: 20 } as El;
    expect(layoutSlots([text('t', 'Title', 50, 0), bare, line], sizeOf)).toEqual([
      { id: 't', slot: 'title' },
      { id: 'l', slot: 'subtitle' },
    ]);
  });
});
