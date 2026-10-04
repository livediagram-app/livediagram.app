// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { useShapeDrawing } from './useShapeDrawing';
import { createSelectionStore } from '@/lib/selection-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The Highlighter is a Draw tile (docs/specs/008-canvas/highlighter.md): picking it arms the marker
// for one stroke and clears the selection, like the pens. It is not a canvas tool.

function setup() {
  const selection = createSelectionStore();
  selection.setSelection({ selectedId: 'el-1', multiSelectedIds: new Set(['el-2']) });
  return renderHook(
    ({ tool }: { tool: CanvasTool }) => {
      const [editingId, setEditingId] = useState<string | null>('el-1');
      const drawing = useShapeDrawing({
        editsBlocked: false,
        readSelection: selection.get,
        canvasTool: tool,
        setCanvasTool: vi.fn(),
        activeTab: { id: 't1', name: 'Tab', elements: [] } as unknown as Tab,
        drawMode: false,
        commit: vi.fn(),
        setSelectedId: selection.setSelectedId,
        setMultiSelectedIds: selection.setMultiSelectedIds,
        setEditingId,
        zoomRef: { current: 1 },
        styleNewElement: (el) => el,
      });
      const { selectedId, multiSelectedIds: multi } = selection.get();
      return { drawing, selectedId, multi, editingId };
    },
    { initialProps: { tool: 'select' as CanvasTool } },
  );
}

describe('useShapeDrawing highlighter', () => {
  it('arms the marker and clears the selection when the tile is picked', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginHighlighter());
    // Armed in the highlighter's current colour and width: Yellow / Medium on a fresh load.
    expect(result.current.drawing.pendingDraw).toEqual({
      type: 'freehand',
      variant: 'highlighter',
      colour: '#fde047',
      width: 14,
    });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.multi.size).toBe(0);
    expect(result.current.editingId).toBeNull();
  });

  // docs/specs/008-canvas/highlighter.md "Settings": a choice made while armed reaches the armed
  // stroke, and every later arm.
  it('carries a colour or width chosen while armed into the arm and the next one', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginHighlighter());
    act(() => result.current.drawing.highlighter.setColour('#93c5fd'));
    act(() => result.current.drawing.highlighter.setWidth(22));
    expect(result.current.drawing.pendingDraw).toMatchObject({ colour: '#93c5fd', width: 22 });
    act(() => result.current.drawing.beginPolygon());
    act(() => result.current.drawing.beginHighlighter());
    expect(result.current.drawing.pendingDraw).toMatchObject({ colour: '#93c5fd', width: 22 });
  });

  it('leaves another arm alone when a setting changes', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginPolygon());
    act(() => result.current.drawing.highlighter.setColour('#93c5fd'));
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'polygon' });
  });

  it('is replaced by the next tile picked, like any one-shot arm', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginHighlighter());
    act(() => result.current.drawing.beginPolygon());
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'polygon' });
  });

  it('arms nothing on its own when a tool changes', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'pan' });
    expect(result.current.selectedId).toBe('el-1');
    expect(result.current.drawing.pendingDraw).toBeNull();
  });
});
