// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShapeDrawing } from './useShapeDrawing';
import { createSelectionStore } from '@/lib/selection-store';
import { DEFAULT_WHITEBOARD_PREFS, saveWhiteboardPrefs } from '@/lib/whiteboard-prefs';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The Highlighter is a Draw tile (docs/specs/008-canvas/highlighter.md): picking it arms the marker
// for one stroke and clears the selection, like the pens. It is not a canvas tool.

type Commit = Parameters<typeof useShapeDrawing>[0]['commit'];

function setup(commit = vi.fn<Commit>()) {
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
        activeTab: { id: 't1', name: 'Tab', elements: [] },
        drawMode: false,
        commit,
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

// docs/specs/007-editor/toolbar-layout.md "Search: every element type": a marker picked from the
// strip's Search outside Drawing mode is the dock's own pen, as this browser last set it.
describe('useShapeDrawing marker', () => {
  it("picks up the pen in its saved colour and width, with the pen's recognition", () => {
    saveWhiteboardPrefs({
      ...DEFAULT_WHITEBOARD_PREFS,
      recognise: true,
      pens: DEFAULT_WHITEBOARD_PREFS.pens.map((p) =>
        p.id === 'second' ? { ...p, colour: 'green', width: 2.5 } : p,
      ),
    });
    const { result } = setup();
    act(() => result.current.drawing.beginMarker('second'));
    expect(result.current.drawing.pendingDraw).toEqual({
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'green',
      width: 2.5,
      recognise: true,
      penId: 'second',
    });
    expect(result.current.selectedId).toBeNull();
    localStorage.clear();
  });

  it('picks up Marker 1 in the ink, which records no colour', () => {
    localStorage.clear();
    const { result } = setup();
    act(() => result.current.drawing.beginMarker('main'));
    expect(result.current.drawing.pendingDraw).toMatchObject({
      variant: 'whiteboard',
      colour: null,
    });
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
        drawMode: false,
        commit,
        setSelectedId: selection.setSelectedId,
        setMultiSelectedIds: selection.setMultiSelectedIds,
        setEditingId: vi.fn(),
        zoomRef: { current: 1 },
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
