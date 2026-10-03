import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  it('carries the tab KIND, so an imported workshop board is still one', () => {
    // Without this the export/import round trip quietly downgraded a
    // workshop board to an ordinary diagram: the notes came back, but the
    // palette, the stationery and the note menu did not.
    const out = mergeImportedTab(tab(), tab({ kind: 'event-storming' }));
    expect(out.kind).toBe('event-storming');
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

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:es:board', name: 'Event Storming' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
  });

  it('lands an imported workshop board on the lanes and marks it settled', () => {
    // docs/specs/021-event-storming/event-storming.md "Always on a lane": a file import lands every workshop
    // note on its nearest lane, x untouched.
    const note = {
      id: 'n',
      type: 'sticky',
      esKind: 'command',
      fillColor: '#93c5fd',
      fixedSize: true,
      x: 17,
      y: 130,
      width: 200,
      height: 200,
    } as Tab['elements'][number];
    const out = mergeImportedTab(tab(), tab({ kind: 'event-storming', elements: [note] }));
    expect(out.elements[0]).toMatchObject({ x: 17, y: 240 });
    expect(out.esLanesSettled).toBe(true);
  });

  it('leaves an ordinary import where it was', () => {
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 130, width: 9, height: 9 };
    const out = mergeImportedTab(tab(), tab({ elements: [shape as Tab['elements'][number]] }));
    expect(out.elements[0]).toMatchObject({ y: 130 });
    expect(out.esLanesSettled).toBeUndefined();
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
      kind: 'event-storming',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('midnight');
    expect(out.kind).toBe('event-storming');
    expect(out.layers).toEqual([{ id: 'a', name: 'A' }]);
  });

  // Timeline lanes are BOARD state (docs/specs/021-event-storming/event-storming.md Phase 6): a board exported with
  // Anchor docking is retired (docs/specs/021-event-storming/event-storming.md Phase 7): a file exported while it
  // existed brings its relations in, and they are dropped on the way.
  it('drops a stored dock relation', () => {
    const imported = tab({
      elements: [
        {
          id: 'd',
          type: 'sticky',
          esKind: 'command',
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
