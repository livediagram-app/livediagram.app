// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Item, ItemPerson } from '@liveplanner/items';
import { usePlanPeople } from './usePlanPeople';

const ME: ItemPerson = { id: 'me', name: 'Me', color: '#000' };
const CASEY: ItemPerson = { id: 'n-casey', name: 'Casey', color: '#111' };
const BY: ItemPerson = { id: 'by', name: 'By', color: '#000' };
const card = (id: string, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: BY,
  updatedBy: BY,
});
const NO_TEAM: ItemPerson[] = [];

describe('usePlanPeople', () => {
  it('offers the custom assignees the cards hold, and keeps the list while they stay the same', () => {
    const first = new Map([['a', card('a', { title: 'A', assignee: CASEY })]]);
    const { result, rerender } = renderHook(({ items }) => usePlanPeople(ME, NO_TEAM, items), {
      initialProps: { items: first },
    });
    expect(result.current).toEqual([CASEY, ME]);
    const before = result.current;
    // A title typed on the card: a new map, the same people, the same array.
    rerender({ items: new Map([['a', card('a', { title: 'A2', assignee: CASEY })]]) });
    expect(result.current).toBe(before);
    // No card holds Casey any more: gone from the picker.
    rerender({ items: new Map([['a', card('a', { title: 'A2' })]]) });
    expect(result.current).toEqual([ME]);
  });
});
