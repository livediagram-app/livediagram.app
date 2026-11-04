import { describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { typeSaveAlong } from './type-save-along';

// docs/specs/026-plan/item-types.md "Edit Field": what a type's save writes with it.
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'f-owner'],
  custom: [{ id: 'f-owner', label: 'Owner', kind: 'person', multiple: true }],
};
const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const LEE = { id: 'p-lee', name: 'Lee', color: '#16a34a' };
const card: Item = {
  id: 'c1',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'A', status: 'todo', 'f-owner': [SAM, LEE] },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
};
const ctx = (extra = {}) => ({
  types: [TASK],
  items: new Map([[card.id, card]]),
  people: [SAM, LEE],
  ...extra,
});

describe('what a type’s save writes with it', () => {
  it('is nothing when no field changes type or values', () => {
    expect(typeSaveAlong(TASK, { ...TASK, label: 'Job' }, {}, ctx())).toBeUndefined();
  });

  it('writes values with no filters to take off when the kind stays (Several People to one Person)', () => {
    const reshapeValues = vi.fn(() => Promise.resolve({ ok: true, step: null }));
    const removeFieldFilters = vi.fn(() => true);
    const after = { ...TASK, custom: [{ id: 'f-owner', label: 'Owner', kind: 'person' as const }] };
    const along = typeSaveAlong(TASK, after, {}, ctx({ reshapeValues, removeFieldFilters }))!;
    expect(along.name).toBe('Owner');
    expect(along.values).toBeInstanceOf(Promise);
    expect(along.settle).toBeUndefined();
  });

  it('names the field generically when nothing names it, and writes nothing without the slice', () => {
    const after = { ...TASK, custom: [{ id: 'f-owner', label: 'Owner', kind: 'text' as const }] };
    const along = typeSaveAlong(TASK, after, {}, ctx())!;
    expect(along).toEqual({ name: 'Owner' });
    const odd = typeSaveAlong(TASK, after, { 'f-gone': 'priority' }, ctx())!;
    expect(odd.name).toBe('the field');
  });
});
