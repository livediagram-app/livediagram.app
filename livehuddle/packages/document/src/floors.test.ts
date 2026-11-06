import { describe, expect, it } from 'vitest';
import {
  ANIMATED_BACKGROUND_PATTERNS,
  BACKGROUND_PATTERNS as SHARED_BACKGROUND_PATTERNS,
  SEASONAL_BACKGROUND_PATTERNS,
} from '@liveworkspace/model-core/basics';
import { isBackgroundPattern } from './background-pattern';
import {
  FLOOR_PATTERNS,
  RETIRED_PATTERN_FLOORS,
  isFloorPattern,
  migrateRetiredPattern,
  spacePattern,
} from './floors';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { BackgroundPattern, Tab } from './index';

// docs/specs/011-theme/floors.md: a Space's canvas wears a floor, and a tab saved with a retired diagram pattern opens
// on the floor that table names.
describe('the floors', () => {
  it('are fourteen distinct surfaces, each one a pattern a tab can store', () => {
    expect(FLOOR_PATTERNS).toHaveLength(14);
    expect(new Set(FLOOR_PATTERNS).size).toBe(14);
    for (const floor of FLOOR_PATTERNS) {
      expect(isBackgroundPattern(floor), floor).toBe(true);
      expect(isFloorPattern(floor), floor).toBe(true);
    }
    expect(isFloorPattern('grid')).toBe(false);
    expect(isFloorPattern('blank')).toBe(false);
  });

  it('draw as themselves, as do None and the seasonal motifs', () => {
    for (const floor of FLOOR_PATTERNS) expect(spacePattern(floor)).toBe(floor);
    expect(spacePattern('blank')).toBe('blank');
    for (const motif of SEASONAL_BACKGROUND_PATTERNS) expect(spacePattern(motif)).toBe(motif);
  });
});

describe('the retired diagram patterns', () => {
  const retired = [...SHARED_BACKGROUND_PATTERNS, 'isometric'].filter(
    (p) => p !== 'blank' && !(SEASONAL_BACKGROUND_PATTERNS as readonly string[]).includes(p),
  ) as BackgroundPattern[];

  it('each have a floor, or None, in the one table', () => {
    expect(Object.keys(RETIRED_PATTERN_FLOORS).sort()).toEqual([...retired].sort());
    for (const pattern of retired) {
      const drawn = spacePattern(pattern);
      expect(drawn === 'blank' || isFloorPattern(drawn), pattern).toBe(true);
    }
  });

  it('read the dot grid as carpet tiles, ruled lines as wood, confetti as terrazzo', () => {
    expect(spacePattern('grid')).toBe('carpet-tiles');
    expect(spacePattern('lines')).toBe('wood');
    expect(spacePattern('graph')).toBe('tiles');
    expect(spacePattern('confetti')).toBe('terrazzo');
    expect(spacePattern('waves')).toBe('sand');
    expect(spacePattern('isometric')).toBe('tiles');
  });

  it('read the animated patterns as None: a floor does not move', () => {
    for (const pattern of ANIMATED_BACKGROUND_PATTERNS) expect(spacePattern(pattern)).toBe('blank');
  });

  it('read an unset pattern as the theme grid’s floor, and an unknown id as None', () => {
    expect(spacePattern(undefined)).toBe('carpet-tiles');
    expect(spacePattern('nonsense' as BackgroundPattern)).toBe('blank');
  });
});

describe('loading a tab', () => {
  const saved = (backgroundPattern?: string) =>
    ({
      id: 't',
      name: 'T',
      ...(backgroundPattern ? { backgroundPattern } : {}),
      patternColor: '#cbd5e1',
      elements: [],
    }) as unknown as Tab;

  it('moves a stored diagram pattern onto its floor, keeping the rest of the tab', () => {
    const tab = migrateStoredTab(saved('isometric'));
    expect(tab.backgroundPattern).toBe('tiles');
    expect(tab.patternColor).toBe('#cbd5e1');
    expect(migrateStoredTab(saved('grid')).backgroundPattern).toBe('carpet-tiles');
    expect(migrateStoredTab(saved('aurora')).backgroundPattern).toBe('blank');
  });

  it('runs on a tab that arrives from outside too (an api write, a peer, a file)', () => {
    const tab = migrateIncomingTab(saved('hexagonal')) as Tab;
    expect(tab.backgroundPattern).toBe('cobbles');
  });

  it('hands a tab already on a floor, on None, or unset back as it came', () => {
    for (const tab of [saved('grass'), saved('blank'), saved('snowflakes'), saved()]) {
      expect(migrateRetiredPattern(tab)).toBe(tab);
    }
    expect(migrateStoredTab(saved()).backgroundPattern).toBeUndefined();
  });
});
