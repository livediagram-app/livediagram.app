import { describe, expect, it } from 'vitest';
import { ALI, SAM, item } from './test-items';
import {
  UNASSIGNED_KEY,
  boardOrder,
  isStandupPersonOrder,
  personKeyOf,
  seededRank,
  standupPeople,
  standupSeed,
} from './session-standup';

// docs/specs/026-plan/session-tabs.md "Stand-up": the cards grouped into people by Assignee, Unassigned last, in Board
// Order, by name, or shuffled for the day.
const JO = { id: 'p-jo', name: 'Jo', color: '#059669' };
const card = (title: string, status: string, rank: string, assignee?: typeof SAM) =>
  item({ title, status, ...(assignee ? { assignee } : {}) }, { rank });

const PLAN = ['doing', 'review'];
const a = card('A', 'review', 'a', SAM);
const b = card('B', 'doing', 'b', ALI);
const c = card('C', 'doing', 'a', SAM);
const d = card('D', 'doing', 'c');
const e = card('E', 'review', 'b', JO);
const titles = (cards: { fields: Record<string, unknown> }[]) =>
  cards.map((x) => x.fields['title']);

describe('boardOrder', () => {
  it('sorts by the stage in the plan, then hand order, an unknown stage last', () => {
    const stray = card('S', 'elsewhere', 'a');
    const bare = item({ title: 'N' }, { rank: 'z' });
    expect(titles(boardOrder([bare, a], PLAN))).toEqual(['A', 'N']);
    expect(titles(boardOrder([a, stray, b, e, c, d], PLAN))).toEqual([
      'C',
      'B',
      'D',
      'A',
      'E',
      'S',
    ]);
  });
});

describe('standupPeople', () => {
  const ordered = boardOrder([a, b, c, d, e], PLAN);

  it('groups by Assignee in Board Order, each person keeping the cards in order, Unassigned last', () => {
    const people = standupPeople(ordered);
    expect(people.map((p) => p.key)).toEqual([SAM.id, ALI.id, JO.id, UNASSIGNED_KEY]);
    expect(titles(people[0]!.cards)).toEqual(['C', 'A']);
    expect(people[0]!.person).toEqual(SAM);
    expect(people[3]!.person).toBeNull();
    expect(titles(people[3]!.cards)).toEqual(['D']);
  });

  it('orders by name, Unassigned still last', () => {
    expect(standupPeople(ordered, { order: 'alphabetical' }).map((p) => p.key)).toEqual([
      ALI.id,
      JO.id,
      SAM.id,
      UNASSIGNED_KEY,
    ]);
  });

  it('breaks a tie of names by key', () => {
    const twin = { ...SAM, id: 'p-aaa' };
    const people = standupPeople([card('X', 'doing', 'a', SAM), card('Y', 'doing', 'b', twin)], {
      order: 'alphabetical',
    });
    expect(people.map((p) => p.key)).toEqual(['p-aaa', SAM.id]);
  });

  it('shuffles the same way all day, and differently another day, Unassigned last', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      card(`P${i}`, 'doing', `r${i}`, { id: `p-${i}`, name: `P${i}`, color: '#000000' }),
    );
    const day = Date.UTC(2026, 10, 28, 9);
    const morning = standupPeople([...many, d], {
      order: 'shuffled',
      seed: standupSeed('t1', day),
    });
    const later = standupPeople([...many, d], {
      order: 'shuffled',
      seed: standupSeed('t1', day + 5 * 3_600_000),
    });
    const tomorrow = standupPeople([...many, d], {
      order: 'shuffled',
      seed: standupSeed('t1', day + 86_400_000),
    });
    expect(later.map((p) => p.key)).toEqual(morning.map((p) => p.key));
    expect(tomorrow.map((p) => p.key)).not.toEqual(morning.map((p) => p.key));
    expect(morning.at(-1)!.key).toBe(UNASSIGNED_KEY);
    expect(new Set(morning.map((p) => p.key)).size).toBe(9);
  });

  it('shuffles with no seed too, and has no Unassigned group when every card has someone', () => {
    const people = standupPeople([a, b], { order: 'shuffled' });
    expect(people.map((p) => p.key).sort()).toEqual([ALI.id, SAM.id].sort());
    expect(standupPeople([])).toEqual([]);
  });
});

describe('the rest', () => {
  it('keys a card by its Assignee, else Unassigned', () => {
    expect(personKeyOf(a)).toBe(SAM.id);
    expect(personKeyOf(d)).toBe(UNASSIGNED_KEY);
  });

  it('seeds by the tab and the UTC day', () => {
    expect(standupSeed('t1', Date.UTC(2026, 10, 28, 23, 59))).toBe('t1:2026-11-28');
    expect(seededRank('s', 'a')).toBe(seededRank('s', 'a'));
    expect(seededRank('s', 'a')).not.toBe(seededRank('s', 'b'));
  });

  it('reads a people order', () => {
    expect(isStandupPersonOrder('shuffled')).toBe(true);
    expect(isStandupPersonOrder('board')).toBe(false);
  });
});
