import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { ITEM_TYPE_CATALOGUE_VERSION } from './type-catalogue';
import { planTabItemsImport } from './tab-import';

// What importing a tab's JSON export adds (docs/specs/026-plan/items.md "Copies and exports").

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (
  id: string,
  key: number,
  rank: string,
  fields: Item['fields'],
  type = 'task',
): Item => ({
  id,
  type,
  key,
  rank,
  fields,
  rev: 3,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});

const bug: ItemTypeDef = { ...ITEM_TYPES[1]!, id: 'bug', label: 'Bug' };
const spike: ItemTypeDef = { ...ITEM_TYPES[1]!, id: 'spike', label: 'Spike' };
const catalogue = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [...ITEM_TYPES, bug, spike] };

describe('planTabItemsImport', () => {
  const incoming = [
    item('a', 5, 'i2', { title: 'Second', status: 'todo' }),
    item('b', 9, 'i1', { title: 'First', status: 'todo' }, 'bug'),
    item('c', 2, 'i0', { title: 'Done one', status: 'done' }),
  ];

  it('creates every item, in status then rank order, without its key', () => {
    const plan = planTabItemsImport(incoming, null, new Map(), ITEM_TYPES);
    expect(plan.creates.map((c) => c.id)).toEqual(['c', 'b', 'a']);
    expect(plan.creates.every((c) => c.key === undefined)).toBe(true);
    expect(plan.creates[1]).toMatchObject({ type: 'bug', fields: { title: 'First' } });
    expect(plan.skipped).toBe(0);
  });

  it('leaves alone an item the document already holds', () => {
    const existing = new Map([['a', incoming[0]!]]);
    const plan = planTabItemsImport(incoming, null, existing, ITEM_TYPES);
    expect(plan.creates.map((c) => c.id)).toEqual(['c', 'b']);
    expect(plan.skipped).toBe(1);
  });

  it("adds only the file's types a new item uses and the document lacks", () => {
    expect(planTabItemsImport(incoming, catalogue, new Map(), ITEM_TYPES).types).toEqual([bug]);
    expect(planTabItemsImport(incoming, catalogue, new Map(), [...ITEM_TYPES, bug]).types).toEqual(
      [],
    );
    // The bug card is already here, so its type is not needed.
    const existing = new Map([['b', incoming[1]!]]);
    expect(planTabItemsImport(incoming, catalogue, existing, ITEM_TYPES).types).toEqual([]);
  });

  it('adds no types without a catalogue in the file', () => {
    expect(planTabItemsImport(incoming, null, new Map(), ITEM_TYPES).types).toEqual([]);
  });
});
