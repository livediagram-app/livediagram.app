import { describe, expect, it } from 'vitest';
import { checkoutFlow } from './checkout-flow';
import { boxIn } from './run';

describe('boxIn', () => {
  it('reads a box, and NaN for an element the tab no longer holds', () => {
    const tab = checkoutFlow();
    const [x, y, width, height] = boxIn(tab, tab.elements[0]!.id);
    expect([x, y, width, height].every(Number.isFinite)).toBe(true);
    expect(boxIn(tab, 'gone')).toEqual([NaN, NaN, NaN, NaN]);
  });
});
