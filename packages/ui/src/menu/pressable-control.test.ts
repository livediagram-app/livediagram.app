// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPressableControl } from './menu-dom';

// Space on a keyboard-focused control is the control's (WAI-ARIA): a canvas's Space shortcut stands down.
// jsdom has no focus modality, so `:focus-visible` is answered here as a browser would: true after
// keyboard focus, false after a mouse click.
let keyboardFocus = true;
const matches = Element.prototype.matches;

describe('isPressableControl', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      sel: string,
    ) {
      if (sel === ':focus-visible') return keyboardFocus && document.activeElement === this;
      return matches.call(this, sel);
    });
    document.body.innerHTML = `
      <button id="b"><span id="inner">Share</span></button>
      <div role="switch" tabindex="0" id="s"></div>
      <div id="plain" tabindex="0"></div>
      <main id="canvas" tabindex="0"></main>`;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    keyboardFocus = true;
    document.body.innerHTML = '';
  });
  const el = (id: string) => document.getElementById(id)!;

  it('is a keyboard-focused button or switch, or a target inside one', () => {
    for (const id of ['b', 's']) {
      el(id).focus();
      expect(isPressableControl(el(id)), id).toBe(true);
    }
    el('b').focus();
    expect(isPressableControl(el('inner'))).toBe(true);
  });

  it('is never the canvas or a plain focusable, nor a button that kept focus after a click', () => {
    for (const id of ['plain', 'canvas']) {
      el(id).focus();
      expect(isPressableControl(el(id)), id).toBe(false);
    }
    keyboardFocus = false;
    el('b').focus();
    expect(isPressableControl(el('b'))).toBe(false);
    expect(isPressableControl(null)).toBe(false);
  });
});
