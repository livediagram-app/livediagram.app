// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { findChordOf, seedFromSelection } from './find-shortcut';

// docs/specs/007-editor/find-and-replace.md "Opening and closing": the chords open Find only while the document has
// the keyboard; elsewhere the browser keeps its own find.
type Key = Parameters<typeof findChordOf>[0];
const key = (over: Partial<Key>): Key => ({
  key: 'f',
  code: 'KeyF',
  metaKey: true,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: document.body,
  ...over,
});
const open = { standsAside: false };

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('findChordOf', () => {
  it('reads Cmd/Ctrl+F as Find and Cmd/Ctrl+Shift+H as Replace', () => {
    expect(findChordOf(key({}), open)).toBe('find');
    expect(findChordOf(key({ metaKey: false, ctrlKey: true }), open)).toBe('find');
    expect(findChordOf(key({ key: 'H', code: 'KeyH', shiftKey: true }), open)).toBe('replace');
    // A layout where the key is another letter still reads by its place.
    expect(findChordOf(key({ key: 'ф' }), open)).toBe('find');
  });

  it('passes over other keys, no modifier, Alt, and Shift+F', () => {
    expect(findChordOf(key({ metaKey: false }), open)).toBeNull();
    expect(findChordOf(key({ altKey: true }), open)).toBeNull();
    expect(findChordOf(key({ shiftKey: true }), open)).toBeNull();
    expect(findChordOf(key({ key: 'h', code: 'KeyH' }), open)).toBeNull();
    expect(findChordOf(key({ key: 'g', code: 'KeyG' }), open)).toBeNull();
  });

  it('leaves the key to the browser while a dialog, a deck or an embed stands aside', () => {
    expect(findChordOf(key({}), { standsAside: true })).toBeNull();
  });

  it('leaves the key to the browser in another text field, but not in the writing or the bar', () => {
    document.body.innerHTML = `
      <input id="other" />
      <div class="article-flow"><div id="writing" contenteditable="true">x</div></div>
      <div data-find-bar><input id="bar" /></div>`;
    const at = (id: string) => document.getElementById(id);
    expect(findChordOf(key({ target: at('other') }), open)).toBeNull();
    expect(findChordOf(key({ target: at('writing') }), open)).toBe('find');
    expect(findChordOf(key({ target: at('bar') }), open)).toBe('find');
  });
});

describe('seedFromSelection', () => {
  const select = (el: Node, from: number, to: number) => {
    const range = document.createRange();
    range.setStart(el, from);
    range.setEnd(el, to);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  it("takes one line of the writing's selection", () => {
    document.body.innerHTML = '<div class="article-flow"><p id="p">Our plan is set</p></div>';
    select(document.getElementById('p')!.firstChild!, 4, 8);
    expect(seedFromSelection(200)).toBe('plan');
    expect(seedFromSelection(3)).toBe('');
  });

  it('takes nothing outside the writing, or with no selection', () => {
    expect(seedFromSelection(200)).toBe('');
    document.body.innerHTML = '<p id="p">Our plan</p>';
    select(document.getElementById('p')!.firstChild!, 0, 3);
    expect(seedFromSelection(200)).toBe('');
  });
});
