import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { layerLockOf, lockedIds } from './locks';

const layered = (): Tab => {
  const tab = checkoutFlow();
  return {
    ...tab,
    layers: [
      { id: 'base', name: 'Base', locked: true },
      { id: 'top', name: 'Top' },
    ],
    elements: tab.elements.map((el) =>
      el.id === 'n1' ? { ...el, layerId: 'top', locked: true } : { ...el, layerId: 'top' },
    ),
  };
};

describe('lockedIds', () => {
  it('names locked elements and elements on locked layers, the element lock first', () => {
    const tab = layered();
    tab.elements[2] = { ...tab.elements[2]!, layerId: 'base', locked: true };
    tab.elements[3] = { ...tab.elements[3]!, layerId: 'base' };
    expect([...lockedIds(tab)]).toEqual([
      ['n1', { scope: 'element' }],
      ['n2', { scope: 'element' }],
      ['n3', { scope: 'layer', layer: 'Base' }],
    ]);
  });

  it('finds nothing locked on an ordinary tab', () => {
    expect(lockedIds(checkoutFlow()).size).toBe(0);
  });
});

describe('layerLockOf', () => {
  it('reads an unknown or absent layer as the default one', () => {
    const { layers } = layered();
    expect(layerLockOf(layers, 'gone')).toEqual({ scope: 'layer', layer: 'Base' });
    expect(layerLockOf(layers, 'top')).toBeNull();
    expect(layerLockOf(undefined, undefined)).toBeNull();
  });
});
