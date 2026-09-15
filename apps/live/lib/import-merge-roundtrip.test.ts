import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { isEventStormingTab } from '@livediagram/diagram';
import { tabToJsonText } from './export-tab-text';
import { parseImportedTab } from './import-tab';
import { mergeImportedTab } from './import-merge';

// The whole journey a workshop board takes when someone mails it to a
// colleague: export to JSON, import into a fresh tab, and it must STILL be a
// workshop board. This is the end-to-end pin for the merge rule — each half
// was correct on its own while the join quietly dropped the board.
describe('export -> import round trip', () => {
  const esBoard = (): Tab =>
    ({
      id: 'src',
      name: 'Cart Emptied',
      kind: 'event-storming',
      layers: [{ id: 'layer:es:board', name: 'Event Storming' }],
      elements: [
        {
          id: 'n1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          label: 'Cart Emptied',
          esKind: 'domain-event',
          layerId: 'layer:es:board',
        },
      ],
    }) as unknown as Tab;

  const plainTab = (): Tab => ({ id: 'dest', name: 'Tab 1', elements: [] }) as Tab;

  it('keeps the board a board', () => {
    const parsed = parseImportedTab(tabToJsonText(esBoard()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = mergeImportedTab(plainTab(), parsed.tab);
    expect(isEventStormingTab(merged)).toBe(true);
    expect(merged.kind).toBe('event-storming');
  });

  it('keeps the layer the notes are filed on, so their layerId resolves', () => {
    const parsed = parseImportedTab(tabToJsonText(esBoard()));
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
    expect(isEventStormingTab(mergeImportedTab(plainTab(), parsed.tab))).toBe(false);
  });
});
