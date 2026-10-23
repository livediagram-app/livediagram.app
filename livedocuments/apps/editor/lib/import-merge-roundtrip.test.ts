import { describe, expect, it } from 'vitest';
import { type Tab, tabToJsonText } from '@livedocuments/document';
import { parseImportedTab } from './import-tab';
import { mergeImportedTab } from './import-merge';

// The whole journey a tab takes when someone mails it to a colleague: export to JSON, then import into a
// fresh tab.
describe('export -> import round trip', () => {
  const board = (): Tab =>
    ({
      id: 'src',
      name: 'Roadmap',
      layers: [{ id: 'layer:cards', name: 'Cards' }],
      elements: [
        {
          id: 'n1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          label: 'Ship it',
          layerId: 'layer:cards',
        },
      ],
    }) as unknown as Tab;

  const plainTab = (): Tab => ({ id: 'dest', name: 'Tab 1', elements: [] });

  it('keeps the layer the notes are filed on, so their layerId resolves', () => {
    const parsed = parseImportedTab(tabToJsonText(board()));
    if (!parsed.ok) throw new Error('parse failed');
    const merged = mergeImportedTab(plainTab(), parsed.tab);
    const layerIds = (merged.layers ?? []).map((l) => l.id);
    for (const el of merged.elements) {
      if (el.layerId) expect(layerIds).toContain(el.layerId);
    }
  });
});
