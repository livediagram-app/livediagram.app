import { describe, expect, it } from 'vitest';
import { sheetKey, type KeyLike } from './sheet-keys';

const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('the grid keys (sheet.md "Keyboard")', () => {
  it.each([
    [k('ArrowDown'), { kind: 'move', dir: 'down', jump: false, extend: false }],
    [k('ArrowLeft', { shiftKey: true }), { kind: 'move', dir: 'left', jump: false, extend: true }],
    [k('ArrowUp', { metaKey: true }), { kind: 'move', dir: 'up', jump: true, extend: false }],
    [
      k('ArrowRight', { ctrlKey: true, shiftKey: true }),
      { kind: 'move', dir: 'right', jump: true, extend: true },
    ],
    [k('Tab'), { kind: 'tab', back: false }],
    [k('Tab', { shiftKey: true }), { kind: 'tab', back: true }],
    [k('Enter'), { kind: 'enter', back: false }],
    [k('Enter', { shiftKey: true }), { kind: 'enter', back: true }],
    [k('F2'), { kind: 'edit' }],
    // data-validation.md "Using a dropdown": Alt+Down opens the active cell's dropdown.
    [k('ArrowDown', { altKey: true }), { kind: 'dropdown' }],
    [k('Home'), { kind: 'home', toSheet: false }],
    [k('End', { ctrlKey: true }), { kind: 'end', toSheet: true }],
    [k('PageUp'), { kind: 'page', up: true }],
    [k('PageDown'), { kind: 'page', up: false }],
    [k('a', { metaKey: true }), { kind: 'selectAll' }],
    [k(' ', { shiftKey: true }), { kind: 'selectRow' }],
    [k(' ', { ctrlKey: true }), { kind: 'selectCol' }],
    [k('Delete'), { kind: 'clear' }],
    [k('Backspace'), { kind: 'clear' }],
    [k('b', { metaKey: true }), { kind: 'toggle', flag: 'b' }],
    [k('i', { ctrlKey: true }), { kind: 'toggle', flag: 'i' }],
    [k('u', { ctrlKey: true }), { kind: 'toggle', flag: 'u' }],
    [k('X', { ctrlKey: true, shiftKey: true }), { kind: 'toggle', flag: 'st' }],
    [k(';', { ctrlKey: true }), { kind: 'now', what: 'date' }],
    [k(':', { ctrlKey: true, shiftKey: true }), { kind: 'now', what: 'time' }],
    [k('f', { metaKey: true }), { kind: 'find', replace: false }],
    [k('h', { ctrlKey: true }), { kind: 'find', replace: true }],
    [k('H', { metaKey: true, shiftKey: true }), { kind: 'find', replace: true }],
    [k('d', { ctrlKey: true }), { kind: 'fill', dir: 'down' }],
    [k('r', { metaKey: true }), { kind: 'fill', dir: 'right' }],
    [
      k('!', { ctrlKey: true, shiftKey: true, code: 'Digit1' }),
      { kind: 'numberFormat', nf: 'number' },
    ],
    [
      k('$', { ctrlKey: true, shiftKey: true, code: 'Digit4' }),
      { kind: 'numberFormat', nf: 'currency' },
    ],
    [
      k('%', { ctrlKey: true, shiftKey: true, code: 'Digit5' }),
      { kind: 'numberFormat', nf: 'percent' },
    ],
    [k('Escape'), { kind: 'escape' }],
    [k('ContextMenu'), { kind: 'menu' }],
    [k('F10', { shiftKey: true }), { kind: 'menu' }],
    [k('x'), { kind: 'type', text: 'x' }],
    [k('='), { kind: 'type', text: '=' }],
  ])('%j', (e, cmd) => {
    expect(sheetKey(e)).toEqual(cmd);
  });
  it('leaves undo, redo and copy to others', () => {
    expect(sheetKey(k('z', { metaKey: true }))).toBeNull();
    expect(sheetKey(k('y', { ctrlKey: true }))).toBeNull();
    expect(sheetKey(k('c', { ctrlKey: true }))).toBeNull();
    expect(sheetKey(k('Backspace', { metaKey: true }))).toBeNull();
    expect(sheetKey(k('Shift'))).toBeNull();
    expect(sheetKey(k('x', { altKey: true }))).toBeNull();
  });

  it('types a character composed with Alt, and still not a bare Alt+letter', () => {
    // A Mac's Option: ⌥3 is £ on a UK layout, ⌥⇧2 is €, ⌥e then a vowel is é. They were dropped as shortcuts.
    expect(sheetKey(k('£', { altKey: true, code: 'Digit3' }))).toEqual({ kind: 'type', text: '£' });
    expect(sheetKey(k('€', { altKey: true, shiftKey: true, code: 'Digit2' }))).toEqual({
      kind: 'type',
      text: '€',
    });
    // AltGr on Windows comes as Ctrl+Alt: € is AltGr+E and @ is AltGr+Q on a German layout.
    const altGr = {
      ctrlKey: true,
      altKey: true,
      getModifierState: (m: 'AltGraph') => m === 'AltGraph',
    };
    expect(sheetKey(k('€', { ...altGr, code: 'KeyE' }))).toEqual({ kind: 'type', text: '€' });
    expect(sheetKey(k('@', { ...altGr, code: 'KeyQ' }))).toEqual({ kind: 'type', text: '@' });
    // AltGr's Ctrl is not a Ctrl: AltGr+B types (a { on some layouts), it does not bold.
    expect(sheetKey(k('{', { ...altGr, code: 'KeyB' }))).toEqual({ kind: 'type', text: '{' });
    // A bare Alt+letter or Alt+digit keeps its own character: a chord, not typing.
    expect(sheetKey(k('d', { altKey: true, code: 'KeyD' }))).toBeNull();
    expect(sheetKey(k('3', { altKey: true, code: 'Digit3' }))).toBeNull();
  });
});
