import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  // docs/specs/007-editor/pages-mode.md "One mode": the mode a tab opens in travels with it.
  it('carries the opening mode', () => {
    expect(mergeImportedTab(tab(), tab({ opensIn: 'pages' })).opensIn).toBe('pages');
    expect(mergeImportedTab(tab({ opensIn: 'pages' }), tab()).opensIn).toBe('pages');
  });

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:cards', name: 'Cards' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
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

  // Anchor docking is retired: a file exported while it
  // existed brings its relations in, and they are dropped on the way.
  it('drops a stored dock relation', () => {
    const imported = tab({
      elements: [
        {
          id: 'd',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          esDock: { hostId: 'h', side: 'before' },
        },
      ] as unknown as Tab['elements'],
    });
    const out = mergeImportedTab(tab(), imported);
    expect(out.elements[0]).not.toHaveProperty('esDock');
  });
});
