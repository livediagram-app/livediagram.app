import { describe, expect, it } from 'vitest';
import { createSticky, type Tab } from '@livehuddle/document';
import { selectAllIds } from './select-all-ids';

describe('selectAllIds', () => {
  const at = (id: string, x: number) => ({ ...createSticky(x, 0), id });
  const tab = {
    elements: [at('a', -50), at('b', 950), at('c', 960)],
  } as unknown as Pick<Tab, 'elements'>;

  it('selects every element on the tab', () => {
    expect([...selectAllIds(tab)].sort()).toEqual(['a', 'b', 'c']);
  });
});
