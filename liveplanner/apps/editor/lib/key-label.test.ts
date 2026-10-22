import { describe, expect, it } from 'vitest';
import { keyLabel } from './key-label';

describe('keyLabel', () => {
  it('spells a shortcut the way an Apple device does', () => {
    expect(keyLabel('Mod-B', true)).toBe('⌘B');
    expect(keyLabel('Shift-Mod-V', true)).toBe('⇧⌘V');
    expect(keyLabel('Alt-Mod-1', true)).toBe('⌥⌘1');
  });

  it('spells it with Ctrl elsewhere', () => {
    expect(keyLabel('Mod-B', false)).toBe('Ctrl+B');
    expect(keyLabel('Shift-Mod-V', false)).toBe('Shift+Ctrl+V');
    expect(keyLabel('Alt-Mod-1', false)).toBe('Alt+Ctrl+1');
  });
});
