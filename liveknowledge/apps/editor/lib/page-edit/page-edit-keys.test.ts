// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { pageEditKeyAction } from './page-edit-keys';

// docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX" "Keys".

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    target: document.body,
    ...extra,
  }) as KeyboardEvent;
const reading = { editing: false, mayEdit: true };
const editing = { editing: true, mayEdit: true };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the edit keys', () => {
  it('E edits while reading, never in a field, with a modifier, held, or over a dialog', () => {
    expect(pageEditKeyAction(key('e'), reading)).toBe('edit');
    expect(pageEditKeyAction(key('E'), reading)).toBe('edit');
    expect(pageEditKeyAction(key('e'), editing)).toBeNull();
    expect(pageEditKeyAction(key('e', { metaKey: true }), reading)).toBeNull();
    expect(pageEditKeyAction(key('e', { repeat: true }), reading)).toBeNull();
    const input = document.createElement('input');
    document.body.append(input);
    expect(pageEditKeyAction(key('e', { target: input }), reading)).toBeNull();
    const writing = document.createElement('div');
    writing.setAttribute('contenteditable', 'true');
    document.body.append(writing);
    expect(pageEditKeyAction(key('e', { target: writing }), reading)).toBeNull();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    expect(pageEditKeyAction(key('e'), reading)).toBeNull();
  });

  it('Mod-S saves while editing, with either modifier, and not while reading', () => {
    expect(pageEditKeyAction(key('s', { metaKey: true }), editing)).toBe('save');
    expect(pageEditKeyAction(key('S', { ctrlKey: true }), editing)).toBe('save');
    expect(pageEditKeyAction(key('s', { ctrlKey: true, shiftKey: true }), editing)).toBeNull();
    expect(pageEditKeyAction(key('s', { metaKey: true }), reading)).toBeNull();
    expect(pageEditKeyAction(key('s'), editing)).toBeNull();
  });

  it('Escape cancels while editing unless a menu or dialog has it', () => {
    expect(pageEditKeyAction(key('Escape'), editing)).toBe('cancel');
    expect(pageEditKeyAction(key('Escape'), reading)).toBeNull();
    expect(pageEditKeyAction(key('Escape', { defaultPrevented: true }), editing)).toBeNull();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    expect(pageEditKeyAction(key('Escape'), editing)).toBeNull();
    menu.remove();
  });

  it("Escape is the drawing palette flyout's while it is open", () => {
    const tile = document.createElement('button');
    tile.setAttribute('data-flyout-item', '');
    document.body.append(tile);
    expect(pageEditKeyAction(key('Escape'), editing)).toBeNull();
    tile.remove();
    expect(pageEditKeyAction(key('Escape'), editing)).toBe('cancel');
  });

  it('does nothing for someone who may not edit, or with no target', () => {
    expect(pageEditKeyAction(key('e'), { editing: false, mayEdit: false })).toBeNull();
    expect(pageEditKeyAction(key('e', { target: null }), reading)).toBe('edit');
  });
});
