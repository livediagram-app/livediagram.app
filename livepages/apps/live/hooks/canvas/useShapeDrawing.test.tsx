// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShapeDrawing } from './useShapeDrawing';
import { createSelectionStore } from '@/lib/selection-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

type Commit = Parameters<typeof useShapeDrawing>[0]['commit'];

function setup(commit = vi.fn<Commit>(), setCanvasTool = vi.fn()) {
  const selection = createSelectionStore();
  selection.setSelection({ selectedId: 'el-1', multiSelectedIds: new Set(['el-2']) });
  return renderHook(
    ({ tool }: { tool: CanvasTool }) => {
      const [editingId, setEditingId] = useState<string | null>('el-1');
      const drawing = useShapeDrawing({
        editsBlocked: false,
        readSelection: selection.get,
        canvasTool: tool,
        setCanvasTool,
        activeTab: { id: 't1', name: 'Tab', elements: [] },
        commit,
        setSelectedId: selection.setSelectedId,
        setMultiSelectedIds: selection.setMultiSelectedIds,
        setEditingId,
        styleNewElement: (el) => el,
      });
      const { selectedId, multiSelectedIds: multi } = selection.get();
      return { drawing, selectedId, multi, editingId };
    },
    { initialProps: { tool: 'select' as CanvasTool } },
  );
}

describe('useShapeDrawing polygon', () => {
  it('arms the polygon and clears the selection when the tile is picked', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginPolygon());
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'polygon' });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.multi.size).toBe(0);
    expect(result.current.editingId).toBeNull();
  });

  it('arms nothing on its own when a tool changes', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'pan' });
    expect(result.current.selectedId).toBe('el-1');
    expect(result.current.drawing.pendingDraw).toBeNull();
  });
});

// docs/specs/009-elements/images.md "Placeholder rendering": an image lands as its empty placeholder,
// selected, and no picker opens on its own (the placeholder's Select Image button opens it).
describe('useShapeDrawing image', () => {
  it('drops the empty placeholder and selects it, opening nothing', () => {
    const commit = vi.fn<Commit>();
    const { result, rerender } = setup(commit);
    act(() => result.current.drawing.commitDraw({ type: 'image' }, 0, 0, 200, 150));
    // The selection store does not re-render the hook on its own.
    rerender({ tool: 'select' });
    const placed = commit.mock.calls[0]![0]([])[0]!;
    expect(placed).toMatchObject({ type: 'image', imageId: null });
    expect(result.current.selectedId).toBe(placed.id);
    expect(result.current.editingId).not.toBe(placed.id);
    expect(result.current.drawing.pendingDraw).toBeNull();
  });
});

// docs/specs/009-elements/badge.md "Badge presets": the Warning badge is rose on any tab, whatever the theme or the
// style the board remembers for badges.
describe('placing a badge preset', () => {
  it('keeps the Warning badge rose on a themed tab with a remembered badge colour', () => {
    const commit = vi.fn<Commit>();
    const selection = createSelectionStore();
    const { result } = renderHook(() =>
      useShapeDrawing({
        editsBlocked: false,
        readSelection: selection.get,
        canvasTool: 'select',
        setCanvasTool: vi.fn(),
        activeTab: { id: 't1', name: 'Tab', theme: 'ocean', elements: [] },
        commit,
        setSelectedId: selection.setSelectedId,
        setMultiSelectedIds: selection.setMultiSelectedIds,
        setEditingId: vi.fn(),
        // The board remembers blue for badges.
        styleNewElement: (el) => ({ ...el, strokeColor: '#2563eb' }),
      }),
    );
    act(() =>
      result.current.commitDraw(
        { type: 'shape', kind: 'badge', variant: 'warning' },
        100,
        100,
        100,
        100,
      ),
    );
    const [placed] = commit.mock.calls[0]![0]([]);
    expect(placed).toMatchObject({ shape: 'badge', label: 'PII', strokeColor: '#e11d48' });
  });
});

// An armed draw puts down a tool that acts on a press: a format painter held while A armed the arrow painted what the
// drag crossed instead of drawing it.
describe('arming a draw over a press tool', () => {
  it.each([
    ['format', 'select'],
    ['laser', 'pan'],
  ] as const)('puts the %s down for %s', (tool, next) => {
    const setCanvasTool = vi.fn();
    const { result, rerender } = setup(vi.fn<Commit>(), setCanvasTool);
    rerender({ tool });
    act(() => result.current.drawing.beginDraw({ type: 'arrow', ends: 'to' }));
    expect(setCanvasTool).toHaveBeenCalledWith(next);
    setCanvasTool.mockClear();
    act(() => result.current.drawing.beginPolygon());
    expect(setCanvasTool).toHaveBeenCalledWith(next);
  });

  it('leaves select and the hand as they are', () => {
    const setCanvasTool = vi.fn();
    const { result, rerender } = setup(vi.fn<Commit>(), setCanvasTool);
    act(() => result.current.drawing.beginDraw({ type: 'arrow', ends: 'to' }));
    rerender({ tool: 'pan' });
    act(() => result.current.drawing.beginPolygon());
    expect(setCanvasTool).not.toHaveBeenCalled();
  });
});
