// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { useShapeDrawing } from './useShapeDrawing';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The Highlighter is a Draw tile (docs/specs/008-canvas/highlighter.md): picking it arms the marker
// for one stroke and clears the selection, like the pens. It is not a canvas tool.

function setup() {
  return renderHook(
    ({ tool }: { tool: CanvasTool }) => {
      const [selectedId, setSelectedId] = useState<string | null>('el-1');
      const [multi, setMultiSelectedIds] = useState<Set<string>>(new Set(['el-2']));
      const [editingId, setEditingId] = useState<string | null>('el-1');
      const drawing = useShapeDrawing({
        editsBlocked: false,
        selectedId,
        canvasTool: tool,
        setCanvasTool: vi.fn(),
        activeTab: { id: 't1', name: 'Tab', elements: [] } as unknown as Tab,
        drawMode: false,
        commit: vi.fn(),
        setSelectedId,
        setMultiSelectedIds,
        setEditingId,
        zoomRef: { current: 1 },
        styleNewElement: (el) => el,
      });
      return { drawing, selectedId, multi, editingId };
    },
    { initialProps: { tool: 'select' as CanvasTool } },
  );
}

describe('useShapeDrawing highlighter', () => {
  it('arms the marker and clears the selection when the tile is picked', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginHighlighter());
    expect(result.current.drawing.pendingDraw).toEqual({
      type: 'freehand',
      variant: 'highlighter',
    });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.multi.size).toBe(0);
    expect(result.current.editingId).toBeNull();
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
