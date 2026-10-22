import { describe, expect, it } from 'vitest';
import { type Tab, tabToJsonText } from '@livedocuments/document';
import { parseImportedTab } from './import-tab';
import { mergeImportedTab } from './import-merge';

// The whole journey a Plan tab takes when someone mails it to a colleague: export to JSON, import into a
// fresh tab, and it must STILL be that kind of tab. This is the end-to-end pin for the merge rule — each half
// was correct on its own while the join quietly dropped the kind.
describe('export -> import round trip', () => {
  const board = (): Tab =>
    ({
      id: 'src',
      name: 'Roadmap',
      kind: 'board',
      opensIn: 'plan',
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

  it('keeps the kind', () => {
    const parsed = parseImportedTab(tabToJsonText(board()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(mergeImportedTab(plainTab(), parsed.tab).kind).toBe('board');
  });

  it('keeps the layer the notes are filed on, so their layerId resolves', () => {
    const parsed = parseImportedTab(tabToJsonText(board()));
    if (!parsed.ok) throw new Error('parse failed');
    const merged = mergeImportedTab(plainTab(), parsed.tab);
    const layerIds = (merged.layers ?? []).map((l) => l.id);
    for (const el of merged.elements) {
      if (el.layerId) expect(layerIds).toContain(el.layerId);
    }
  });

  it('leaves an ordinary import ordinary', () => {
    const plain = { ...plainTab(), id: 'src', elements: [] } as Tab;
    const parsed = parseImportedTab(tabToJsonText(plain));
    if (!parsed.ok) throw new Error('parse failed');
    expect(mergeImportedTab(plainTab(), parsed.tab).kind).toBeUndefined();
  });
});
