import { describe, expect, it } from 'vitest';
import { isBackgroundPattern as isSharedBackgroundPattern } from '@liveworkspace/model-core/basics';
import { isBackgroundPattern } from './background-pattern';
import { migrateStoredTab } from './stored-tab';
import type { Tab } from './index';

// Isometric is livehuddle's alone (docs/specs/008-canvas/canvas-and-palette.md): the shared union left it out when
// the other products retired it, and livehuddle's own pattern type adds it back.
describe("livehuddle's background patterns", () => {
  it('takes Isometric, which the shared patterns no longer hold', () => {
    expect(isSharedBackgroundPattern('isometric')).toBe(false);
    expect(isBackgroundPattern('isometric')).toBe(true);
  });

  it('takes every shared pattern and refuses anything else', () => {
    expect(isBackgroundPattern('grid')).toBe(true);
    expect(isBackgroundPattern('crosshatch')).toBe(true);
    expect(isBackgroundPattern('not-a-pattern')).toBe(false);
    expect(isBackgroundPattern(undefined)).toBe(false);
    expect(isBackgroundPattern('toString')).toBe(false);
  });

  it('opens a stored tab saved with Isometric as Isometric', () => {
    const saved = {
      id: 't',
      name: 'T',
      backgroundPattern: 'isometric',
      patternColor: '#cbd5e1',
      elements: [],
    } as unknown as Tab;
    const tab = migrateStoredTab(saved);
    expect(tab.backgroundPattern).toBe('isometric');
    expect(tab.patternColor).toBe('#cbd5e1');
  });
});
