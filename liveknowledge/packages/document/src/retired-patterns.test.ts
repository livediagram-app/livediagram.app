import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETIRED_PATTERNS, isBackgroundPattern, migrateRetiredPattern } from './retired-patterns';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { Tab } from './index';

// The Isometric background pattern left this product on 2026-10-25 (docs/specs/008-canvas/canvas-and-palette.md
// "Retired features"); livediagram keeps it. A tab saved wearing it still opens, as Crosshatch.
describe('the retired Isometric pattern', () => {
  afterEach(() => vi.restoreAllMocks());

  // A tab as it was saved, with the pattern this product no longer types.
  const saved = () =>
    ({
      id: 't',
      name: 'T',
      backgroundPattern: 'isometric',
      patternColor: '#cbd5e1',
      elements: [],
    }) as unknown as Tab;

  it('is no pattern this product offers', () => {
    expect(isBackgroundPattern('isometric')).toBe(false);
    expect(isBackgroundPattern('crosshatch')).toBe(true);
    expect(RETIRED_PATTERNS.isometric).toBe('crosshatch');
  });

  it('reads a tab that wore it as Crosshatch, its colour kept', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = migrateRetiredPattern(saved());
    expect(tab.backgroundPattern).toBe('crosshatch');
    expect(tab.patternColor).toBe('#cbd5e1');
    const graph = { id: 't', name: 'T', backgroundPattern: 'graph', elements: [] } as Tab;
    expect(migrateRetiredPattern(graph)).toBe(graph);
  });

  // docs/specs/030-knowledgebase/page-surface.md "No tab has a style": a knowledgebase's tab keeps no surround at
  // all, so a stored or arriving tab opens without one, and still opens (it is never refused for the retired name).
  it('opens a stored or arriving tab that wore it with no pattern of its own', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    for (const tab of [migrateStoredTab(saved()), migrateIncomingTab(saved()) as Tab]) {
      expect(tab).not.toHaveProperty('backgroundPattern');
      expect(tab).not.toHaveProperty('patternColor');
      expect(tab.id).toBe('t');
    }
  });
});
