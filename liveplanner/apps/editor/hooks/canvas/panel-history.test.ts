// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';
import { TAKES_HISTORY_ATTR, modalTakesHistory } from './panel-history';

// docs/specs/008-canvas/canvas-and-palette.md "Keyboard shortcuts" (Work Tracker 746): which chords the item panel
// hands to the editor while it is open.

const key = (target: EventTarget, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k });
  Object.defineProperty(e, 'target', { value: target });
  return e;
};

let opened = 0;
function open(markup: string) {
  document.body.innerHTML = markup;
  modalOpened();
  opened += 1;
}
afterEach(() => {
  while (opened > 0) {
    modalClosed();
    opened -= 1;
  }
  document.body.innerHTML = '';
});

const PANEL = `<div data-dialog-panel><span ${TAKES_HISTORY_ATTR}></span><button id="b"></button><div data-menu-surface><button id="mb"></button></div><textarea id="t"></textarea><div id="ce" contenteditable="true"></div></div><button id="out"></button>`;
const $ = (id: string) => document.getElementById(id)!;

describe('modalTakesHistory', () => {
  it('passes Z and Y with a modifier, from the panel or the body', () => {
    open(PANEL);
    expect(modalTakesHistory(key($('b'), 'z'), true)).toBe(true);
    expect(modalTakesHistory(key($('b'), 'Z'), true)).toBe(true);
    expect(modalTakesHistory(key($('b'), 'y'), true)).toBe(true);
    expect(modalTakesHistory(key(document.body, 'z'), true)).toBe(true);
  });

  it('passes nothing without a modifier, and no other key', () => {
    open(PANEL);
    expect(modalTakesHistory(key($('b'), 'z'), false)).toBe(false);
    expect(modalTakesHistory(key($('b'), 'c'), true)).toBe(false);
  });

  it('keeps text fields, contentEditable and menus their own', () => {
    open(PANEL);
    // jsdom has no isContentEditable; a browser sets it from the attribute.
    Object.defineProperty($('ce'), 'isContentEditable', { value: true });
    for (const id of ['t', 'ce', 'mb'])
      expect(modalTakesHistory(key($(id), 'z'), true)).toBe(false);
  });

  it('passes nothing from outside the panel, with a dialog over it, or with no panel that takes it', () => {
    open(PANEL);
    expect(modalTakesHistory(key($('out'), 'z'), true)).toBe(false);
    modalOpened();
    opened += 1;
    expect(modalTakesHistory(key($('b'), 'z'), true)).toBe(false);
    modalClosed();
    opened -= 1;
    document.body.innerHTML = '<div data-dialog-panel><button id="b"></button></div>';
    expect(modalTakesHistory(key($('b'), 'z'), true)).toBe(false);
  });
});
