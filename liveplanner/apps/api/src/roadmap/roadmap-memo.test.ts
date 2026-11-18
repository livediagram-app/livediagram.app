import { describe, expect, it } from 'vitest';
import type { PublicRoadmap } from '@liveplanner/api-schema';
import type { Item } from '@liveplanner/items';
import { ROADMAP_MEMO_MAX, RoadmapMemo, pageFor, shownOf, type BuiltRoadmap } from './roadmap-memo';

// roadmap-memo.ts: a kept page answers while the plan's change count holds, marks a voter per read, and keeps at most
// ROADMAP_MEMO_MAX pages.
const card = (id: string, votes: Record<string, number> = {}) =>
  ({ id, fields: { votes } }) as unknown as Item;

const page = (voting = true): PublicRoadmap => ({
  title: 'Roadmap',
  voting,
  suggestPath: null,
  look: {} as PublicRoadmap['look'],
  columns: [
    {
      name: 'Now',
      count: 2,
      cards: [
        { id: 'a', title: 'A', votes: 1, voted: false },
        { id: 'b', title: 'B', votes: 0, voted: false },
      ],
    },
  ],
});

const built = (voting = true): BuiltRoadmap => {
  const p = page(voting);
  return { page: p, shown: shownOf(p, [card('a', { 'rv:me': 1 }), card('b'), card('hidden')]) };
};

describe('shownOf', () => {
  it("keeps only the page's cards", () => {
    expect([...built().shown.keys()]).toEqual(['a', 'b']);
  });
});

describe('pageFor', () => {
  it('marks only the voter’s own cards', () => {
    const cards = pageFor(built(), 'rv:me').columns[0]!.cards;
    expect(cards.map((c) => c.voted)).toEqual([true, false]);
    expect(pageFor(built(), 'rv:other').columns[0]!.cards.map((c) => c.voted)).toEqual([
      false,
      false,
    ]);
  });

  it('answers the page as built for no voter, or with voting off', () => {
    const b = built();
    expect(pageFor(b, null)).toBe(b.page);
    const off = built(false);
    expect(pageFor(off, 'rv:me')).toBe(off.page);
  });

  it('leaves a card it cannot find unmarked', () => {
    const b = { ...built(), shown: new Map<string, Item>() };
    expect(pageFor(b, 'rv:me').columns[0]!.cards.every((c) => c.voted === false)).toBe(true);
  });
});

describe('RoadmapMemo', () => {
  it('answers a kept page until the change count moves', () => {
    let version = 7;
    const memo = new RoadmapMemo(() => version);
    expect(memo.get('lpr_x')).toBeNull();
    const b = built();
    memo.set('lpr_x', 7, b);
    expect(memo.get('lpr_x')).toBe(b);
    version = 8;
    expect(memo.get('lpr_x')).toBeNull();
    expect(memo.size).toBe(0);
  });

  it('never answers a page stamped before a write that landed during its build', () => {
    const memo = new RoadmapMemo(() => 9);
    memo.set('lpr_x', 8, built());
    expect(memo.get('lpr_x')).toBeNull();
  });

  it('keeps at most ROADMAP_MEMO_MAX pages, dropping the oldest', () => {
    const memo = new RoadmapMemo(() => 1);
    for (let i = 0; i <= ROADMAP_MEMO_MAX; i += 1) memo.set(`lpr_${i}`, 1, built());
    expect(memo.size).toBe(ROADMAP_MEMO_MAX);
    expect(memo.get('lpr_0')).toBeNull();
    expect(memo.get(`lpr_${ROADMAP_MEMO_MAX}`)).not.toBeNull();
    // Setting a kept code again moves it to the newest.
    memo.set('lpr_1', 1, built());
    memo.set('lpr_new', 1, built());
    expect(memo.get('lpr_1')).not.toBeNull();
    expect(memo.get('lpr_2')).toBeNull();
  });
});
