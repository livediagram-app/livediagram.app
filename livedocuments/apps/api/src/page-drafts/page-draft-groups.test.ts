import { describe, expect, it } from 'vitest';
import { draftCatalogue } from './page-draft-asks';
import {
  placesFor,
  readGroups,
  slotGroups,
  type SlotGroup,
  type SlotRead,
} from './page-draft-groups';

// docs/specs/007-editor/describe-a-page.md "Cards written whole": a layout's paired texts found from the layout as built,
// and the model's objects mapped back to their slots.
const groupsOf = (kind: 'slide' | 'infographic', id: string) =>
  draftCatalogue(kind).find((l) => l.id === id)!.groups;
const shape = (g: SlotGroup) => g.members.map((m) => `${m.key}=${m.slot}`).join(' ');

describe('finding the groups', () => {
  it('a facts grid: six cards of a figure and its caption, the third on the title and subtitle slots', () => {
    const groups = groupsOf('infographic', 'facts-grid');
    expect(groups.map(shape)).toEqual([
      'figure=figures[0] caption=body[2]',
      'figure=figures[1] caption=body[3]',
      'figure=title caption=subtitle',
      'figure=figures[2] caption=body[4]',
      'figure=figures[3] caption=body[5]',
      'figure=figures[4] caption=body[6]',
    ]);
    expect(groups.every((g) => g.required.join() === 'figure,caption' && g.row === null)).toBe(
      true,
    );
  });

  it('a KPI card: its label above, its value, and the change under it', () => {
    const [first] = groupsOf('slide', 'kpi-dashboard');
    expect(shape(first!)).toBe('label=body[0] value=figures[0] delta=figures[1]');
    expect(first!.required).toEqual(['value', 'label']);
    expect(first!.figure).toBe('value');
  });

  it('a stat row’s stats, each on its row; a free figure and the lines in its column', () => {
    const stats = groupsOf('slide', 'key-stats');
    expect(stats).toHaveLength(6);
    expect(new Set(stats.map((g) => g.row)).size).toBe(2);
    expect(shape(stats[0]!)).toBe('figure=figures[0] caption=body[0]');
    expect(groupsOf('slide', 'slide-three-stats').map(shape)).toEqual([
      'figure=figures[0] caption=body[0] detail=body[1]',
      'figure=figures[1] caption=body[2] detail=body[3]',
      'figure=figures[2] caption=body[4] detail=body[5]',
    ]);
  });

  it('never a card of words, nor one holding a list of numbered items', () => {
    expect(groupsOf('slide', 'agenda')).toEqual([]);
    expect(groupsOf('slide', 'slide-four-ideas')).toEqual([]);
    expect(groupsOf('infographic', 'newsletter-front')).toEqual([]);
  });

  it('reads a text by its place: a lone figure’s card, a label above, three lines at most', () => {
    const size = (el: { id: string }) => (el.id.startsWith('big') ? 60 : 16);
    const card = {
      id: 'card',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    };
    const at = (id: string, y: number, x = 10, width = 80) => ({
      id,
      type: 'text',
      x,
      y,
      width,
      height: 20,
      label: id,
    });
    const r = (slot: string, el: SlotRead['el'], inCard = true): SlotRead => ({
      slot,
      el,
      part: null,
      card: inCard ? card : null,
    });
    const text: Record<string, string> = { 'figures[0]': '9', 'figures[1]': '3' };
    const textOf = (slot: string) => text[slot] ?? 'words';
    const read = [
      r('body[0]', at('label', 5)),
      r('figures[0]', at('big', 40)),
      r('body[1]', at('l1', 100)),
      r('body[2]', at('l2', 120)),
      r('body[3]', at('l3', 140)),
      r('body[4]', at('l4', 160)),
    ];
    const [g] = slotGroups(read, null, null, size, textOf);
    expect(shape(g!)).toBe(
      'label=body[0] value=figures[0] caption=body[1] detail=body[2] detail2=body[3]',
    );
    // A figure alone in its card leads the free lines under the card, in its column: not one far below, nor one
    // wider than the column.
    const lone = [
      r('figures[1]', at('big2', 40)),
      r('body[0]', at('under', 210), false),
      r('body[1]', at('wide', 230, 0, 600), false),
      r('body[2]', at('far', 900), false),
    ];
    expect(slotGroups(lone, null, null, size, textOf).map(shape)).toEqual([
      'figure=figures[1] caption=body[0]',
    ]);
    // A figure with no line by it is no group.
    expect(slotGroups([r('figures[1]', at('big3', 40), false)], null, null, size, textOf)).toEqual(
      [],
    );
  });
});

describe('reading the groups', () => {
  const pair = (n: number, row: string | null = null): SlotGroup => ({
    members: [
      { key: 'figure', slot: `f${n}` },
      { key: 'caption', slot: `c${n}` },
    ],
    required: ['figure', 'caption'],
    figure: 'figure',
    figureMax: null,
    row,
  });
  const words = (t: unknown) => (typeof t === 'string' ? t.trim() : '');

  it('fills groups in order, leaves the rest "", and stops at the layout’s count', () => {
    const read = readGroups(
      [pair(0), pair(1)],
      [
        { figure: '1', caption: 'a' },
        { figure: '2', caption: 'b' },
        { figure: '3', caption: 'c' },
      ],
      words,
    );
    expect(Object.fromEntries(read.words)).toEqual({ f0: '1', c0: 'a', f1: '2', c1: 'b' });
    const none = readGroups([pair(0)], 'not a list', words);
    expect(Object.fromEntries(none.words)).toEqual({ f0: '', c0: '' });
  });

  it('rejects a repeated figure, however it is spaced or cased, and an empty half', () => {
    const read = readGroups(
      [pair(0), pair(1), pair(2)],
      [
        { figure: '1,200', caption: 'a' },
        { figure: ' 1200 ', caption: 'again' },
        { figure: '3K', caption: '' },
        { value: '4', caption: 'd' },
      ],
      words,
    );
    expect(read.duplicates).toBe(1);
    expect(Object.fromEntries(read.words)).toEqual({
      f0: '1,200',
      c0: 'a',
      f1: '4',
      c1: 'd',
      f2: '',
      c2: '',
    });
  });

  it('never puts a number longer than a part’s number slot holds into it', () => {
    const [part] = groupsOf('slide', 'slide-agenda-grid');
    expect(part!.figureMax).toBe(3);
    expect(groupsOf('slide', 'key-stats')[0]!.figureMax).toBeNull();
    // A facts grid's "7" is a figure like its other cards'.
    expect(groupsOf('infographic', 'facts-grid').every((g) => g.figureMax === null)).toBe(true);
    const read = readGroups(
      [part!],
      [
        { label: 'Customers', value: '1.4M' },
        { label: 'Welcome', value: '01' },
      ],
      words,
    );
    expect([...read.words.values()]).toContain('01');
    expect([...read.words.values()]).not.toContain('1.4M');
  });

  it('spreads a short list evenly over stat rows, in reading order', () => {
    const rows = [
      pair(0, 'a'),
      pair(1, 'a'),
      pair(2, 'a'),
      pair(3, 'b'),
      pair(4, 'b'),
      pair(5, 'b'),
    ];
    expect(placesFor(rows, 4)).toEqual([0, 1, 3, 4]);
    expect(placesFor(rows, 1)).toEqual([0]);
    expect(placesFor(rows, 6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(placesFor(rows, 9)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(placesFor([pair(0, 'a'), pair(1, 'b'), pair(2, 'b'), pair(3, 'b')], 3)).toEqual([
      0, 1, 2,
    ]);
    // Cards, or one row: the first ones.
    expect(placesFor([pair(0), pair(1), pair(2)], 2)).toEqual([0, 1]);
    expect(placesFor([pair(0, 'a'), pair(1, 'a')], 1)).toEqual([0]);
  });
});
