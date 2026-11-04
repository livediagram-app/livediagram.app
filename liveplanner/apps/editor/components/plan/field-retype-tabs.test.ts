import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type FieldRetypeTarget, type ItemTypeDef } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { countFieldFilters, planSurfaces, tabsWithoutFieldFilters } from './field-retype-tabs';

// docs/specs/026-plan/item-types.md "Edit Field": Filters on the field, and what stops reading a built-in.
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'f-size'],
  custom: [{ id: 'f-size', label: 'Size', kind: 'text' }],
};
const target: FieldRetypeTarget = { field: 'f-size', builtIn: false, typesAfter: [TASK] };

const board = (id: string, savedFilters?: unknown[]) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  planBoard: {
    title: '',
    columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    ...(savedFilters ? { savedFilters } : {}),
  },
});
const SMALL = { id: 's', name: 'Small', filters: [{ by: 'field', field: 'f-size', key: 'S' }] };

const TABS = [
  {
    id: 'tab-1',
    name: 'Sprint',
    elements: [
      board('b1', [SMALL]),
      { id: 'n1', type: 'sticky' },
      { id: 'e1', type: 'shape', shape: 'rectangle' },
    ],
  },
  {
    id: 'tab-2',
    name: 'Search',
    elements: [
      {
        id: 'v1',
        type: 'shape',
        shape: 'plan-view',
        planView: { view: 'search', filters: [{ by: 'field', field: 'f-size', key: 'S' }] },
      },
      {
        id: 'v2',
        type: 'shape',
        shape: 'plan-view',
        planView: { view: 'search', filters: [{ by: 'type', key: 'task' }] },
      },
      board('b2'),
    ],
  },
  {
    id: 'tab-3',
    name: 'Intake',
    elements: [],
    form: {
      heading: '',
      destination: { typeId: 'task' },
      sections: [
        {
          id: 's1',
          questions: [
            { id: 'q1', type: 'short', prompt: 'Size?', goesTo: { to: 'field', fieldId: 'f-size' } },
            { id: 'q2', type: 'short', prompt: 'Why?' },
          ],
        },
      ],
    },
  },
] as unknown as Tab[];

describe('the plan’s tabs read for a type change', () => {
  it('lists the boards, views and forms, named by their tab when they have no title', () => {
    const s = planSurfaces(TABS);
    expect(s.boards.map((b) => b.title)).toEqual(['Sprint', 'Search']);
    expect(s.views.map((v) => v.view)).toEqual(['search', 'search']);
    expect(s.forms).toEqual([{ title: 'Intake', typeId: 'task', fieldIds: ['f-size'] }]);
  });

  it('counts the filters on the field and takes them off, touching only the tabs that held one', () => {
    expect(countFieldFilters(TABS, [target])).toBe(2);
    expect(countFieldFilters(TABS, [])).toBe(0);
    const next = tabsWithoutFieldFilters(TABS as Tab[], [target]);
    expect(next[2]).toBe(TABS[2]);
    expect(countFieldFilters(next, [target])).toBe(0);
    const [b1, sticky] = next[0]!.elements as unknown as [{ planBoard: object }, unknown];
    expect(b1.planBoard).not.toHaveProperty('savedFilters');
    expect(sticky).toBe(TABS[0]!.elements[1]);
    // The view without one keeps its object.
    expect(next[1]!.elements[1]).toBe(TABS[1]!.elements[1]);
  });

  it('hands the same tabs back when nothing comes off', () => {
    const tabs = [TABS[2]!] as Tab[];
    expect(tabsWithoutFieldFilters(tabs, [target])).toBe(tabs);
    expect(tabsWithoutFieldFilters(tabs, [])).toBe(tabs);
  });
});
