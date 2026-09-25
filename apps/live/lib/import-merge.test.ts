import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { mergeImportedTab } from './import-merge';

const tab = (over: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

describe('mergeImportedTab', () => {
  it('takes the imported elements and marks the template chosen', () => {
    const out = mergeImportedTab(tab({ name: 'Mine' }), tab({ elements: [], theme: 'slate' }));
    expect(out.templateChosen).toBe(true);
    expect(out.name).toBe('Mine');
  });

  it('carries the board KIND, so an imported workshop board is still one', () => {
    // Without this the export/import round trip quietly downgraded a
    // workshop board to an ordinary diagram: the notes came back, but the
    // palette, the stationery and the note menu did not.
    const out = mergeImportedTab(tab(), tab({ kind: 'event-storming' }));
    expect(out.kind).toBe('event-storming');
  });

  it('carries the imported LAYERS, so element layerIds still resolve', () => {
    const layers = [{ id: 'layer:es:board', name: 'Event Storming' }];
    expect(mergeImportedTab(tab(), tab({ layers })).layers).toEqual(layers);
  });

  it('keeps what the import does not specify', () => {
    const mine = tab({
      theme: 'charcoal',
      kind: 'event-storming',
      layers: [{ id: 'a', name: 'A' }],
    });
    const out = mergeImportedTab(mine, tab());
    expect(out.theme).toBe('charcoal');
    expect(out.kind).toBe('event-storming');
    expect(out.layers).toEqual([{ id: 'a', name: 'A' }]);
  });

  // Timeline lanes are BOARD state (spec/139 Phase 6): a board exported with
  // Anchor docking is retired (spec/139 Phase 7): a file exported while it
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
