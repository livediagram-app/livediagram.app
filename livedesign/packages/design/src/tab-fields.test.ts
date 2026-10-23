import { describe, expect, it } from 'vitest';
import { settleTabFields } from './tab-fields';
import { migrateIncomingTab } from './stored-tab';
import { layerBands, visibleLayerElements } from './layers';
import type { Element, Tab } from './index';

// A tab's raw-read fields settled on the way in (docs/specs/006-design/layers.md "Data model").
describe('settleTabFields', () => {
  const base = { id: 't', name: 'T', elements: [] as Element[] };

  it('hands a well-formed tab back as it is', () => {
    const tab = {
      ...base,
      backgroundColor: '#fff',
      patternColor: '#000',
      layers: [
        { id: 'layer:default', name: 'Layer 1' },
        { id: 'b', name: 'Notes', visible: false, locked: true, opacity: 0.5 },
      ],
    };
    expect(settleTabFields(tab)).toBe(tab);
    expect(settleTabFields(base)).toBe(base);
  });

  it('drops background and pattern colours that are not strings', () => {
    const out = settleTabFields({ ...base, backgroundColor: true, patternColor: 3 });
    expect('backgroundColor' in out).toBe(false);
    expect('patternColor' in out).toBe(false);
  });

  it.each([['x'], [0.5], [{}], [null], [[]], [[null, 1, 'a']]])(
    'drops a layers value that keeps no layer (%j)',
    (layers) => {
      expect('layers' in settleTabFields({ ...base, layers })).toBe(false);
    },
  );

  it('keeps the readable layers, names the unnamed and drops repeats and wrong-typed flags', () => {
    const out = settleTabFields({
      ...base,
      layers: [
        null,
        { id: 'a', name: 7, visible: 'no', opacity: 3 },
        { id: 'a', name: 'Again' },
        { id: '', name: 'Empty' },
        { id: 'b', name: 'B', locked: true, opacity: Number.NaN, extra: 1 },
      ],
    }) as Tab;
    expect(out.layers).toEqual([
      { id: 'a', name: 'Layer 2', opacity: 1 },
      { id: 'b', name: 'B', locked: true },
    ]);
  });

  it('a malformed tab arriving from outside renders after the migration', () => {
    const el = { id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x' };
    for (const layers of ['x', 0.5, [1, 'a', null], [{ id: 'a' }, null]]) {
      const tab = migrateIncomingTab({ ...base, elements: [el], layers }) as Tab;
      expect(() => visibleLayerElements(tab.elements, tab.layers)).not.toThrow();
      expect(() => layerBands(tab.elements, tab.layers)).not.toThrow();
    }
  });
});
