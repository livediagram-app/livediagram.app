import { describe, expect, it } from 'vitest';
import { appearanceToggleName, nextAppearanceSetting } from './appearance-cycle';

// The Appearance control's steps (docs/specs/004-interface-design/appearance.md).

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
