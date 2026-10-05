import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import {
  ITEM_TYPE_TABS_MAX,
  OVERVIEW_TAB_ID,
  detailFieldsOf,
  newTabId,
  tabsOf,
  validateItemTypeCatalogue,
} from './type-catalogue';

// docs/specs/025-plan/item-types.md "An item type": tabs.
const task = ITEM_TYPES.find((t) => t.id === 'task')!;

describe('item type tabs', () => {
  it('gives a type without tabs one Overview tab of its long-form fields', () => {
    const withLong: ItemTypeDef = {
      ...task,
      fields: [...task.fields, 'f-notes'],
      custom: [{ id: 'f-notes', label: 'Notes', kind: 'longtext' }],
    };
    expect(tabsOf(withLong)).toEqual([
      { id: OVERVIEW_TAB_ID, label: 'Overview', fields: ['description', 'checklist', 'f-notes'] },
    ]);
    expect(detailFieldsOf(withLong)).toEqual([
      'status',
      'assignee',
      'priority',
      'estimate',
      'due',
      'labels',
      'parent',
    ]);
  });

  it('shows a type’s own tabs, minus fields it no longer offers', () => {
    const t: ItemTypeDef = {
      ...task,
      tabs: [
        { id: 't-plan', label: 'Plan', fields: ['description', 'due', 'gone'] },
        { id: 't-work', label: 'Work', fields: ['checklist'] },
      ],
    };
    expect(tabsOf(t).map((x) => x.fields)).toEqual([['description', 'due'], ['checklist']]);
    expect(detailFieldsOf(t)).not.toContain('due');
    expect(detailFieldsOf(t)).toContain('status');
  });

  it('makes tab ids from names', () => {
    expect(newTabId('Acceptance criteria', [])).toBe('t-acceptance-criteria');
    expect(newTabId('Plan', ['t-plan'])).toBe('t-plan-2');
    expect(newTabId('!!', [])).toBe('t-tab');
  });

  const catalogue = (tabs: unknown) => ({ version: 1, types: [{ ...task, tabs }] });

  it('keeps valid tabs through the catalogue check, each field in one tab', () => {
    const r = validateItemTypeCatalogue(
      catalogue([
        { id: 't-a', label: 'A', fields: ['description', 'title', 'votes', 'nope'] },
        { id: 't-b', label: 'B', fields: ['description', 'checklist'] },
      ]),
    );
    expect(r.ok && r.catalogue.types[0]!.tabs).toEqual([
      { id: 't-a', label: 'A', fields: ['description'] },
      { id: 't-b', label: 'B', fields: ['checklist'] },
    ]);
  });

  it('refuses bad tabs', () => {
    const bad = [
      'x',
      Array.from({ length: ITEM_TYPE_TABS_MAX + 1 }, (_, i) => ({
        id: `t-${i}`,
        label: `T${i}`,
        fields: [],
      })),
      [{ id: 'nope', label: 'A', fields: [] }],
      [{ id: 't-a', label: '', fields: [] }],
      [
        { id: 't-a', label: 'Same', fields: [] },
        { id: 't-b', label: 'same', fields: [] },
      ],
      [
        { id: 't-a', label: 'A', fields: [] },
        { id: 't-a', label: 'B', fields: [] },
      ],
      [{ id: 't-a', label: 'A', fields: 'description' }],
      [7],
    ];
    for (const tabs of bad) expect(validateItemTypeCatalogue(catalogue(tabs)).ok).toBe(false);
  });
});
