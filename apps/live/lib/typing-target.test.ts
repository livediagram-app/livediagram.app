// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './typing-target';

describe('isTypingTarget', () => {
  it('counts fields, textareas, selects and contentEditable', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const label = document.createElement('div');
    Object.defineProperty(label, 'isContentEditable', { value: true });
    expect(isTypingTarget(label)).toBe(true);
  });

  it('leaves out plain elements, nothing, and a select when asked', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement('select'), { select: false })).toBe(false);
  });
});
