import { describe, expect, it } from 'vitest';
import {
  isCardSearchFilters,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
} from './card-search';
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
});
