// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditorTools } from './useEditorTools';

// docs/specs/008-canvas/canvas-and-palette.md: Spotlight and Laser are non-editing presenter modes, so
// picking either clears the selection (Work Tracker 1040: no selection toolbar or Quick Style panel
// while presenting). Every other tool keeps it.
function setup() {
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const { result } = renderHook(() =>
    useEditorTools({
      fromDocument: { embedMode: false, toast: { info: vi.fn() } },
      fromHistory: { tabs: [{ id: 't1', elements: [{ id: 'a' }] }] },
      fromSelection: {
        activeId: 't1',
        setFormatSourceId: vi.fn(),
        setMultiSelectedIds,
        setSelectedId,
        tabScopeRef: { current: null },
      },
    } as never),
  );
  return { result, setSelectedId, setMultiSelectedIds };
}

describe('pickCanvasTool', () => {
  it.each(['laser', 'spotlight'] as const)('clears the selection on entering %s', (tool) => {
    const { result, setSelectedId, setMultiSelectedIds } = setup();
    act(() => result.current.pickCanvasTool(tool));
    expect(result.current.canvasTool).toBe(tool);
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(setMultiSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it.each(['select', 'pan', 'eraser'] as const)('keeps the selection on entering %s', (tool) => {
    const { result, setSelectedId } = setup();
    act(() => result.current.pickCanvasTool(tool));
    expect(setSelectedId).not.toHaveBeenCalled();
  });
});
