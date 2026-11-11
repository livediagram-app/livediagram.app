// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import { modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';
import type { EditorKeyboardShortcutsDeps } from './editor-shortcut-keys';

// The listener itself, in a DOM: Delete AND Backspace delete the selection
// (docs/specs/008-canvas/canvas-and-palette.md#selection-popover).

// A case states the selection as values; the hook reads it through readSelection.
type Overrides = Partial<EditorKeyboardShortcutsDeps> & {
  selectedId?: string | null;
  multiSelectedIds?: ReadonlySet<string>;
};

function deps(overrides: Overrides = {}) {
  const spies = {
    deleteSelected: vi.fn(),
    deleteMultiSelected: vi.fn(),
    setCanvasTool: vi.fn(),
    undo: vi.fn(),
  };
  const target: Record<string, unknown> = {
    formatSourceId: null,
    pendingDraw: null,
    selectedId: 'a',
    multiSelectedIds: new Set<string>(),
    editingId: null,
    isReadOnly: false,
    canvasTool: 'select',
    enabled: true,
    canGrowMindNode: () => false,
    onEscapeMindNode: () => false,
    // An ordinary diagram tab unless a test says otherwise.
    ...spies,
    ...overrides,
  };
  // The hook reads the selection when a key is pressed (docs/specs/008-canvas/blueprints/selection-store.md).
  target.readSelection = () => ({
    selectedId: target.selectedId,
    multiSelectedIds: target.multiSelectedIds,
  });
  const base = new Proxy(
    target,
    // Every other callback in the bag is a harmless no-op.
    { get: (t, k: string) => (k in t ? t[k] : () => {}) },
  );
  return { bag: base as unknown as EditorKeyboardShortcutsDeps, spies };
}

function press(key: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Delete and Backspace', () => {
  it('both delete the single selection', () => {
    const { bag, spies } = deps();
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    press('Backspace');
    expect(spies.deleteSelected).toHaveBeenCalledTimes(2);
  });

  it('both delete a multi-selection', () => {
    const { bag, spies } = deps({ multiSelectedIds: new Set(['a', 'b']) });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    press('Backspace');
    expect(spies.deleteMultiSelected).toHaveBeenCalledTimes(2);
    expect(spies.deleteSelected).not.toHaveBeenCalled();
  });

  it('leave a view-only session and a text edit alone', () => {
    const readOnly = deps({ isReadOnly: true });
    renderHook(() => useEditorKeyboardShortcuts(readOnly.bag));
    expect(press('Backspace').defaultPrevented).toBe(false);
    expect(readOnly.spies.deleteSelected).not.toHaveBeenCalled();
    cleanup();
    const editing = deps({ editingId: 'a' });
    renderHook(() => useEditorKeyboardShortcuts(editing.bag));
    press('Delete');
    expect(editing.spies.deleteSelected).not.toHaveBeenCalled();
  });
});

// A Viewer's or Participant's canvas chord is the canvas's even when it may not run it (share-roles.md): the browser's
// select-all highlighted the whole page and Cmd+D opened the bookmark dialog. Both are read-only to the keyboard.
describe('a canvas chord a role may not run', () => {
  it('is swallowed, not left to the browser', () => {
    const { bag, spies } = deps({ isReadOnly: true });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('a', { metaKey: true }).defaultPrevented).toBe(true);
    expect(press('d', { metaKey: true }).defaultPrevented).toBe(true);
    // Copy stays the browser's: a Viewer copies text off the page.
    expect(press('c', { metaKey: true }).defaultPrevented).toBe(false);
    // Undo and redo are an Editor's (docs/specs/013-workspace/share-roles.md "A Participant walks").
    press('z', { metaKey: true });
    expect(spies.undo).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/share-roles.md "A Participant walks": a read-only session (a Viewer, a Participant) has no
// add keys at all.
describe('add keys', () => {
  it("are not a read-only session's, a Participant's included", () => {
    const addSticky = vi.fn();
    const addText = vi.fn();
    const { bag } = deps({ selectedId: null, isReadOnly: true, addSticky, addText });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('n').defaultPrevented).toBe(false);
    press('t');
    press('8');
    press('Delete');
    expect(addSticky).not.toHaveBeenCalled();
    expect(addText).not.toHaveBeenCalled();
  });
});

// The Edit | Walk toggle's keys (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): E and V edit, W
// walks, before the read-only gate; H is not a mode.
describe('Edit and Walk keys', () => {
  it('edits with E and V and walks with W', () => {
    const { bag, spies } = deps({ selectedId: null });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('e');
    press('v');
    press('w');
    expect(spies.setCanvasTool.mock.calls.map((c): unknown => c[0])).toEqual([
      'select',
      'select',
      'avatar',
    ]);
  });

  it("are a read-only session's too", () => {
    const { bag, spies } = deps({ selectedId: null, isReadOnly: true });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('w');
    expect(spies.setCanvasTool).toHaveBeenCalledWith('avatar');
  });

  it('binds nothing to H', () => {
    const { bag, spies } = deps({ selectedId: null });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('h').defaultPrevented).toBe(false);
    expect(spies.setCanvasTool).not.toHaveBeenCalled();
  });

  it('leaves W to the Wave while walking, and E still goes back to editing', () => {
    const { bag, spies } = deps({ selectedId: null, canvasTool: 'avatar' });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('w');
    expect(spies.setCanvasTool).not.toHaveBeenCalledWith('avatar');
    press('e');
    expect(spies.setCanvasTool).toHaveBeenCalledWith('select');
  });
});

// docs/specs/004-interface-design/menus.md: while focus is inside a menu of either kind the
// canvas's shortcuts stand down.
describe('inside a menu', () => {
  it('leaves Delete, the arrows and Escape to the menu', () => {
    const { bag, spies } = deps();
    renderHook(() => useEditorKeyboardShortcuts(bag));
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-surface', 'control');
    const row = document.createElement('button');
    menu.append(row);
    document.body.append(menu);
    for (const key of ['Delete', 'Backspace', 'ArrowDown', 'Escape']) {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      row.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(spies.deleteSelected).not.toHaveBeenCalled();
    menu.remove();
  });
});

// Space taps a label edit on the selected shape, unless a dialog is open over the canvas: then Space is
// the dialog's (pressing its toggle), never an edit on the shape behind it.
describe('Space tap', () => {
  const tap = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }),
    );
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  };

  it('edits the selected shape, but not while a dialog is open', () => {
    const onBeginEditSelected = vi.fn();
    const { bag } = deps({ onBeginEditSelected });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    tap();
    expect(onBeginEditSelected).toHaveBeenCalledWith('a');
    onBeginEditSelected.mockClear();
    modalOpened();
    try {
      tap();
    } finally {
      modalClosed();
    }
    expect(onBeginEditSelected).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/start-diagramming.md "Undo and redo reach the editor through an empty search".
describe('undo and redo from the start search', () => {
  function pressIn(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(e);
    return e;
  }
  function searchBox(value: string, optIn = true) {
    const input = document.createElement('input');
    if (optIn) input.dataset.editorHistory = '';
    input.value = value;
    document.body.appendChild(input);
    return input;
  }

  it('hands Cmd+Z, Cmd+Shift+Z and Ctrl+Y on while the search is empty', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useEditorKeyboardShortcuts(deps({ undo, redo }).bag));
    const input = searchBox('');
    expect(pressIn(input, 'z', { metaKey: true }).defaultPrevented).toBe(true);
    pressIn(input, 'z', { metaKey: true, shiftKey: true });
    pressIn(input, 'y', { ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(2);
    input.remove();
  });

  it('leaves them to the box once something is typed, and to any box that has not opted in', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useEditorKeyboardShortcuts(deps({ undo, redo }).bag));
    const typed = searchBox('flow');
    expect(pressIn(typed, 'z', { metaKey: true }).defaultPrevented).toBe(false);
    const other = searchBox('', false);
    pressIn(other, 'z', { metaKey: true, shiftKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    typed.remove();
    other.remove();
  });

  it('keeps every other chord out of the empty search', () => {
    const copySelection = vi.fn();
    renderHook(() => useEditorKeyboardShortcuts(deps({ copySelection }).bag));
    const input = searchBox('');
    pressIn(input, 'c', { metaKey: true });
    expect(copySelection).not.toHaveBeenCalled();
    input.remove();
  });
});

// Enter is the keyboard's tap on an armed tile (docs/specs/008-canvas/canvas-and-palette.md "Adding elements"): a tile
// armed from the keyboard waited for a pointer press, so a keyboard user could not place anything.
describe('Enter with a tile armed', () => {
  it('drops it at the middle of the view and claims the key', () => {
    const onDropDrawAtCentre = vi.fn(() => true);
    const { bag } = deps({
      pendingDraw: { type: 'shape', kind: 'chair' },
      selectedId: null,
      onDropDrawAtCentre,
    });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(onDropDrawAtCentre).toHaveBeenCalledTimes(1);
  });

  it('leaves the key alone for a gesture with no tap', () => {
    const onDropDrawAtCentre = vi.fn(() => false);
    const { bag } = deps({
      pendingDraw: { type: 'freehand' },
      selectedId: null,
      onDropDrawAtCentre,
    });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('Enter').defaultPrevented).toBe(false);
  });

  it('does nothing with nothing armed, on a repeat, with a modifier, or in a text field', () => {
    const onDropDrawAtCentre = vi.fn(() => true);
    const idle = deps({ selectedId: null, onDropDrawAtCentre });
    renderHook(() => useEditorKeyboardShortcuts(idle.bag));
    press('Enter');
    cleanup();
    const armed = deps({ pendingDraw: { type: 'text' }, selectedId: null, onDropDrawAtCentre });
    renderHook(() => useEditorKeyboardShortcuts(armed.bag));
    press('Enter', { repeat: true });
    press('Enter', { shiftKey: true });
    press('Enter', { metaKey: true });
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    input.remove();
    expect(onDropDrawAtCentre).not.toHaveBeenCalled();
  });
});
