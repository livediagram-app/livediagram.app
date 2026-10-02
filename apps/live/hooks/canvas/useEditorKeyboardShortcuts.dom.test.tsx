// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import type { EditorKeyboardShortcutsDeps } from './editor-shortcut-keys';

// The listener itself, in a DOM: Delete AND Backspace delete the selection
// (docs/specs/008-canvas/canvas-and-palette.md#selection-popover), and every key the editor acts on
// is counted once for the power user mode offer (docs/specs/007-editor/power-user-mode.md).

function deps(overrides: Partial<EditorKeyboardShortcutsDeps> = {}) {
  const spies = {
    deleteSelected: vi.fn(),
    deleteMultiSelected: vi.fn(),
    onShortcutUsed: vi.fn(),
    setCanvasTool: vi.fn(),
  };
  const base = new Proxy(
    {
      formatSourceId: null,
      pendingDraw: null,
      selectedId: 'a',
      multiSelectedIds: new Set<string>(),
      editingId: null,
      isReadOnly: false,
      canvasTool: 'select',
      enabled: true,
      zenMode: false,
      canGrowMindNode: () => false,
      // An ordinary diagram tab unless a test says otherwise.
      whiteboard: null,
      ...spies,
      ...overrides,
    } as Record<string, unknown>,
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

describe('whiteboard keys (docs/specs/023-whiteboard/whiteboard.md "Keyboard shortcuts")', () => {
  const board = () => {
    const wb = {
      pickSelect: vi.fn(),
      pickPen: vi.fn(),
      pickEraser: vi.fn(),
      pickSticky: vi.fn(),
      pickText: vi.fn(),
      pickShape: vi.fn(),
      pickPath: vi.fn(),
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
    expect(wb.pickPen.mock.calls.map((c) => c[0])).toEqual(['main', 'second', 'third']);
    expect(wb.pickEraser).toHaveBeenCalledTimes(1);
  });

  it('adds notes, text and the dock shapes with N, T, R, O, D, C, L and A', () => {
    const { wb, addShape } = board();
    press('n');
    press('t');
    for (const k of ['r', 'o', 'd', 'c', 'l', 'a']) press(k);
    expect(wb.pickSticky).toHaveBeenCalledTimes(1);
    expect(wb.pickText).toHaveBeenCalledTimes(1);
    expect(wb.pickShape.mock.calls.map((c) => c[0])).toEqual([
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
