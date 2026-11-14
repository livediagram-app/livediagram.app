// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCanvasSelectHandlers } from './useCanvasSelectHandlers';

// Right-clicking a member of a multi-selection opens the selection-wide menu, naming the member right-clicked, so a
// product's menu can offer that member's own settings (livehuddle's office.md "A piece's type").

afterEach(cleanup);

function harness(multi: string[]) {
  const onSelect = vi.fn();
  const onElementContextMenu = vi.fn();
  const onMultiContextMenu = vi.fn();
  const view = renderHook(() =>
    useCanvasSelectHandlers({
      inertIds: new Set(['inert']),
      isPaintMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set(multi) }),
      onSelect,
      onDeselect: vi.fn(),
      onShiftSelect: vi.fn(),
      onElementContextMenu,
      onMultiContextMenu,
    }),
  );
  return { h: view.result.current, onSelect, onElementContextMenu, onMultiContextMenu };
}

describe('handleElementContextSelect', () => {
  it('opens the selection menu with the member right-clicked, keeping the selection', () => {
    const t = harness(['a', 'b']);
    t.h.handleElementContextSelect('b', 40, 50);
    expect(t.onMultiContextMenu).toHaveBeenCalledExactlyOnceWith(40, 50, 'b');
    expect(t.onSelect).not.toHaveBeenCalled();
    expect(t.onElementContextMenu).not.toHaveBeenCalled();
  });

  it('opens the element menu for an element outside the selection', () => {
    const t = harness(['a', 'b']);
    t.h.handleElementContextSelect('c', 40, 50);
    expect(t.onMultiContextMenu).not.toHaveBeenCalled();
    expect(t.onSelect).toHaveBeenCalledWith('c');
    expect(t.onElementContextMenu).toHaveBeenCalledWith('c', 40, 50);
  });
});
