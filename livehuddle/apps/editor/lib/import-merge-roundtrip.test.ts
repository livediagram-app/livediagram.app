import { describe, expect, it } from 'vitest';
import { type Tab, tabToJsonText } from '@livehuddle/document';
import { parseImportedTab } from './import-tab';
import { mergeImportedTab } from './import-merge';

// The whole journey a board takes when someone mails it to a colleague: export to JSON, import into a
// fresh tab. A board saved while livehuddle had layers arrives as one plane (docs/specs/006-document/layers.md
// "Documents saved with layers"): its notes land, and the layer fields do not.
describe('export -> import round trip', () => {
  const board = (): Tab =>
    ({
      id: 'src',
      name: 'Cart Emptied',
      layers: [{ id: 'layer:notes', name: 'Notes' }],
      elements: [
        {
          id: 'n1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          label: 'Cart Emptied',
          layerId: 'layer:notes',
        },
      ],
    }) as unknown as Tab;

  const plainTab = (): Tab => ({ id: 'dest', name: 'Tab 1', elements: [] });

  it('lands the notes and drops the retired layer fields', () => {
    const parsed = parseImportedTab(tabToJsonText(board()));
    if (!parsed.ok) throw new Error('parse failed');
    const merged = mergeImportedTab(plainTab(), parsed.tab);
    expect(merged.elements.map((el) => el.id)).toEqual(['n1']);
    expect('layers' in merged).toBe(false);
    expect('layerId' in merged.elements[0]!).toBe(false);
  });
});
