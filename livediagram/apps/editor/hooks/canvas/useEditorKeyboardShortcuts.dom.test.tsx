// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import { modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';
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
    whiteboard: null,
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
describe("a Participant's palette keys", () => {
  it('add what its tiles add, and nothing an Editor alone adds', () => {
    const addSticky = vi.fn();
    const addText = vi.fn();
    const addShape = vi.fn();
    const { bag } = deps({
      selectedId: null,
      isReadOnly: true,
      participant: true,
      addSticky,
      addText,
      addShape,
    });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('n').defaultPrevented).toBe(true);
    press('t');
    press('r');
    expect(addSticky).toHaveBeenCalledTimes(1);
    expect(addText).toHaveBeenCalledTimes(1);
    expect(addShape).not.toHaveBeenCalled();
  });

  it("work on a Draw tab too, where the dock keys are an Editor's", () => {
    const addSticky = vi.fn();
    const addText = vi.fn();
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
      pickFill: vi.fn(),
      openShapes: vi.fn(),
    };
    const { bag } = deps({
      selectedId: null,
      isReadOnly: true,
      participant: true,
      whiteboard: wb,
      addSticky,
      addText,
    });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('n').defaultPrevented).toBe(true);
    press('t');
    press('1');
    expect(addSticky).toHaveBeenCalledTimes(1);
    expect(addText).toHaveBeenCalledTimes(1);
    expect(wb.pickPen).not.toHaveBeenCalled();
    expect(wb.pickSticky).not.toHaveBeenCalled();
  });

  it("are not a Viewer's", () => {
    const addSticky = vi.fn();
    const { bag } = deps({ selectedId: null, isReadOnly: true, addSticky });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('n').defaultPrevented).toBe(false);
    expect(addSticky).not.toHaveBeenCalled();
  });
});

describe('onShortcutUsed', () => {
  it('counts a key the editor acted on, once', () => {
    const { bag, spies } = deps();
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    press('v');
    expect(spies.onShortcutUsed).toHaveBeenCalledTimes(2);
  });

  it('does not count a key nothing acted on, or one already claimed', () => {
    const { bag, spies } = deps({ selectedId: null });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Delete');
    const claimed = new KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true });
    claimed.preventDefault();
    window.dispatchEvent(claimed);
    expect(spies.onShortcutUsed).not.toHaveBeenCalled();
  });
});

describe('whiteboard keys (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts")', () => {
  const board = () => {
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
      pickFill: vi.fn(),
      openShapes: vi.fn(),
    };
    const addShape = vi.fn();
    const setCanvasTool = vi.fn();
    const { bag } = deps({ selectedId: null, whiteboard: wb, addShape, setCanvasTool });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    return { wb, addShape, setCanvasTool };
  };

  it('picks the dock tools with V, 1, 2, 3 and E', () => {
    const { wb } = board();
    press('v');
    press('1');
    press('2');
    press('3');
    press('e');
    expect(wb.pickSelect).toHaveBeenCalledTimes(1);
    expect(wb.pickPen.mock.calls.map((c): unknown => c[0])).toEqual(['main', 'second', 'third']);
    expect(wb.pickEraser).toHaveBeenCalledTimes(1);
  });

  it('adds notes, text and the dock shapes with N, T, R, O, D, C, L and A', () => {
    const { wb, addShape } = board();
    press('n');
    press('t');
    for (const k of ['r', 'o', 'd', 'c', 'l', 'a']) press(k);
    expect(wb.pickSticky).toHaveBeenCalledTimes(1);
    expect(wb.pickText).toHaveBeenCalledTimes(1);
    expect(wb.pickShape.mock.calls.map((c): unknown => c[0])).toEqual([
      'rectangle',
      'ellipse',
      'diamond',
      'cylinder',
      'line',
      'arrow',
    ]);
    // The diagram tab's own shape adds never run on a whiteboard.
    expect(addShape).not.toHaveBeenCalled();
  });

  it('opens the Shapes flyout with S', () => {
    const { wb, addShape } = board();
    press('s');
    expect(wb.openShapes).toHaveBeenCalledTimes(1);
    expect(addShape).not.toHaveBeenCalled();
  });

  it('picks up the Fill tool with F, never the Frame', () => {
    const { wb, addShape } = board();
    press('f');
    expect(wb.pickFill).toHaveBeenCalledTimes(1);
    expect(addShape).not.toHaveBeenCalled();
  });

  it('picks up the Path tool with P, never the pencil', () => {
    const { wb } = board();
    press('p');
    expect(wb.pickPath).toHaveBeenCalledTimes(1);
  });

  it('leaves the other diagram tab keys out: no laser on K, no parallelogram on G', () => {
    const { wb, addShape, setCanvasTool } = board();
    press('k');
    press('g');
    expect(addShape).not.toHaveBeenCalled();
    expect(wb.pickShape).not.toHaveBeenCalled();
    expect(setCanvasTool).not.toHaveBeenCalledWith('laser');
  });

  it('puts the eraser down before clearing a selection', () => {
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
      pickFill: vi.fn(),
      openShapes: vi.fn(),
    };
    const onDeselect = vi.fn();
    const { bag } = deps({ selectedId: 'a', whiteboard: wb, canvasTool: 'eraser', onDeselect });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Escape');
    expect(wb.pickSelect).toHaveBeenCalledTimes(1);
    expect(onDeselect).not.toHaveBeenCalled();
  });

  it('puts the eraser down with Escape', () => {
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
      pickFill: vi.fn(),
      openShapes: vi.fn(),
    };
    const { bag } = deps({ selectedId: null, whiteboard: wb, canvasTool: 'eraser' });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('Escape');
    expect(wb.pickSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps hand on H', () => {
    const { setCanvasTool } = board();
    press('h');
    expect(setCanvasTool).toHaveBeenCalledWith('pan');
  });

  it('gives a view-role visitor V only', () => {
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
      pickFill: vi.fn(),
      openShapes: vi.fn(),
    };
    const { bag } = deps({ selectedId: null, whiteboard: wb, isReadOnly: true });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('1');
    press('e');
    press('v');
    expect(wb.pickPen).not.toHaveBeenCalled();
    expect(wb.pickEraser).not.toHaveBeenCalled();
    expect(wb.pickSelect).toHaveBeenCalledTimes(1);
  });
});

// Shift+D moves to the next editor mode (docs/specs/007-editor/editor-modes.md "The mode switch").
describe('Shift+D', () => {
  it('cycles the editor mode where a switch is offered', () => {
    const onCycleEditorMode = vi.fn();
    const { bag, spies } = deps({ selectedId: null, onCycleEditorMode });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    const e = press('D', { shiftKey: true });
    expect(onCycleEditorMode).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    expect(spies.onShortcutUsed).toHaveBeenCalledTimes(1);
  });

  it('does nothing where no switch is offered, and adds no diamond', () => {
    const addShape = vi.fn();
    const { bag } = deps({ selectedId: null, onCycleEditorMode: null, addShape });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    const e = press('D', { shiftKey: true });
    expect(e.defaultPrevented).toBe(false);
    expect(addShape).not.toHaveBeenCalled();
  });

  it('still reaches Draw mode, whose dock owns the plain keys', () => {
    const onCycleEditorMode = vi.fn();
    const { bag } = deps({ selectedId: null, onCycleEditorMode, whiteboard: {} as never });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('D', { shiftKey: true });
    expect(onCycleEditorMode).toHaveBeenCalledTimes(1);
  });

  it('yields to type-to-edit on a selected labelled element', () => {
    const onCycleEditorMode = vi.fn();
    const onTypeIntoSelected = vi.fn(() => true);
    const { bag } = deps({ onCycleEditorMode, onTypeIntoSelected });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('D', { shiftKey: true });
    expect(onTypeIntoSelected).toHaveBeenCalledWith('a', 'D');
    expect(onCycleEditorMode).not.toHaveBeenCalled();
  });

  it('obeys the shortcuts switch', () => {
    const onCycleEditorMode = vi.fn();
    const { bag } = deps({ selectedId: null, onCycleEditorMode, enabled: false });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('D', { shiftKey: true });
    expect(onCycleEditorMode).not.toHaveBeenCalled();
  });

  it('leaves a modified D (duplicate) alone', () => {
    const onCycleEditorMode = vi.fn();
    const { bag } = deps({ selectedId: null, onCycleEditorMode });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('D', { shiftKey: true, metaKey: true });
    press('D', { shiftKey: true, altKey: true });
    expect(onCycleEditorMode).not.toHaveBeenCalled();
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
      pendingDraw: { type: 'shape', kind: 'circle' },
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

describe('vote keys (docs/specs/012-collaboration/blueprints/vote-keys.md)', () => {
  it('hands + and - on the one selected element to the vote, ahead of type-to-edit', () => {
    const onVoteKey = vi.fn(() => true);
    const onTypeIntoSelected = vi.fn(() => true);
    const { bag, spies } = deps({ onVoteKey, onTypeIntoSelected });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    expect(press('+').defaultPrevented).toBe(true);
    press('=');
    press('-');
    expect(onVoteKey.mock.calls).toEqual([
      ['a', 1],
      ['a', 1],
      ['a', -1],
    ]);
    expect(onTypeIntoSelected).not.toHaveBeenCalled();
    expect(spies.onShortcutUsed).toHaveBeenCalledTimes(3);
  });

  it('leaves a key the vote did not take to type-to-edit', () => {
    const onVoteKey = vi.fn(() => false);
    const onTypeIntoSelected = vi.fn(() => true);
    const { bag } = deps({ onVoteKey, onTypeIntoSelected });
    renderHook(() => useEditorKeyboardShortcuts(bag));
    press('-');
    expect(onVoteKey).toHaveBeenCalledWith('a', -1);
    expect(onTypeIntoSelected).toHaveBeenCalledWith('a', '-');
  });

  it('never asks the vote with several selected, nothing selected, a chord, or no vote key (a Viewer)', () => {
    const onVoteKey = vi.fn(() => true);
    const multi = deps({ onVoteKey, multiSelectedIds: new Set(['a', 'b']) });
    renderHook(() => useEditorKeyboardShortcuts(multi.bag));
    press('+');
    cleanup();
    const none = deps({ onVoteKey, selectedId: null });
    renderHook(() => useEditorKeyboardShortcuts(none.bag));
    press('+');
    cleanup();
    const chord = deps({ onVoteKey });
    renderHook(() => useEditorKeyboardShortcuts(chord.bag));
    press('+', { altKey: true });
    expect(onVoteKey).not.toHaveBeenCalled();
    cleanup();
    const onTypeIntoSelected = vi.fn(() => false);
    const viewer = deps({ onVoteKey: undefined, isReadOnly: true, onTypeIntoSelected });
    renderHook(() => useEditorKeyboardShortcuts(viewer.bag));
    expect(press('+').defaultPrevented).toBe(false);
    expect(onTypeIntoSelected).not.toHaveBeenCalled();
  });
});
