import { describe, expect, it } from 'vitest';
import type { Item } from '@livediagram/items';
import { ITEM_TRAIL_MAX, childrenOf, liveTrail, stepTrail, visibleTrail } from './item-trail';

// docs/specs/026-plan/plan-board.md "Open an item": the Breadcrumb's trail and a parent's Child Cards.

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, key: number, fields: Item['fields'] = {}): Item => ({
  id,
  type: 'task',
  key,
  rank: 'i',
  fields: { title: id, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const mapOf = (...items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe('stepTrail', () => {
  it('appends a card opened from inside the panel', () => {
    expect(stepTrail(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('goes back to a card already in the trail, dropping the ones after it', () => {
    expect(stepTrail(['a', 'b', 'c'], 'a')).toEqual(['a']);
    expect(stepTrail(['a', 'b', 'c'], 'b')).toEqual(['a', 'b']);
  });

  it('keeps at most ITEM_TRAIL_MAX cards, dropping the oldest', () => {
    let trail = ['c0'];
    for (let i = 1; i <= ITEM_TRAIL_MAX + 3; i++) trail = stepTrail(trail, `c${i}`);
    expect(trail).toHaveLength(ITEM_TRAIL_MAX);
    expect(trail[0]).toBe(`c${4}`);
    expect(trail.at(-1)).toBe(`c${ITEM_TRAIL_MAX + 3}`);
  });
});

describe('liveTrail', () => {
  it('ends on the open card, leaving out trashed and deleted cards', () => {
    const items = mapOf(item('a', 1), item('b', 2, { status: 'trash' }), item('d', 4));
    expect(liveTrail(['a', 'b', 'c', 'd'], 'd', items).map((i) => i.id)).toEqual(['a', 'd']);
  });

  it('is just the open card when the trail does not end on it', () => {
    const items = mapOf(item('a', 1), item('z', 9));
    expect(liveTrail(['a'], 'z', items).map((i) => i.id)).toEqual(['z']);
  });
});

describe('visibleTrail', () => {
  it('shows the crumbs nearest the current card and counts the folded ones', () => {
    expect(visibleTrail(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({
      folded: 2,
      crumbs: ['c', 'd', 'e'],
    });
    expect(visibleTrail(['a', 'b'], 3)).toEqual({ folded: 0, crumbs: ['a', 'b'] });
    expect(visibleTrail(['a', 'b'], 1)).toEqual({ folded: 1, crumbs: ['b'] });
  });
});

describe('childrenOf', () => {
  it('lists the cards naming the parent, in key order, trashed ones left out', () => {
    const items = mapOf(
      item('t3', 3, { parent: 'p' }),
      item('t1', 1, { parent: 'p' }),
      item('t2', 2, { parent: 'p', status: 'trash' }),
      item('other', 4, { parent: 'q' }),
      item('p', 5),
    );
    expect(childrenOf(items, 'p').map((i) => i.id)).toEqual(['t1', 't3']);
  });
});
