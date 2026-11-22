import { describe, expect, it } from 'vitest';
import { arrangeTree } from './tree';

const item = (id: string, parentId: string | null = null) => ({ id, parentId });
const shape = (items: { id: string; parentId: string | null }[], maxDepth = 8) =>
  arrangeTree(items, maxDepth).map((p) => [p.item.id, p.parent?.id ?? null, p.flattened]);

describe('arrangeTree', () => {
  it('orders pages depth first, siblings as listed', () => {
    expect(
      shape([item('b'), item('a'), item('a2', 'a'), item('b1', 'b'), item('a1', 'a')]),
    ).toEqual([
      ['b', null, false],
      ['b1', 'b', false],
      ['a', null, false],
      ['a2', 'a', false],
      ['a1', 'a', false],
    ]);
  });

  it('surfaces a page whose parent is missing at the top level', () => {
    expect(shape([item('a', 'gone')])).toEqual([['a', null, false]]);
  });

  it('surfaces pages whose parents only lead to each other', () => {
    expect(shape([item('a', 'b'), item('b', 'a'), item('c')])).toEqual([
      ['c', null, false],
      ['a', null, false],
      ['b', 'a', false],
    ]);
  });

  it('flattens pages deeper than the limit under the last level', () => {
    expect(
      shape(
        [
          item('1'),
          item('2', '1'),
          item('3', '2'),
          item('4', '3'),
          item('5', '4'),
          item('3b', '2'),
        ],
        3,
      ),
    ).toEqual([
      ['1', null, false],
      ['2', '1', false],
      ['3', '2', false],
      ['4', '2', true],
      ['5', '2', true],
      ['3b', '2', false],
    ]);
  });

  it('answers nothing for no pages', () => {
    expect(shape([])).toEqual([]);
  });
});
