import { describe, expect, it } from 'vitest';
import {
  appearanceToggleName,
  nextAppearanceSetting,
  oppositeAppearanceSetting,
  quickAppearanceToggleName,
} from './appearance-cycle';

// The Appearance control's steps (docs/specs/004-interface-design/appearance.md) and the power
// user quick switch (docs/specs/007-editor/power-user-mode.md#quick-appearance-switch).

describe('nextAppearanceSetting', () => {
  it('cycles Light, Dark, System', () => {
    expect(nextAppearanceSetting('light')).toBe('dark');
    expect(nextAppearanceSetting('dark')).toBe('system');
    expect(nextAppearanceSetting('system')).toBe('light');
  });

  it('names where the next click goes', () => {
    expect(appearanceToggleName('dark')).toBe('Appearance: Dark. Switch to System.');
  });
});

describe('oppositeAppearanceSetting', () => {
  it('flips the painted appearance', () => {
    expect(oppositeAppearanceSetting('light')).toBe('dark');
    expect(oppositeAppearanceSetting('dark')).toBe('light');
  });
});

describe('quickAppearanceToggleName', () => {
  it('names the flip and the right-click to System', () => {
    expect(quickAppearanceToggleName('dark', 'dark')).toBe(
      'Appearance: Dark. Switch to Light. Right-click to follow your device.',
    );
  });

  it('flips from what System paints', () => {
    expect(quickAppearanceToggleName('system', 'dark')).toBe(
      'Appearance: System. Switch to Light. Right-click to follow your device.',
    );
    expect(quickAppearanceToggleName('system', 'light')).toBe(
      'Appearance: System. Switch to Dark. Right-click to follow your device.',
    );
  });
});
