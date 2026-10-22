import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@liveplanner/document';
import { selectAllIds } from './select-all-ids';

// docs/specs/007-editor/pages-mode.md "Selecting on a page".
describe('selectAllIds', () => {
  const at = (id: string, x: number) => ({ ...createShape('square', x, 0), id });
  // Two A4 pages: the first centred on the origin, the second a page and a gap to its right.
  const tab = {
    elements: [at('a', -50), at('b', 950), at('c', 960)],
    pages: [
      { id: 'p1', orientation: 'portrait' },
      { id: 'p2', orientation: 'portrait' },
    ],
  } as unknown as Pick<Tab, 'elements' | 'pages'>;

  it('selects the page someone is on alone, on a tab with pages', () => {
    expect([...selectAllIds(tab, new Set(), 'p2')].sort()).toEqual(['b', 'c']);
    expect([...selectAllIds(tab, new Set(['c']), 'p2')]).toEqual(['b']);
  });

  it('selects the whole tab on a tab without pages, or with no page known', () => {
    expect(selectAllIds({ elements: tab.elements }, new Set(), 'p2').size).toBe(3);
    expect(selectAllIds(tab, new Set(), null).size).toBe(3);
    expect(selectAllIds(tab, new Set(), 'gone').size).toBe(3);
  });
});
