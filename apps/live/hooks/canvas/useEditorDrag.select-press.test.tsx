// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Tab } from '@livediagram/document';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// docs/specs/008-canvas/canvas-and-palette.md "Marquee box-select": only Shift adds to a
// selection, so a plain press on an element outside the multi-selection selects it alone.

function harness(multi: string[]) {
  const a = createShape('square', 0, 0);
  const b = createShape('square', 200, 0);
  const c = createShape('square', 400, 0);
  const elements: Element[] = [a, b, c];
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const ids: Record<string, string> = { a: a.id, b: b.id, c: c.id };
  const deps = {
    activeTab: { id: 't', name: 'Tab', kind: 'diagram', elements } as Tab,
    zoomRef: { current: 1 },
    selectedId: null,
    setSelectedId,
    multiSelectedIds: new Set(multi.map((k) => ids[k]!)),
    setMultiSelectedIds,
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: vi.fn(),
    commit: vi.fn(),
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    scheduleElementChangeLog: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  const press = (key: string) =>
    act(() => {
      view.result.current.beginDrag(ids[key]!, 'move', {
        clientX: 0,
        clientY: 0,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  return { press, ids, setSelectedId, setMultiSelectedIds };
}

afterEach(() => {
  cleanup();
});

describe('a plain press on a boxed element', () => {
  it('selects a non-member of a multi-selection alone', () => {
    const h = harness(['a', 'b']);
    h.press('c');
    expect(h.setSelectedId).toHaveBeenCalledWith(h.ids.c);
    expect(h.setMultiSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('keeps the multi-selection when it presses a member, so a drag moves them all', () => {
    const h = harness(['a', 'b']);
    h.press('a');
    expect(h.setMultiSelectedIds).not.toHaveBeenCalled();
  });

  it('leaves an empty multi-selection alone', () => {
    const h = harness([]);
    h.press('a');
    expect(h.setSelectedId).toHaveBeenCalledWith(h.ids.a);
    expect(h.setMultiSelectedIds).not.toHaveBeenCalled();
  });
});
