import { describe, expect, it } from 'vitest';
import { isNamedPerson, peopleKey, planPeople } from './plan-people';
import { assignedPeople, personNamed } from './plan-names';
import type { Item, ItemPerson } from './item';

const p = (id: string, name: string, color = '#000'): ItemPerson => ({ id, name, color });
const BY: ItemPerson = { id: 'by', name: 'By', color: '#000' };
const card = (n: number, assignee?: ItemPerson): Item => ({
  id: `c${n}`,
  type: 'task',
  key: n,
  rank: 'i',
  fields: assignee ? { title: 't', assignee } : { title: 't' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: BY,
  updatedBy: BY,
});

describe('planPeople', () => {
  it('lists self, team and assigned people once each, sorted by name', () => {
    const me = p('me', 'Zoe');
    const sam = p('sam', 'Sam');
    const contractor = p('n-casey', 'Casey');
    const people = planPeople(me, [sam, me], [sam, contractor]);
    expect(people.map((x) => x.id)).toEqual(['n-casey', 'sam', 'me']);
  });

  it('keeps the first source when an id repeats, and works without a self', () => {
    const fromTeam = p('sam', 'Sam (team)');
    const fromCard = p('sam', 'Sam (card)');
    expect(planPeople(null, [fromTeam], [fromCard])).toEqual([fromTeam]);
  });

  it('takes custom assignees from the cards, and drops one once no card holds them', () => {
    const casey = personNamed('Casey', []);
    const items = [card(1, casey), card(2, casey), card(3)];
    expect(planPeople(null, [], assignedPeople(items))).toEqual([casey]);
    expect(planPeople(null, [], assignedPeople([card(4)]))).toEqual([]);
  });

  it('names an existing person again rather than making a second one', () => {
    const casey = personNamed('Casey', []);
    const people = planPeople(p('me', 'Me'), [p('sam', 'Sam')], [casey]);
    expect(personNamed('  casey ', people)).toBe(casey);
    expect(personNamed('SAM', people).id).toBe('sam');
  });
});

describe('isNamedPerson', () => {
  it('is true for a custom assignee and false for an account', () => {
    expect(isNamedPerson(personNamed('Casey', []))).toBe(true);
    expect(isNamedPerson(p('a1b2c3', 'Sam'))).toBe(false);
  });
});

describe('peopleKey', () => {
  it('changes with an id, a name or a colour, and only then', () => {
    const a = [p('x', 'X', '#111')];
    expect(peopleKey(a)).toBe(peopleKey([p('x', 'X', '#111')]));
    expect(peopleKey(a)).not.toBe(peopleKey([p('x', 'Y', '#111')]));
    expect(peopleKey(a)).not.toBe(peopleKey([p('x', 'X', '#222')]));
    expect(peopleKey(a)).not.toBe(peopleKey([p('y', 'X', '#111')]));
  });
});
