// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditorHistory } from './useEditorHistory';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/announcer', () => ({ announce: vi.fn() }));

// A locked tab pauses undo and redo on every route (docs/specs/008-canvas/canvas-and-palette.md
// "A locked tab pauses undo and redo"): the flags the toolbar and the command palette read, and
// the handlers the keyboard shortcuts call.
function setup(tabLocked: boolean) {
  const undoHistory = vi.fn();
  const redoHistory = vi.fn();
  const { result } = renderHook(() =>
    useEditorHistory({
      activeId: 't1',
      editsBlocked: tabLocked,
      canUndo: true,
      canRedo: true,
      tabLocked,
      tickTabs: vi.fn(),
      undoHistory,
      redoHistory,
      set: { setSelectedId: vi.fn(), setEditingId: vi.fn(), setFormatSourceId: vi.fn() },
    }),
  );
  return { result, undoHistory, redoHistory };
}

describe('useEditorHistory on a locked tab', () => {
  it('reports undo and redo unavailable and ignores both', () => {
    const { result, undoHistory, redoHistory } = setup(true);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    result.current.undo();
    result.current.redo();
    expect(undoHistory).not.toHaveBeenCalled();
    expect(redoHistory).not.toHaveBeenCalled();
  });

  it('undoes and redoes as usual once the tab is unlocked', () => {
    const { result, undoHistory, redoHistory } = setup(false);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    result.current.undo();
    result.current.redo();
    expect(undoHistory).toHaveBeenCalledTimes(1);
    expect(redoHistory).toHaveBeenCalledTimes(1);
  });
});
