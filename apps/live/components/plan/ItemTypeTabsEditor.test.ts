import { describe, expect, it } from 'vitest';
import { fileField, moveTab } from './ItemTypeTabsEditor';

const tabs = [
  { id: 't-a', label: 'A', fields: ['description'] },
  { id: 't-b', label: 'B', fields: ['checklist'] },
];

describe('tab edits', () => {
  it('moves a tab and stops at the ends', () => {
    expect(moveTab(tabs, 0, 1).map((t) => t.id)).toEqual(['t-b', 't-a']);
    expect(moveTab(tabs, 0, -1).map((t) => t.id)).toEqual(['t-a', 't-b']);
  });

  it('files a field under one tab, or Details', () => {
    expect(fileField(tabs, 'description', 't-b').map((t) => t.fields)).toEqual([
      [],
      ['checklist', 'description'],
    ]);
    expect(fileField(tabs, 'checklist', null).map((t) => t.fields)).toEqual([['description'], []]);
  });
});
