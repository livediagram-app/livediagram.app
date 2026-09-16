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
  // lanes on and re-imported without them would come back a different board.
  it('carries the timeline lane stack', () => {
    const esTimeline = { originX: 120, originY: 80, enabled: true };
    expect(mergeImportedTab(tab(), tab({ esTimeline })).esTimeline).toEqual(esTimeline);
  });

  // A dock pointing at a host the file does not contain (a hand-edited
  // export, a partial paste) must not come in as a relation to nothing.
  it('frees a docked note whose host is not in the file', () => {
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
          esDock: { hostId: 'missing', side: 'before' },
        },
      ] as Tab['elements'],
    });
    const out = mergeImportedTab(tab(), imported);
    expect('esDock' in (out.elements[0] as { esDock?: unknown })).toBe(false);
  });

  it('keeps a dock whose host came with it', () => {
    const elements = [
      { id: 'h', type: 'sticky', esKind: 'domain-event', x: 0, y: 0, width: 200, height: 200 },
      {
        id: 'd',
        type: 'sticky',
        esKind: 'command',
        x: -216,
        y: 0,
        width: 200,
        height: 200,
        esDock: { hostId: 'h', side: 'before' },
      },
    ] as Tab['elements'];
    const out = mergeImportedTab(tab(), tab({ elements }));
    expect((out.elements[1] as { esDock?: unknown }).esDock).toEqual({
      hostId: 'h',
      side: 'before',
    });
  });
});
