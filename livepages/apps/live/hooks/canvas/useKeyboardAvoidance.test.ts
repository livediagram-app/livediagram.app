import { describe, expect, it } from 'vitest';
import { KEYBOARD_MARGIN_PX, keyboardOverlap } from './useKeyboardAvoidance';

describe('keyboardOverlap', () => {
  it('is 0 while the caret is above the keyboard, margin included', () => {
    expect(keyboardOverlap(400, 500)).toBe(0);
    expect(keyboardOverlap(500 - KEYBOARD_MARGIN_PX, 500)).toBe(0);
  });

  it('is how far the caret runs under the keyboard, plus the margin', () => {
    // A caret at y=600 with the visible area ending at y=500 (keyboard above it).
    expect(keyboardOverlap(600, 500)).toBe(100 + KEYBOARD_MARGIN_PX);
  });
});
