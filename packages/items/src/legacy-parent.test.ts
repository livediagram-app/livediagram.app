import { describe, expect, it } from 'vitest';
import { isCardSearchFilter, searchCards } from './card-search';
import { NO_LANE, normaliseBoardSetup, projectBoard } from './board';
import { ITEM_TYPES, PARENT_FIELD, PARENT_FIELD_ID } from './item-types';
import { readCardSearchFilter, readGrouping, readPlanViewSettings } from './legacy-parent';
import { isPlanViewSettings } from './plan-views';
import { PRESET_CARD_TYPES } from './preset-types';
import { ITEM_TYPE_CUSTOM_MAX, customFieldCount, readItemTypeCatalogue } from './type-catalogue';
import { item } from './test-items';

describe('Parent as a Card field', () => {
  it('is on Task and the preset Bug and Story, linking to Projects under its old key', () => {
    for (const t of [ITEM_TYPES[1], ...PRESET_CARD_TYPES]) {
      expect(t.fields).toContain(PARENT_FIELD_ID);
      expect(t.custom).toContainEqual(PARENT_FIELD);
    }
    expect(PARENT_FIELD).toMatchObject({ id: 'parent', kind: 'card', linkType: 'project' });
  });

  it('reads a type stored while Parent was built in as having the Card field', () => {
    const stored = { ...ITEM_TYPES[1], custom: undefined };
    const read = readItemTypeCatalogue({ version: 1, types: [stored] });
    expect(read?.types[0]?.custom).toEqual([PARENT_FIELD]);
    expect(read?.types[0]?.fields).toContain('parent');
  });

  it('keeps a renamed or relinked Parent as stored', () => {
    const own = { ...PARENT_FIELD, label: 'Epic', linkType: 'story' };
    const read = readItemTypeCatalogue({
      version: 1,
      types: [{ ...ITEM_TYPES[1], custom: [own] }],
    });
    expect(read?.types[0]?.custom).toEqual([own]);
  });

  it('never counts against the custom field cap, so a full type still reads with it', () => {
    const custom = Array.from({ length: ITEM_TYPE_CUSTOM_MAX }, (_, i) => ({
      id: `f-x${i}`,
      label: `X${i}`,
      kind: 'text',
    }));
    expect(customFieldCount([...custom, PARENT_FIELD])).toBe(ITEM_TYPE_CUSTOM_MAX);
    const full = {
      ...ITEM_TYPES[1],
      fields: ['title', 'status', 'parent', ...custom.map((c) => c.id)],
      custom,
    };
    const once = readItemTypeCatalogue({ version: 1, types: [full] });
    expect(once?.types[0]?.custom).toHaveLength(ITEM_TYPE_CUSTOM_MAX + 1);
    // What it read saves and reads again.
    expect(readItemTypeCatalogue(once)?.types[0]?.custom).toHaveLength(ITEM_TYPE_CUSTOM_MAX + 1);
  });
});

describe('the old Parent grouping', () => {
  it('reads a board grouped by Parent as grouped by the Parent field', () => {
    const setup = normaliseBoardSetup({
      title: 'Board',
      columns: [{ id: 'todo', status: 'todo' }],
      swimlaneBy: 'parent',
      swimlaneField: 'ignored',
    });
    expect(setup).toMatchObject({ swimlaneBy: 'field', swimlaneField: 'parent' });
  });

  it('draws a Parent row with the project’s colour dot', () => {
    const red = item({ title: 'Red', color: '#dc2626' }, { type: 'project' });
    const kid = item({ title: 'a', status: 'todo', parent: red.id });
    const setup = normaliseBoardSetup({
      title: 'Board',
      columns: [{ id: 'todo', status: 'todo' }],
      swimlaneBy: 'parent',
    })!;
    const lanes = projectBoard(setup, new Map([red, kid].map((i) => [i.id, i]))).lanes;
    expect(lanes.map((l) => [l.label, l.colour])).toEqual([
      ['Red', '#dc2626'],
      ['No Parent', undefined],
    ]);
  });

  it('reads a view’s grouping and filters as the Parent field’s', () => {
    expect(readGrouping({ view: 'gantt', swimlaneBy: 'assignee' })).toEqual({
      view: 'gantt',
      swimlaneBy: 'assignee',
    });
    expect(readGrouping({ view: 'gantt', swimlaneBy: 'parent' })).toEqual({
      view: 'gantt',
      swimlaneBy: 'field',
      swimlaneField: 'parent',
    });
    expect(isPlanViewSettings({ view: 'gantt', swimlaneBy: 'parent' })).toBe(true);
    const read = readPlanViewSettings({
      view: 'search',
      filters: [
        { by: 'parent', key: 'e:p1' },
        { by: 'assignee', key: 'a' },
      ] as never,
    });
    expect(read.filters).toEqual([
      { by: 'field', field: 'parent', key: 'f:"p1"' },
      { by: 'assignee', key: 'a' },
    ]);
    expect(readPlanViewSettings({ view: 'gantt', swimlaneBy: 'none' })).toEqual({
      view: 'gantt',
      swimlaneBy: 'none',
    });
  });

  it('keeps an old Parent filter valid, and finds the same cards through the field', () => {
    const launch = item({ title: 'Launch' }, { type: 'project' });
    const kid = item({ title: 'Write', parent: launch.id });
    const loose = item({ title: 'Loose' });
    expect(isCardSearchFilter({ by: 'parent', key: `e:${launch.id}` })).toBe(true);
    const under = readCardSearchFilter({ by: 'parent' as never, key: `e:${launch.id}` });
    expect(searchCards([launch, kid, loose], [under]).map((c) => c.id)).toEqual([kid.id]);
    const none = readCardSearchFilter({ by: 'parent' as never, key: NO_LANE });
    expect(none).toEqual({ by: 'field', field: 'parent', key: NO_LANE });
    expect(searchCards([kid, loose], [none]).map((c) => c.id)).toEqual([loose.id]);
  });
});
