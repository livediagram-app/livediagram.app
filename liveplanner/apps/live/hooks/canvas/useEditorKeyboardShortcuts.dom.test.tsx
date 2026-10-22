// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import { modalClosed, modalOpened } from '@/lib/modal-guard';
import type { EditorKeyboardShortcutsDeps } from './editor-shortcut-keys';

// The listener itself, in a DOM: Delete AND Backspace delete the selection
// (docs/specs/008-canvas/canvas-and-palette.md#selection-popover), and every key the editor acts on
// is counted once for the power user mode offer (docs/specs/007-editor/power-user-mode.md).

// A case states the selection as values; the hook reads it through readSelection.
type Overrides = Partial<EditorKeyboardShortcutsDeps> & {
  selectedId?: string | null;
  multiSelectedIds?: ReadonlySet<string>;
};

function deps(overrides: Overrides = {}) {
  const spies = {
    deleteSelected: vi.fn(),
    deleteMultiSelected: vi.fn(),
    onShortcutUsed: vi.fn(),
    setCanvasTool: vi.fn(),
  };
  const target: Record<string, unknown> = {
    formatSourceId: null,
    pendingDraw: null,
    selectedId: 'a',
    multiSelectedIds: new Set<string>(),
    editingId: null,
    isReadOnly: false,
    participant: false,
    canvasTool: 'select',
    enabled: true,
    zenMode: false,
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

  // docs/specs/013-workspace/share-roles.md: a Participant deletes; the commit guard decides what goes.
  it("reach a Participant's delete", () => {
    const participant = deps({ isReadOnly: true, participant: true });
    renderHook(() => useEditorKeyboardShortcuts(participant.bag));
    press('Delete');
    expect(participant.spies.deleteSelected).toHaveBeenCalled();
  });
});

// A Viewer's or Participant's canvas chord is the canvas's even when it may not run it (share-roles.md): the browser's
// select-all highlighted the whole page and Cmd+D opened the bookmark dialog.
describe('a canvas chord a role may not run', () => {
  it.each([{ participant: true }, { participant: false }])(
    'is swallowed, not left to the browser (%o)',
    ({ participant }) => {
      const { bag } = deps({ isReadOnly: true, participant });
      renderHook(() => useEditorKeyboardShortcuts(bag));
      expect(press('a', { metaKey: true }).defaultPrevented).toBe(true);
      expect(press('d', { metaKey: true }).defaultPrevented).toBe(true);
      // Copy stays the browser's: a Viewer copies text off the page.
      expect(press('c', { metaKey: true }).defaultPrevented).toBe(false);
    },
  );
});

// docs/specs/013-workspace/share-roles.md "The Participant palette": each tile works as an Editor's does, its key too.
describe('plain letter and digit keys', () => {
  it('add nothing for any role: the canvas tool and element-add keys went with the palette', () => {
    for (const role of [
      { isReadOnly: false, participant: false },
      { isReadOnly: true, participant: true },
      { isReadOnly: true, participant: false },
    ]) {
      const addSticky = vi.fn();
      const addText = vi.fn();
      const addShape = vi.fn();
      const { bag } = deps({ selectedId: null, ...role, addSticky, addText, addShape });
      const { unmount } = renderHook(() => useEditorKeyboardShortcuts(bag));
      for (const key of ['n', 't', 'r', '2', 'v', 'h', 'i'])
        expect(press(key).defaultPrevented, key).toBe(false);
      expect(addSticky).not.toHaveBeenCalled();
      expect(addText).not.toHaveBeenCalled();
      expect(addShape).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe('onShortcutUsed', () => {
  it('counts a key the editor acted on, once', () => {
    const { bag, spies } = deps();
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    press('z');
    expect(spies.onShortcutUsed).toHaveBeenCalledTimes(2);
  });

  it('does not count a key nothing acted on, or one already claimed', () => {
    const { bag, spies } = deps({ selectedId: null });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    const claimed = new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true });
    claimed.preventDefault();
    window.dispatchEvent(claimed);
    expect(spies.onShortcutUsed).not.toHaveBeenCalled();
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
    expect(spies.onShortcutUsed).not.toHaveBeenCalled();
    menu.remove();
  });
});

// docs/specs/026-plan/plan-board.md "Maximised board": a board covering the canvas leaves nothing on it to change
// from the keyboard.
describe('a covered canvas', () => {
  it('nudges, deletes, selects all, duplicates and picks no tool', () => {
    const onNudgeSelection = vi.fn();
    const onSelectAll = vi.fn();
    const onDuplicate = vi.fn();
    const { bag, spies } = deps({
      canvasCovered: () => true,
      onNudgeSelection,
      onSelectAll,
      onDuplicate,
    });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    for (const key of ['ArrowLeft', 'ArrowDown', 'Delete', 'Backspace', 'r', 'v']) press(key);
    press('a', { metaKey: true });
    press('d', { metaKey: true });
    expect(onNudgeSelection).not.toHaveBeenCalled();
    expect(onSelectAll).not.toHaveBeenCalled();
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(spies.deleteSelected).not.toHaveBeenCalled();
    expect(spies.setCanvasTool).not.toHaveBeenCalled();
  });

  it('still undoes, redoes, searches and toggles zen, and keeps the browser off canvas chords', () => {
    const spies = {
      undo: vi.fn(),
      redo: vi.fn(),
      onOpenSearch: vi.fn(),
      onToggleZen: vi.fn(),
      onDuplicate: vi.fn(),
      onSelectAll: vi.fn(),
      copySelection: vi.fn(),
    };
    const { bag } = deps({ canvasCovered: () => true, ...spies });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('z', { metaKey: true });
    press('z', { metaKey: true, shiftKey: true });
    press('y', { ctrlKey: true });
    press('k', { metaKey: true });
    press('z');
    expect(spies.undo).toHaveBeenCalledTimes(1);
    expect(spies.redo).toHaveBeenCalledTimes(2);
    expect(spies.onOpenSearch).toHaveBeenCalledTimes(1);
    expect(spies.onToggleZen).toHaveBeenCalledTimes(1);
    // Duplicate and select-all are prevented (no bookmark, no page select) and do nothing.
    expect(press('d', { metaKey: true }).defaultPrevented).toBe(true);
    expect(press('a', { metaKey: true }).defaultPrevented).toBe(true);
    expect(spies.onDuplicate).not.toHaveBeenCalled();
    expect(spies.onSelectAll).not.toHaveBeenCalled();
    // Copy is left to the browser (text on the board), never the canvas's element copy.
    expect(press('c', { metaKey: true }).defaultPrevented).toBe(false);
    expect(spies.copySelection).not.toHaveBeenCalled();
  });

  it('leaves Cmd+C to the browser while text on the page is highlighted', () => {
    const copySelection = vi.fn();
    const { bag } = deps({ canvasCovered: () => false, copySelection });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    const p = document.createElement('p');
    p.textContent = 'https://liveplanner.app/s/abc';
    document.body.appendChild(p);
    window.getSelection()!.selectAllChildren(p);
    expect(press('c', { metaKey: true }).defaultPrevented).toBe(false);
    expect(copySelection).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
    expect(press('c', { metaKey: true }).defaultPrevented).toBe(true);
    expect(copySelection).toHaveBeenCalledOnce();
    p.remove();
  });

  it('acts again once nothing covers it', () => {
    const onNudgeSelection = vi.fn();
    const { bag } = deps({ canvasCovered: () => false, onNudgeSelection });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('ArrowLeft');
    expect(onNudgeSelection).toHaveBeenCalled();
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

describe('Escape on a just-grown mind node (docs/specs/009-elements/mind-node.md)', () => {
  it('drops the empty node instead of deselecting', () => {
    const onEscapeMindNode = vi.fn(() => true);
    const onDeselect = vi.fn();
    const { bag } = deps({ onEscapeMindNode, onDeselect });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(onEscapeMindNode).toHaveBeenCalledWith('a');
    expect(onDeselect).not.toHaveBeenCalled();
  });

  it('deselects as usual when the node is not one to drop', () => {
    const onDeselect = vi.fn();
    const { bag } = deps({ onDeselect });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Escape');
    expect(onDeselect).toHaveBeenCalledTimes(1);
  });

  it('leaves an open label editor its own Escape', () => {
    const onEscapeMindNode = vi.fn(() => true);
    const { bag } = deps({ onEscapeMindNode, editingId: 'a' });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Escape');
    expect(onEscapeMindNode).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/start-panel.md "Undo and redo reach the editor through an empty search".
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
