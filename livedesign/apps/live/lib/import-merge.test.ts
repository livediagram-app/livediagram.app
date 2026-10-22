import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/document';
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

  // docs/specs/007-editor/editor-modes.md: an exported tab that opens in Draw still does, and an
  // exported whiteboard from before editor modes comes back as one.
  it('carries the opening mode, and reads an old whiteboard export as opening in Draw', () => {
    expect(mergeImportedTab(tab(), tab({ opensIn: 'draw' })).opensIn).toBe('draw');
    expect(mergeImportedTab(tab({ opensIn: 'draw' }), tab()).opensIn).toBe('draw');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const old = { ...tab(), kind: 'whiteboard' } as unknown as Tab;
    expect(mergeImportedTab(tab(), old)).toMatchObject({ kind: 'diagram', opensIn: 'draw' });
  });

  it('carries a Form tab’s form, so an imported Form tab is not left without one', () => {
    // docs/specs/030-forms/forms.md: a form restored from a file comes back as a copy. Only the kind came across, so
    // the tab read as a Form tab holding no form.
    const form = { v: 1, heading: 'Contact', sections: [{ id: 's1', title: '', questions: [] }] };
    const out = mergeImportedTab(tab(), {
      ...tab({ kind: 'form', opensIn: 'plan' }),
      form,
    } as unknown as Tab);
    expect(out).toMatchObject({ kind: 'form', opensIn: 'plan', form });
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
      kind: 'board',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('midnight');
    expect(out.kind).toBe('board');
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
