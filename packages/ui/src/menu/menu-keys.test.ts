import { describe, expect, it } from 'vitest';
import {
  initialIndex,
  menuKeyIntent,
  moveIndex,
  typeaheadIndex,
  typeaheadQuery,
  type MenuKeyEvent,
} from './menu-keys';
import { MENU_TYPEAHEAD_RESET_MS } from './menu-constants';

const key = (k: string, mods: Partial<MenuKeyEvent> = {}): MenuKeyEvent => ({
  key: k,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});
const root = { inSubmenu: false, onSubmenuTrigger: false };

describe('menuKeyIntent', () => {
  it('maps the arrows, Home and End to moves', () => {
    expect(menuKeyIntent(key('ArrowDown'), root)).toEqual({ kind: 'move', to: 'next' });
    expect(menuKeyIntent(key('ArrowUp'), root)).toEqual({ kind: 'move', to: 'previous' });
    expect(menuKeyIntent(key('Home'), root)).toEqual({ kind: 'move', to: 'first' });
    expect(menuKeyIntent(key('End'), root)).toEqual({ kind: 'move', to: 'last' });
  });

  it('activates on Enter and Space', () => {
    expect(menuKeyIntent(key('Enter'), root)).toEqual({ kind: 'activate' });
    expect(menuKeyIntent(key(' '), root)).toEqual({ kind: 'activate' });
  });

  it('opens a submenu with Right Arrow only on its trigger', () => {
    expect(menuKeyIntent(key('ArrowRight'), { ...root, onSubmenuTrigger: true })).toEqual({
      kind: 'enter-submenu',
    });
    expect(menuKeyIntent(key('ArrowRight'), root)).toBeNull();
  });

  it('leaves a submenu with Left Arrow, and ignores it at the root', () => {
    expect(menuKeyIntent(key('ArrowLeft'), { ...root, inSubmenu: true })).toEqual({
      kind: 'leave-submenu',
    });
    expect(menuKeyIntent(key('ArrowLeft'), root)).toBeNull();
  });

  it('closes on Escape and hands Tab on with its direction', () => {
    expect(menuKeyIntent(key('Escape'), root)).toEqual({ kind: 'close' });
    expect(menuKeyIntent(key('Tab'), root)).toEqual({ kind: 'tab', backwards: false });
    expect(menuKeyIntent(key('Tab', { shiftKey: true }), root)).toEqual({
      kind: 'tab',
      backwards: true,
    });
  });

  it('types a printable character, lower-cased, Shift allowed', () => {
    expect(menuKeyIntent(key('r'), root)).toEqual({ kind: 'type', char: 'r' });
    expect(menuKeyIntent(key('R', { shiftKey: true }), root)).toEqual({ kind: 'type', char: 'r' });
    expect(menuKeyIntent(key('4'), root)).toEqual({ kind: 'type', char: '4' });
  });

  it('leaves modified keys and unknown keys to the browser', () => {
    expect(menuKeyIntent(key('c', { ctrlKey: true }), root)).toBeNull();
    expect(menuKeyIntent(key('ArrowDown', { metaKey: true }), root)).toBeNull();
    expect(menuKeyIntent(key('ArrowDown', { altKey: true }), root)).toBeNull();
    expect(menuKeyIntent(key('F5'), root)).toBeNull();
    expect(menuKeyIntent(key('Shift', { shiftKey: true }), root)).toBeNull();
  });
});

describe('moveIndex', () => {
  it('steps and wraps both ways', () => {
    expect(moveIndex(0, 3, 'next')).toBe(1);
    expect(moveIndex(2, 3, 'next')).toBe(0);
    expect(moveIndex(0, 3, 'previous')).toBe(2);
    expect(moveIndex(1, 3, 'first')).toBe(0);
    expect(moveIndex(0, 3, 'last')).toBe(2);
  });

  it('enters from nowhere at the near end', () => {
    expect(moveIndex(-1, 3, 'next')).toBe(0);
    expect(moveIndex(-1, 3, 'previous')).toBe(2);
  });

  it('has nowhere to go in an empty menu', () => {
    expect(moveIndex(0, 0, 'next')).toBe(-1);
  });
});

describe('typeaheadQuery', () => {
  it('builds within the reset window and restarts after it', () => {
    const first = typeaheadQuery({ query: '', at: 0 }, 'n', 1000);
    expect(first).toEqual({ query: 'n', at: 1000 });
    const second = typeaheadQuery(first, 'e', 1000 + MENU_TYPEAHEAD_RESET_MS - 1);
    expect(second.query).toBe('ne');
    const later = typeaheadQuery(second, 'd', second.at + MENU_TYPEAHEAD_RESET_MS);
    expect(later.query).toBe('d');
  });
});

describe('typeaheadIndex', () => {
  const labels = ['Rename', 'New Subfolder', 'Change Folder', 'Delete', 'Duplicate'];

  it('finds the next label starting with the query, from after the current item', () => {
    expect(typeaheadIndex(labels, 0, 'd')).toBe(3);
    expect(typeaheadIndex(labels, 3, 'du')).toBe(4);
    expect(typeaheadIndex(labels, 4, 'ch')).toBe(2);
  });

  it('cycles items sharing a first letter when that letter repeats', () => {
    expect(typeaheadIndex(labels, 3, 'dd')).toBe(4);
    expect(typeaheadIndex(labels, 4, 'ddd')).toBe(3);
  });

  it('ignores case and surrounding space', () => {
    expect(typeaheadIndex(['  Open', 'share'], 1, 'o')).toBe(0);
    expect(typeaheadIndex(['Open', 'Share'], 0, 's')).toBe(1);
  });

  it('answers -1 when nothing matches', () => {
    expect(typeaheadIndex(labels, 0, 'z')).toBe(-1);
    expect(typeaheadIndex([], -1, 'a')).toBe(-1);
  });
});

describe('initialIndex', () => {
  it('lands on the checked entry, else the first', () => {
    expect(initialIndex([false, true, false], 'checked')).toBe(1);
    expect(initialIndex([false, false], 'checked')).toBe(0);
  });

  it('honours first, last and none', () => {
    expect(initialIndex([false, true], 'first')).toBe(0);
    expect(initialIndex([false, true, false], 'last')).toBe(2);
    expect(initialIndex([true], 'none')).toBe(-1);
  });

  it('is -1 for an empty menu', () => {
    expect(initialIndex([], 'checked')).toBe(-1);
  });
});
