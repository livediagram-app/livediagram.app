import { describe, expect, it } from 'vitest';
import { dropRetiredLayers } from './retired-layers';
import { migrateStoredTab } from './stored-tab';

const square = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

describe('dropRetiredLayers', () => {
  it('hands back the same tab when it carries no layers', () => {
    const tab = { id: 't', name: 'T', elements: [square('a')] };
    expect(dropRetiredLayers(tab)).toBe(tab);
  });

  it('drops the layers and every layer id', () => {
    const tab = {
      id: 't',
      name: 'T',
      layers: [{ id: 'l1', name: 'Hidden', visible: false, locked: true, opacity: 0.2 }],
      elements: [square('a', { layerId: 'l1' }), square('b')],
    };
    const out = dropRetiredLayers(tab) as Record<string, unknown>;
    expect('layers' in out).toBe(false);
    expect(out.elements).toEqual([square('a'), square('b')]);
    // The element without a layer id is the same object.
    expect((out.elements as unknown[])[1]).toBe(tab.elements[1]);
  });

  it('runs in the stored-tab migration', () => {
    const tab = {
      id: 't',
      name: 'T',
      layers: [{ id: 'l1', name: 'Layer 1' }],
      elements: [square('a', { layerId: 'l1' })],
    };
    const out = migrateStoredTab(tab as never) as unknown as Record<string, unknown>;
    expect('layers' in out).toBe(false);
    expect((out.elements as Record<string, unknown>[])[0]).not.toHaveProperty('layerId');
  });
});
