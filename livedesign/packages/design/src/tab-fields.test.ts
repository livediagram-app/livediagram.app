import { describe, expect, it } from 'vitest';
import { migrateIncomingTab } from './stored-tab';
import { layerBands, visibleLayerElements } from './layers';
import type { Element, Tab } from './index';

// A tab's raw-read fields settled on the way in (docs/specs/006-design/layers.md "Data model").
// The settling itself is @liveworkspace/model-core's (tab-fields.test.ts there); this is it on this model's way in.
describe('settleTabFields', () => {
  const base = { id: 't', name: 'T', elements: [] as Element[] };

  it('a malformed tab arriving from outside renders after the migration', () => {
    const el = { id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x' };
    for (const layers of ['x', 0.5, [1, 'a', null], [{ id: 'a' }, null]]) {
      const tab = migrateIncomingTab({ ...base, elements: [el], layers }) as Tab;
      expect(() => visibleLayerElements(tab.elements, tab.layers)).not.toThrow();
      expect(() => layerBands(tab.elements, tab.layers)).not.toThrow();
    }
  });
});
