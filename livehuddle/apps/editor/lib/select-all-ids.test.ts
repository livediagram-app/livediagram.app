import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@livehuddle/document';
import { selectAllIds } from './select-all-ids';

describe('selectAllIds', () => {
  const at = (id: string, x: number) => ({ ...createShape('square', x, 0), id });
  const tab = {
    elements: [at('a', -50), at('b', 950), at('c', 960)],
  } as unknown as Pick<Tab, 'elements'>;

  it('selects every element on the tab', () => {
    expect([...selectAllIds(tab, new Set())].sort()).toEqual(['a', 'b', 'c']);
  });

  it('leaves out the inert ones', () => {
    expect([...selectAllIds(tab, new Set(['c']))].sort()).toEqual(['a', 'b']);
  });
});
