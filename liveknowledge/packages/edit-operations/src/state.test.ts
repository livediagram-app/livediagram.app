import { describe, expect, it } from 'vitest';
import { checkoutFlow } from './fixtures/checkout-flow';
import { boxedOf, createState } from './state';

describe('boxedOf', () => {
  it('finds a box, and nothing for an arrow or a missing id', () => {
    const state = createState(checkoutFlow(), {}, () => {});
    expect(boxedOf(state, 'n3')).toMatchObject({ id: 'n3' });
    expect(boxedOf(state, 'a1')).toBeUndefined();
    expect(boxedOf(state, 'gone')).toBeUndefined();
  });
});
