// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMask } from '@livedesign/photo-engine';
import { photoPress } from '@/lib/photo-editor/photo-pointer';
import { DEFAULT_OPTIONS, photoTools, TOOL_GROUPS } from '@/lib/photo-editor/tool-state';
import { photoView } from './photo-view-test-utils';
import { matchesKeys, usePhotoShortcuts } from './usePhotoShortcuts';

// docs/specs/031-photo/photo-tools.md "Keyboard summary": the tool letters, the colours, the brush's size
// and hardness, the layer's opacity and the commands' chords.
const press = (key: string, mods: Partial<KeyboardEventInit> = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  window.dispatchEvent(e);
  return e;
};

beforeEach(() => {
  photoTools.set({
    tool: null,
    lastInGroup: Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, g.tools[0]!])),
    options: structuredClone(DEFAULT_OPTIONS),
    foreground: '#000000',
    background: '#ffffff',
  });
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('matchesKeys', () => {
  const e = (
    key: string,
    m: Partial<Record<'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey', boolean>> = {},
  ) => ({
    key,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    ...m,
  });
  it('reads Mod as Ctrl or Cmd, and wants exactly the modifiers written', () => {
    expect(matchesKeys(e('n', { metaKey: true, shiftKey: true }), 'Mod+Shift+N')).toBe(true);
    expect(matchesKeys(e('N', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+N')).toBe(true);
    expect(matchesKeys(e('n', { metaKey: true }), 'Mod+Shift+N')).toBe(false);
    expect(matchesKeys(e('Backspace', { altKey: true }), 'Backspace')).toBe(false);
    expect(matchesKeys(e('Backspace'), 'Backspace')).toBe(true);
  });

  it('knows the bracket keys by their place, whatever Shift or Alt makes them type', () => {
    const at = (key: string, code: string, m = {}) => ({ ...e(key, m), code });
    expect(
      matchesKeys(at('{', 'BracketLeft', { metaKey: true, shiftKey: true }), 'Mod+Shift+['),
    ).toBe(true);
    expect(matchesKeys(at('“', 'BracketLeft', { altKey: true }), 'Alt+[')).toBe(true);
    expect(
      matchesKeys(at('}', 'BracketRight', { metaKey: true, shiftKey: true }), 'Mod+Shift+['),
    ).toBe(false);
  });
});

describe('the photo keys', () => {
  it('take a group’s tool by its letter, the next with Shift, and put it down on Escape', () => {
    const { view } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('b');
    expect(photoTools.get().tool).toBe('brush');
    press('B', { shiftKey: true });
    expect(photoTools.get().tool).toBe('pencil');
    press('b');
    expect(photoTools.get().tool).toBe('pencil');
    press('Escape');
    expect(photoTools.get().tool).toBeNull();
  });

  it('on Escape, clear the selection first and the tool after', () => {
    const { view, s } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('m');
    s.selection = createMask({ x: 0, y: 0, width: 4, height: 4 }, 255);
    press('Escape');
    expect(s.selection).toBeNull();
    expect(photoTools.get().tool).toBe('rect-select');
    press('Escape');
    expect(photoTools.get().tool).toBeNull();
  });

  it('swap and reset the colours, and size and harden the brush', () => {
    const { view } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('x');
    expect(photoTools.get().foreground).toBe('#000000');
    press('b');
    press('x');
    expect(photoTools.get().foreground).toBe('#ffffff');
    press('d');
    expect(photoTools.get().foreground).toBe('#000000');
    const size = photoTools.get().options.brush.size;
    press(']');
    expect(photoTools.get().options.brush.size).toBeGreaterThan(size);
    press('[');
    press('[');
    expect(photoTools.get().options.brush.size).toBeLessThan(size);
    const hard = photoTools.get().options.brush.hardness;
    press('{', { shiftKey: true });
    expect(photoTools.get().options.brush.hardness).toBe(Math.max(0, hard - 0.25));
    press('}', { shiftKey: true });
    expect(photoTools.get().options.brush.hardness).toBe(hard);
  });

  it('set the active layer’s opacity with the number row while a non-painting tool is in hand', () => {
    const { view, s, commits } = photoView();
    s.choose('a', 'layer');
    renderHook(() => usePhotoShortcuts(view));
    press('v');
    press('5');
    expect(s.layer('a')?.opacity).toBe(0.5);
    press('0');
    expect(s.layer('a')?.opacity).toBeUndefined();
    press('b');
    press('3');
    expect(s.layer('a')?.opacity).toBeUndefined();
    expect(commits.map((c) => c.label)).toEqual(['Opacity', 'Opacity']);
  });

  it('run a command’s chord while a photo tool is in hand, and leave it to the canvas otherwise', () => {
    const { view, s } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    const before = s.photo.layers.length;
    const ignored = press('N', { metaKey: true, shiftKey: true });
    expect(ignored.defaultPrevented).toBe(false);
    expect(s.photo.layers.length).toBe(before);
    press('v');
    const taken = press('N', { metaKey: true, shiftKey: true });
    expect(taken.defaultPrevented).toBe(true);
    expect(s.photo.layers.length).toBe(before + 1);
  });

  it('take a Mac’s delete key (Backspace) as Delete: the layer goes with no selection, never a fill', () => {
    const { view, s, toasts } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    photoTools.take('move');
    s.choose('a', 'layer');
    expect(press('Backspace').defaultPrevented).toBe(true);
    expect(s.photo.layers.map((l) => l.id)).toEqual(['bg']);
    // The last layer stays, said.
    press('Backspace');
    expect(s.photo.layers.map((l) => l.id)).toEqual(['bg']);
    expect(toasts).toContain('A photo keeps at least one layer: add another first.');
  });

  it('start no command and no other tool while a press is under way, held modifiers still passing', () => {
    const { view, s } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('v');
    const before = s.photo.layers.length;
    photoPress.set(true);
    try {
      expect(press('N', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
      expect(s.photo.layers.length).toBe(before);
      press('b');
      expect(photoTools.get().tool).toBe('move');
      expect(press('Alt', { altKey: true }).defaultPrevented).toBe(false);
    } finally {
      photoPress.set(false);
    }
    press('N', { metaKey: true, shiftKey: true });
    expect(s.photo.layers.length).toBe(before + 1);
  });

  it('leave every key to an open menu, focused or not, so Escape closes it and nothing else', () => {
    const { view } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('v');
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    press('Escape');
    press('b');
    expect(photoTools.get().tool).toBe('move');
    menu.remove();
    press('b');
    expect(photoTools.get().tool).toBe('brush');
  });

  it('leave Escape to a popover or dialog that has the focus', () => {
    const { view } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    press('g');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);
    button.focus();
    press('Escape');
    expect(photoTools.get().tool).toBe('gradient');
    button.blur();
    press('Escape');
    expect(photoTools.get().tool).toBeNull();
  });

  it('stand down while someone is typing, after another handler took the key, and with no photo', () => {
    const { view } = photoView();
    const { unmount } = renderHook(() => usePhotoShortcuts(view));
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    press('b');
    expect(photoTools.get().tool).toBeNull();
    input.blur();
    const e = new KeyboardEvent('keydown', { key: 'b', cancelable: true });
    e.preventDefault();
    window.dispatchEvent(e);
    expect(photoTools.get().tool).toBeNull();
    unmount();
    renderHook(() => usePhotoShortcuts(null));
    press('b');
    expect(photoTools.get().tool).toBeNull();
  });
});

describe('with a Layers row focused', () => {
  it('leaves the list its own keys, and still takes a tool’s letter', () => {
    const { view } = photoView();
    renderHook(() => usePhotoShortcuts(view));
    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Layers');
    const row = document.createElement('div');
    row.tabIndex = 0;
    list.append(row);
    document.body.append(list);
    row.focus();
    photoTools.take('move');
    const del = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    row.dispatchEvent(del);
    expect(del.defaultPrevented).toBe(false);
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
    expect(photoTools.get().tool).toBe('rect-select');
  });
});
