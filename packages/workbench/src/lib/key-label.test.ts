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

  it('reads a letter key as its capital, as a keymap writes it in lower case', () => {
    expect(keyLabel('Mod-e', true)).toBe('⌘E');
    expect(keyLabel('Mod-Shift-x', true)).toBe('⌘⇧X');
    expect(keyLabel('Mod-Shift-l', false)).toBe('Ctrl+Shift+L');
    expect(keyLabel('Mod-\\', true)).toBe('⌘\\');
    expect(keyLabel('Shift-Tab', true)).toBe('⇧Tab');
  });
});
