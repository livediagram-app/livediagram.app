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
});
