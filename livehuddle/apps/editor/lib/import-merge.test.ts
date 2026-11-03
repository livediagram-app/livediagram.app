import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:notes', name: 'Notes' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
  });

  it('leaves an ordinary import where it was', () => {
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 130, width: 9, height: 9 };
    const out = mergeImportedTab(tab(), tab({ elements: [shape as Tab['elements'][number]] }));
    expect(out.elements[0]).toMatchObject({ y: 130 });
  });

  // A file is a stored tab like any other (docs/specs/011-theme/retired-schemes.md).
  it('migrates an imported tab saved against a retired scheme', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = mergeImportedTab(
      tab(),
      tab({ theme: 'charcoal', backgroundColor: '#2b2b33', patternColor: '#636373' }),
    );
    expect(out).toMatchObject({
      theme: 'brand',
      backgroundColor: '#0d121a',
      patternColor: '#1c2735',
    });
  });

  it('keeps what the import does not specify', () => {
    const mine = tab({
      theme: 'midnight',
      kind: 'diagram',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('midnight');
    expect(out.kind).toBe('diagram');
    expect(out.layers).toEqual([{ id: 'a', name: 'A' }]);
  });
});
