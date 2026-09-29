// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { useShapeDrawing } from './useShapeDrawing';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The Highlighter is a held tool (docs/specs/008-canvas/highlighter.md): picking it arms the marker and
// clears the selection; putting it down drops only the marker's own intent.

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
  it('arms the marker and clears the selection when picked', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'highlighter' });
    expect(result.current.drawing.pendingDraw).toEqual({
      type: 'freehand',
      variant: 'highlighter',
    });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.multi.size).toBe(0);
    expect(result.current.editingId).toBeNull();
  });

  it('drops the marker when put down', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'highlighter' });
    rerender({ tool: 'select' });
    expect(result.current.drawing.pendingDraw).toBeNull();
  });

  it('keeps a draw armed from the palette when the marker is put down', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'highlighter' });
    act(() => result.current.drawing.beginPolygon());
    rerender({ tool: 'select' });
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'polygon' });
  });

  it('leaves the selection alone for other tools', () => {
    const { result, rerender } = setup();
    rerender({ tool: 'pan' });
    expect(result.current.selectedId).toBe('el-1');
    expect(result.current.drawing.pendingDraw).toBeNull();
  });
});
