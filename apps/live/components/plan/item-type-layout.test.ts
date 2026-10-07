import { describe, expect, it } from 'vitest';
import { OVERVIEW_TAB_ID } from '@livediagram/items';
import {
  addField,
  addTab,
  cardFields,
  detailFields,
  fileField,
  moveField,
  moveTab,
  removeField,
  withoutEmptyTabs,
  type LayoutDraft,
} from './item-type-layout';

const tabs = [
  { id: 't-a', label: 'A', fields: ['description'] },
  { id: 't-b', label: 'B', fields: ['checklist'] },
];

const draft: LayoutDraft = {
  fields: ['title', 'status', 'assignee', 'description', 'priority', 'votes', 'due', 'checklist'],
  custom: [{ id: 'c-size', label: 'Size', kind: 'text' }],
  tabs: [
    { id: OVERVIEW_TAB_ID, label: 'Overview', fields: ['description', 'due'] },
    { id: 't-x', label: 'X', fields: ['checklist'] },
  ],
};

describe('groups', () => {
  it('puts Title and Votes on the card, and every untabbed field in Details', () => {
    expect(cardFields(draft)).toEqual(['title', 'votes']);
    expect(detailFields(draft)).toEqual(['status', 'assignee', 'priority']);
  });
});

describe('field edits', () => {
  it('moves a Details field past its neighbour, never past Status, and stops at the ends', () => {
    expect(detailFields(moveField(draft, null, 'priority', -1))).toEqual([
      'status',
      'priority',
      'assignee',
    ]);
    expect(moveField(draft, null, 'assignee', -1)).toBe(draft);
    expect(moveField(draft, null, 'priority', 1)).toBe(draft);
  });

  it('moves a field within its tab', () => {
    expect(moveField(draft, OVERVIEW_TAB_ID, 'due', -1).tabs[0]!.fields).toEqual([
      'due',
      'description',
    ]);
  });

  it('adds a field into the group it was added in, but never Votes into a tab', () => {
    const added = addField(draft, 'estimate', 't-x');
    expect(added.fields.at(-1)).toBe('estimate');
    expect(added.tabs[1]!.fields).toEqual(['checklist', 'estimate']);
    expect(addField(draft, 'votes', 't-x').tabs).toEqual(draft.tabs);
    expect(detailFields(addField(draft, 'labels', null))).toContain('labels');
  });

  it('adds a custom field with its definition', () => {
    const c = { id: 'c-cost', label: 'Cost', kind: 'number' as const };
    expect(addField(draft, 'c-cost', null, c).custom).toContainEqual(c);
  });

  it('removes a field from the type, its custom fields and its tab', () => {
    const gone = removeField(removeField(draft, 'c-size'), 'checklist');
    expect(gone.fields).not.toContain('checklist');
    expect(gone.custom).toEqual([]);
    expect(gone.tabs[1]!.fields).toEqual([]);
  });
});

describe('tab edits', () => {
  it('moves a tab and stops at the ends', () => {
    expect(moveTab(tabs, 0, 1).map((t) => t.id)).toEqual(['t-b', 't-a']);
    expect(moveTab(tabs, 0, -1).map((t) => t.id)).toEqual(['t-a', 't-b']);
  });

  it('adds an unnamed, empty tab with a fresh id', () => {
    const next = addTab(addTab(tabs));
    expect(next.slice(2)).toEqual([
      { id: 't-tab', label: '', fields: [] },
      { id: 't-tab-2', label: '', fields: [] },
    ]);
  });

  it('files a field under one tab, or Details', () => {
    expect(fileField(tabs, 'description', 't-b').map((t) => t.fields)).toEqual([
      [],
      ['checklist', 'description'],
    ]);
    expect(fileField(tabs, 'checklist', null).map((t) => t.fields)).toEqual([['description'], []]);
  });

  it('drops tabs with no fields', () => {
    expect(withoutEmptyTabs(fileField(tabs, 'description', null)).map((t) => t.id)).toEqual([
      't-b',
    ]);
  });
});

describe('kept tabs', () => {
  it('keeps an empty Overview when saving, and drops any other empty tab', () => {
    const kept = withoutEmptyTabs([
      { id: OVERVIEW_TAB_ID, label: 'Summary', fields: [] },
      { id: 't-x', label: 'X', fields: [] },
    ]);
    expect(kept.map((t) => t.id)).toEqual([OVERVIEW_TAB_ID]);
  });
});
