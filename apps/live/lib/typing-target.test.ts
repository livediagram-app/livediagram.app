// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isEnterActivatedTarget, isTypingTarget } from './typing-target';

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

describe('isEnterActivatedTarget', () => {
  it('counts buttons, links, widget roles and what sits in a menu, popover or the tour card', () => {
    const link = document.createElement('a');
    link.href = '#x';
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-surface', '');
    const inMenu = document.createElement('span');
    menu.append(inMenu);
    for (const el of [document.createElement('button'), link, tab, inMenu])
      expect(isEnterActivatedTarget(el)).toBe(true);
  });

  it('leaves the canvas, plain text and non-elements alone', () => {
    expect(isEnterActivatedTarget(document.createElement('div'))).toBe(false);
    expect(isEnterActivatedTarget(document.createElement('a'))).toBe(false);
    expect(isEnterActivatedTarget(window)).toBe(false);
    expect(isEnterActivatedTarget(null)).toBe(false);
  });
});
