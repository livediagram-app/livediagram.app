// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FRESH_TITLE_KEYS_MS,
  armFreshTitleKeys,
  takeFreshTitleKeys,
  typeIntoField,
} from './fresh-title-keys';

// docs/specs/026-plan/plan-board.md "A card just made opens at once": keys typed before a new card's title takes focus
// are kept for it; blueprint plan-board.md "Typing ahead".

afterEach(() => {
  takeFreshTitleKeys();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

// A key as the board would get it: on the body (or `on`), bubbling. Returns whether it reached the board.
function press(key: string, init: KeyboardEventInit = {}, on: EventTarget = document.body) {
  const board = vi.fn();
  document.addEventListener('keydown', board);
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  on.dispatchEvent(e);
  document.removeEventListener('keydown', board);
  return { reached: board.mock.calls.length > 0, prevented: e.defaultPrevented };
}

const type = (text: string) => [...text].map((c) => press(c));

describe('typing ahead of a new card’s title', () => {
  it('holds every printable key, in order, from the board and its shortcuts', () => {
    armFreshTitleKeys();
    const pressed = type('Fix login bug');
    expect(pressed.every((p) => !p.reached && p.prevented)).toBe(true);
    expect(takeFreshTitleKeys()).toBe('Fix login bug');
  });

  it('lets go once taken: later keys reach the board, and a second take is empty', () => {
    armFreshTitleKeys();
    type('ab');
    expect(takeFreshTitleKeys()).toBe('ab');
    expect(press('c').reached).toBe(true);
    expect(takeFreshTitleKeys()).toBe('');
  });

  it('takes a Backspace back off what it holds, and passes one through with nothing held', () => {
    armFreshTitleKeys();
    expect(press('Backspace').reached).toBe(true);
    type('Fixx');
    expect(press('Backspace').reached).toBe(false);
    expect(takeFreshTitleKeys()).toBe('Fix');
  });

  it('leaves shortcuts and keys that type nothing alone', () => {
    armFreshTitleKeys();
    expect(press('z', { metaKey: true }).reached).toBe(true);
    expect(press('z', { ctrlKey: true }).reached).toBe(true);
    expect(press('z', { altKey: true }).reached).toBe(true);
    expect(press('ArrowDown').reached).toBe(true);
    type('ok');
    expect(takeFreshTitleKeys()).toBe('ok');
  });

  it.each([
    ['Escape', {}],
    ['Process', {}],
    ['Dead', {}],
    ['a', { isComposing: true }],
  ])('lets go on %s, so an IME or a close keeps its keys', (key, init) => {
    armFreshTitleKeys();
    type('ab');
    expect(press(key, init).reached).toBe(true);
    expect(press('c').reached).toBe(true);
    expect(takeFreshTitleKeys()).toBe('');
  });

  it('lets go when a text field already has the typing', () => {
    const field = document.body.appendChild(document.createElement('input'));
    armFreshTitleKeys();
    expect(press('a', {}, field).reached).toBe(true);
    expect(takeFreshTitleKeys()).toBe('');
  });

  it('holds a key aimed at the page itself', () => {
    armFreshTitleKeys();
    expect(press('a', {}, globalThis.document).reached).toBe(false);
    expect(takeFreshTitleKeys()).toBe('a');
  });

  it('lets go of a contenteditable’s typing too', () => {
    const editable = document.body.appendChild(document.createElement('div'));
    editable.contentEditable = 'true';
    // jsdom has no isContentEditable: the browser's answer.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    armFreshTitleKeys();
    expect(press('a', {}, editable).reached).toBe(true);
    expect(takeFreshTitleKeys()).toBe('');
  });

  it('lets go when no title takes the keys in time', () => {
    vi.useFakeTimers();
    armFreshTitleKeys();
    type('ab');
    vi.advanceTimersByTime(FRESH_TITLE_KEYS_MS);
    expect(press('c').reached).toBe(true);
    expect(takeFreshTitleKeys()).toBe('');
  });

  it('starts afresh for a second new card', () => {
    armFreshTitleKeys();
    type('first');
    armFreshTitleKeys();
    type('second');
    expect(takeFreshTitleKeys()).toBe('second');
  });
});

describe('typeIntoField', () => {
  it.each([
    ['textarea', () => document.createElement('textarea')],
    ['input', () => document.createElement('input')],
  ] as const)('puts the text in a %s as typing would, caret at its end', (_, make) => {
    const field = document.body.appendChild(make());
    field.value = 'New task';
    const onInput = vi.fn();
    field.addEventListener('input', onInput);
    typeIntoField(field, 'Fix login bug');
    expect(field.value).toBe('Fix login bug');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(field.selectionStart).toBe('Fix login bug'.length);
  });

  it('keeps to the field’s limit', () => {
    const field = document.body.appendChild(document.createElement('textarea'));
    field.maxLength = 3;
    typeIntoField(field, 'Fix login bug');
    expect(field.value).toBe('Fix');
  });
});
