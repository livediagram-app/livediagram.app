import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:cards', name: 'Cards' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
  });

  it('keeps what the import does not specify', () => {
    const mine = tab({
      theme: 'midnight',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('midnight');
    expect(out.layers).toEqual([{ id: 'a', name: 'A' }]);
  });
});
