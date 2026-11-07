// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditorHistory } from './useEditorHistory';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/announcer', () => ({ announce: vi.fn() }));

// Undo and redo (docs/specs/008-canvas/canvas-and-palette.md): the flags the toolbar and the command palette read,
// and the handlers the keyboard shortcuts call. A tab saved locked before locking left pauses nothing.
function setup(canUndo: boolean) {
  const undoHistory = vi.fn();
  const redoHistory = vi.fn();
  const { result } = renderHook(() =>
    useEditorHistory({
      activeId: 't1',
      editsBlocked: false,
      canUndo,
      canRedo: canUndo,
      tickTabs: vi.fn(),
      undoHistory,
      redoHistory,
      set: { setSelectedId: vi.fn(), setEditingId: vi.fn(), setFormatSourceId: vi.fn() },
    }),
  );
  return { result, undoHistory, redoHistory };
}

describe('useEditorHistory', () => {
  it('undoes and redoes when the history has a step', () => {
    const { result, undoHistory, redoHistory } = setup(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    result.current.undo();
    result.current.redo();
    expect(undoHistory).toHaveBeenCalledTimes(1);
    expect(redoHistory).toHaveBeenCalledTimes(1);
  });

  it('reports undo and redo unavailable with nothing to step', () => {
    const { result } = setup(false);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
