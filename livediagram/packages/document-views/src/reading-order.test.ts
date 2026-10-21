import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
import { readingOrder, rowsOf } from './reading-order';

const placed = (els: Element[]) => els.map((el, index) => ({ el, index }));
const ids = (items: { el: Element }[]) => items.map((p) => p.el.id);

describe('readingOrder (R13)', () => {
  it('reads rows top to bottom, then left to right', () => {
    const items = placed([
      shapeAt('square', 'right', 300, 10, 100, 50),
      shapeAt('square', 'below', 0, 100, 100, 50),
      shapeAt('square', 'left', 0, 0, 100, 50),
      shapeAt('square', 'mid', 150, 40, 100, 50),
    ]);
    expect(ids(readingOrder(items))).toEqual(['left', 'mid', 'right', 'below']);
  });

  it("opens a new row at the bottom edge of the row's first element", () => {
    const items = placed([
      shapeAt('square', 'a', 0, 0, 100, 50),
      shapeAt('square', 'b', 10, 50, 100, 50),
    ]);
    expect(rowsOf(items).rows.map(ids)).toEqual([['a'], ['b']]);
  });

  it('breaks ties by array index', () => {
    const items = placed([shapeAt('square', 'second', 0, 0), shapeAt('square', 'first', 0, 0)]);
    expect(ids(readingOrder(items))).toEqual(['second', 'first']);
  });

  it('orders a row by x, then y, then index', () => {
    const items = placed([
      shapeAt('square', 'low', 0, 20, 100, 100),
      shapeAt('square', 'high', 0, 0, 100, 100),
      shapeAt('square', 'twin', 0, 0, 100, 100),
    ]);
    expect(ids(rowsOf(items).rows[0]!)).toEqual(['high', 'twin', 'low']);
  });

  it('puts elements without geometry last, in array order (E13)', () => {
    const odd = { id: 'odd', type: 'hologram' } as unknown as Element;
    const odder = { id: 'odder', type: 'hologram' } as unknown as Element;
    const items = placed([odder, shapeAt('square', 'a', 0, 0), odd]);
    items.reverse();
    expect(ids(readingOrder(items))).toEqual(['a', 'odder', 'odd']);
  });
});
