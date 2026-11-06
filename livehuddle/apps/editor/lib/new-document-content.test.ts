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

  // docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one".
  it('makes a Start Blank Space with its Avatar Pad, and a Space that opens on its start empty', () => {
    const [blank] = newDocumentTabs({
      templateKind: 'blank-session',
      themeId: 'brand',
      tabId: 'a',
    });
    expect(blank!.elements.map((e) => e.type === 'shape' && e.shape)).toEqual(['avatar-pad']);
    const [onStart] = newDocumentTabs({
      templateKind: 'blank-session',
      themeId: 'brand',
      tabId: 'b',
      blankOpensOnStart: true,
    });
    expect(onStart!.elements).toEqual([]);
    expect(onStart!.id).toBe('b');
    expect(onStart!.name).toBe('Tab 1');
    // A template other than the blank is made whole either way.
    const [pod] = newDocumentTabs({
      templateKind: 'team-pod',
      themeId: 'brand',
      tabId: 'c',
      blankOpensOnStart: true,
    });
    expect(pod!.elements.length).toBeGreaterThan(1);
  });
});
