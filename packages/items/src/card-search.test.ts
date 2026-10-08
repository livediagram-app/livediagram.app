import { describe, expect, it } from 'vitest';
import {
  isCardSearchFilters,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
} from './card-search';
import { ITEM_TYPES } from './item-types';
import { ALI, item } from './test-items';

// docs/specs/026-plan/plan-views.md "Card Search".
const project = (fields: Record<string, unknown>) => item(fields as never, { type: 'project' });
const cards = [
  project({ title: 'Launch', status: 'done' }),
  project({ title: 'Rebrand', status: 'doing', assignee: ALI }),
  item({ title: 'Write', status: 'done' }),
  item({ title: 'Test', status: 'doing', assignee: ALI }),
];

describe('card search', () => {
  it('lists the cards matching every filter', () => {
    const found = searchCards(cards, [
      { by: 'type', key: 't:project' },
      { by: 'status', key: 's:done' },
    ]);
    expect(found.map((c) => c.fields['title'])).toEqual(['Launch']);
    expect(searchCards(cards, [{ by: 'assignee', key: '' }]).map((c) => c.fields['title'])).toEqual(
      ['Launch', 'Write'],
    );
  });

  it('offers only the values some matching card has, with counts', () => {
    const values = searchValues(cards, { by: 'status' });
    expect(values.map((v) => [v.label, v.count])).toEqual(
      expect.arrayContaining([
        ['Done', 2],
        ['Doing', 2],
      ]),
    );
    const projects = searchCards(cards, [{ by: 'type', key: 't:project' }]);
    expect(searchValues(projects, { by: 'assignee' }).map((v) => v.label)).toEqual([
      'Ali',
      'No assignee',
    ]);
  });

  it('names a parent outside the matching cards, and picking it finds them', () => {
    const parent = project({ title: 'Launch' });
    const child = item({ title: 'Write', parent: parent.id });
    const all = [parent, child];
    const tasks = searchCards(all, [{ by: 'type', key: 't:task' }]);
    const values = searchValues(
      tasks,
      { by: 'field', field: 'parent' },
      ITEM_TYPES,
      undefined,
      all,
    );
    expect(values.map((v) => [v.label, v.count])).toEqual([['Launch', 1]]);
    const picked = [
      { by: 'type', key: 't:task' },
      { by: 'field', field: 'parent', key: values[0]!.key },
    ] as const;
    expect(searchCards(all, picked).map((c) => c.fields['title'])).toEqual(['Write']);
  });

  it('offers only the fields the types still in play have, less those filtered', () => {
    const all = searchFields(cards, []).map((f) => f.label);
    expect(all).toEqual(expect.arrayContaining(['Card Type', 'State', 'Assignee', 'Estimate']));
    const projects = searchCards(cards, [{ by: 'type', key: 't:project' }]);
    const left = searchFields(projects, [{ by: 'type', key: 't:project' }]).map((f) => f.label);
    expect(left).not.toContain('Card Type');
    // A Project has no Estimate.
    expect(left).not.toContain('Estimate');
  });

  it('names a filter by its field and value, and validates what is stored', () => {
    expect(searchFilterLabel({ by: 'status', key: 's:done' }, cards)).toEqual({
      field: 'State',
      value: 'Done',
    });
    expect(isCardSearchFilters([{ by: 'type', key: 't:task' }])).toBe(true);
    expect(isCardSearchFilters([{ by: 'none', key: '' }])).toBe(false);
    expect(isCardSearchFilters([{ by: 'field', key: 'x' }])).toBe(false);
    expect(isCardSearchFilters('nope')).toBe(false);
  });

  it('names a custom field filter by its field, and an unknown value by its key', () => {
    const task = ITEM_TYPES.find((t) => t.id === 'task')!;
    const sized = {
      ...task,
      fields: [...task.fields, 'c-size'],
      custom: [{ id: 'c-size', label: 'Size', kind: 'choice' as const, options: ['S', 'M'] }],
    };
    const withSize = [item({ title: 'X', 'c-size': 'M' } as never)];
    expect(
      searchFilterLabel({ by: 'field', field: 'c-size', key: 'gone' }, withSize, [sized]),
    ).toEqual({ field: 'Size', value: 'gone' });
    expect(searchFilterLabel({ by: 'field', field: 'nope', key: '' }, [], [sized])).toEqual({
      field: 'nope',
      value: 'Empty',
    });
  });

  it('refuses a stored filter with a malformed field or key', () => {
    expect(isCardSearchFilters([{ by: 'field', field: '', key: 'x' }])).toBe(false);
    expect(isCardSearchFilters([{ by: 'status', field: 7, key: 'x' }])).toBe(false);
    expect(isCardSearchFilters([{ by: 'status', key: 'x'.repeat(201) }])).toBe(false);
    expect(isCardSearchFilters([null])).toBe(false);
  });
});
