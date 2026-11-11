import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/design';
import { readTabSaveChanges, tabSaveChangesHeader } from './tab-save-header';

const tab = (...ids: string[]): Tab => ({
  id: 't1',
  name: 'Logos',
  elements: [],
  pages: ids.map((id) => ({ id, orientation: 'landscape' })),
});

describe('the X-Save-Changes header', () => {
  it('is null for a tab the baseline lacks, and round-trips the page steps of one it has', () => {
    expect(tabSaveChangesHeader(undefined, tab('p1'))).toBeNull();
    const header = tabSaveChangesHeader(tab('p1'), tab('p1', 'p2'))!;
    expect(readTabSaveChanges(header)).toEqual({
      pages: [{ kind: 'put', id: 'p2', after: 'p1', before: null }],
    });
  });

  it('sends none when the steps would not fit, and reads an absent or unreadable header as none', () => {
    const many = Array.from({ length: 400 }, (_, i) => `page-${'p'.repeat(20)}-${i}`);
    expect(tabSaveChangesHeader(tab('p1'), tab(...many))).toBeNull();
    expect(readTabSaveChanges(null)).toBeNull();
    expect(readTabSaveChanges('%7B%7D')).toBeNull();
  });
});
