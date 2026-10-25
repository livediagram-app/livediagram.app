import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  it('carries the tab KIND, so an imported Plan tab is still one', () => {
    const out = mergeImportedTab(tab(), tab({ kind: 'sheet' }));
    expect(out.kind).toBe('sheet');
  });

  // An exported whiteboard from before editor modes comes back as an ordinary tab.
  it('carries a Form tab’s form, so an imported Form tab is not left without one', () => {
    // docs/specs/030-forms/forms.md: a form restored from a file comes back as a copy. Only the kind came across, so
    // the tab read as a Form tab holding no form.
    const form = { v: 1, heading: 'Contact', sections: [{ id: 's1', title: '', questions: [] }] };
    const out = mergeImportedTab(tab(), {
      ...tab({ kind: 'form' }),
      form,
    } as unknown as Tab);
    expect(out).toMatchObject({ kind: 'form', form });
    // Any other import leaves a receiving Form tab's form alone.
    expect(
      mergeImportedTab({ ...tab({ kind: 'form' }), form } as unknown as Tab, tab()).form,
    ).toEqual(form);
  });

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:cards', name: 'Cards' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
  });

  // A file is a stored tab like any other (docs/specs/011-theme/retired-schemes.md).
  it('keeps what the import does not specify', () => {
    const mine = tab({
      theme: 'midnight',
      kind: 'board',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('midnight');
    expect(out.kind).toBe('board');
    expect(out.layers).toEqual([{ id: 'a', name: 'A' }]);
  });
});
