import { describe, expect, it } from 'vitest';
import { checkoutFlow } from './fixtures/checkout-flow';
import { lockedIds } from './locks';

describe('lockedIds', () => {
  it('names the locked elements', () => {
    const tab = checkoutFlow();
    tab.elements[0] = { ...tab.elements[0]!, locked: true };
    expect([...lockedIds(tab)]).toEqual([[tab.elements[0].id, { scope: 'element' }]]);
  });

  it('finds nothing locked on an ordinary tab', () => {
    expect(lockedIds(checkoutFlow()).size).toBe(0);
  });
});
