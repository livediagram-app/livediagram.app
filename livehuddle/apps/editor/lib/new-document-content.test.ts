import { describe, expect, it } from 'vitest';
import { newDocumentTabs } from './new-document-content';

// docs/specs/007-editor/templates-by-mode.md "A template with floors": /new makes a building with every floor a tab.
describe('newDocumentTabs', () => {
  it('makes the Co-working Tower one tab per floor, named after each, each its own floor', () => {
    const tabs = newDocumentTabs({
      templateKind: 'coworking-tower',
      themeId: 'brand',
      tabId: 'first',
    });
    expect(tabs.map((t) => t.name)).toEqual(['Ground Floor', 'Level 2', 'Level 3']);
    expect(tabs.map((t) => t.backgroundPattern)).toEqual(['wood', 'carpet-tiles', 'parquet']);
    expect(tabs[0]!.id).toBe('first');
    expect(new Set(tabs.map((t) => t.id)).size).toBe(3);
    // The North and South Lifts on every floor.
    for (const tab of tabs)
      expect(
        tab.elements
          .filter((e) => e.type === 'shape' && e.shape === 'elevator')
          .map((e) => (e as { label?: string }).label),
        tab.name,
      ).toEqual(['North Lift', 'South Lift']);
  });

  it('makes one tab for a template on one tab, and for no template', () => {
    expect(
      newDocumentTabs({ templateKind: 'team-pod', themeId: 'brand', tabId: 'a' }),
    ).toHaveLength(1);
    expect(newDocumentTabs({ templateKind: null, themeId: 'brand', tabId: 'a' })).toHaveLength(1);
  });
});
