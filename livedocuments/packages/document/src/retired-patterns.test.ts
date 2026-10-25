import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETIRED_PATTERNS, isBackgroundPattern } from './retired-patterns';
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

  it('opens a stored tab that wore it as Crosshatch, its colour kept', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = migrateStoredTab(saved());
    expect(tab.backgroundPattern).toBe('crosshatch');
    expect(tab.patternColor).toBe('#cbd5e1');
  });

  it('moves a tab that arrives wearing it (an api write, a file) before validation', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect((migrateIncomingTab(saved()) as Tab).backgroundPattern).toBe('crosshatch');
  });

  it('leaves a tab on any other pattern as it is', () => {
    const tab = { id: 't', name: 'T', backgroundPattern: 'graph', elements: [] } as Tab;
    expect(migrateStoredTab(tab).backgroundPattern).toBe('graph');
  });
});
