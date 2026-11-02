import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  fieldValueFilter,
  isCardSearchFilters,
  searchCards,
  searchFields,
  searchFilterLabel,
  searchValues,
  toggleFieldFilter,
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

  it('offers Card Type even when every card is of one type, in the board order, and not without cards', () => {
    const projects = searchCards(cards, [{ by: 'type', key: 't:project' }]);
    const labels = searchFields(projects, []).map((f) => f.label);
    expect(labels).toContain('Card Type');
    expect(labels.indexOf('Card Type')).toBeLessThan(labels.indexOf('State'));
    expect(searchFields([], []).map((f) => f.label)).not.toContain('Card Type');
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
    const withSize = [item({ title: 'X', 'c-size': 'M' })];
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

// docs/specs/026-plan/board-widgets.md "Pressing a value".
describe('field value filters', () => {
  const custom = [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['High', 'Low'] },
    { id: 'f-team', label: 'Team', kind: 'labels' },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['a', 'b', 'c'] },
    { id: 'f-own', label: 'Owner', kind: 'person' },
  ];
  const types = [
    {
      id: 'feature',
      label: 'Feature',
      newTitle: 'New',
      glyph: 'task',
      color: '#2563eb',
      fields: ['title', 'status', ...custom.map((c) => c.id)],
      custom,
    },
  ] as never;
  const make = (fields: Record<string, unknown>) => item(fields as never, { type: 'feature' });
  const cs = [
    make({
      title: 'A',
      'f-sev': 'High',
      'f-team': ['Web', 'Ops'],
      'f-tags': ['a', 'b'],
      'f-own': ALI,
    }),
    make({ title: 'B', 'f-sev': 'Low', 'f-team': ['Web'], 'f-tags': ['b'] }),
    make({ title: 'C', 'f-sev': 'High', 'f-team': ['Ops'] }),
  ];
  const titles = (f: ReturnType<typeof fieldValueFilter>) =>
    searchCards(cs, [f], types).map((c) => c.fields['title']);

  it('matches a Choice, a Person, and any value of Labels or Multiple Choice', () => {
    expect(titles(fieldValueFilter({ id: 'f-sev', kind: 'choice' }, 'High'))).toEqual(['A', 'C']);
    expect(titles(fieldValueFilter({ id: 'f-own', kind: 'person' }, ALI.id))).toEqual(['A']);
    expect(titles(fieldValueFilter({ id: 'f-team', kind: 'labels' }, 'Ops'))).toEqual(['A', 'C']);
    expect(titles(fieldValueFilter({ id: 'f-tags', kind: 'multichoice' }, 'b'))).toEqual([
      'A',
      'B',
    ]);
  });

  it('offers Multiple Choice to Add Filter and names its chip', () => {
    expect(searchFields(cs, [], types).map((f) => f.label)).toContain('Tags');
    const f = fieldValueFilter({ id: 'f-tags', kind: 'multichoice' }, 'b');
    expect(searchFilterLabel(f, cs, types)).toEqual({ field: 'Tags', value: 'b' });
  });

  it('toggles a value: off when on, replacing a one-value field, stacking a several-value one, capped', () => {
    const high = fieldValueFilter({ id: 'f-sev', kind: 'choice' }, 'High');
    const low = fieldValueFilter({ id: 'f-sev', kind: 'choice' }, 'Low');
    expect(toggleFieldFilter([], high)).toEqual([high]);
    expect(toggleFieldFilter([high], high)).toEqual([]);
    expect(toggleFieldFilter([high], low)).toEqual([low]);
    expect(toggleFieldFilter([high], low, true)).toEqual([high, low]);
    expect(toggleFieldFilter([high, low], high, true)).toEqual([low]);
    const full = Array.from({ length: 8 }, (_, i) => ({
      by: 'field' as const,
      field: `x${i}`,
      key: 'k',
    }));
    expect(toggleFieldFilter(full, high)).toEqual(full);
  });

  it('filters a 500-card board by any value within a CPU budget', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      make({ title: `C${i}`, 'f-team': ['Web', 'Ops', `T${i % 20}`], 'f-tags': ['a', 'b'] }),
    );
    const f = fieldValueFilter({ id: 'f-team', kind: 'labels' }, 'T3');
    let found = 0;
    const run = () => {
      found = searchCards(many, [f], types).length;
    };
    run();
    let best = Infinity;
    for (let pass = 0; pass < 5; pass++) best = Math.min(best, cpuMsOf(run));
    expect(found).toBe(25);
    // Measured at under 1 ms CPU on an M-series laptop; a scan per card per value would be many times this.
    expect(best).toBeLessThan(cpuBudgetMs(50));
  });
});
