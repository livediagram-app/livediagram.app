// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShapeDrawing } from './useShapeDrawing';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The Highlighter is a Draw tile (docs/specs/008-canvas/highlighter.md): picking it arms the marker
// for one stroke and clears the selection, like the pens. It is not a canvas tool.

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

// The Room Builder (docs/specs/009-elements/room-builder.md "Share roles"): an Editor arms it and draws a room; a
// Viewer (edits blocked) can neither arm it nor commit one.
describe('useShapeDrawing Room Builder', () => {
  function roomSetup(editsBlocked: boolean) {
    const commit = vi.fn<Commit>();
    const selection = createSelectionStore();
    const hook = renderHook(() =>
      useShapeDrawing({
        editsBlocked,
        readSelection: selection.get,
        canvasTool: 'select',
        setCanvasTool: vi.fn(),
        activeTab: { id: 't1', name: 'Tab', elements: [] },
        commit,
        setSelectedId: selection.setSelectedId,
        setMultiSelectedIds: selection.setMultiSelectedIds,
        setEditingId: vi.fn(),
        zoomRef: { current: 1 },
        styleNewElement: (el) => el,
      }),
    );
    return { ...hook, commit, selection };
  }
  const L = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
  ];

  it('lets an Editor arm it and commit a custom room, selected', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.beginRoomWalls());
    expect(result.current.pendingDraw).toEqual({ type: 'room-walls' });
    act(() => result.current.commitRoomWalls(L));
    expect(result.current.pendingDraw).toBeNull();
    expect(commit).toHaveBeenCalledTimes(1);
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'shape', shape: 'room', roomDoor: 'none' });
    expect(selection.get().selectedId).toBe(added[0]!.id);
  });

  // docs/specs/009-elements/office.md "The doorway is a Door": a tapped or drawn Room comes with its Door, one commit.
  it('adds a tapped Room with its Door on the front wall in one commit, the room selected', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.commitDraw({ type: 'shape', kind: 'room' }, 500, 400, 500, 400));
    expect(commit).toHaveBeenCalledTimes(1);
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ shape: 'room', roomDoor: 'none', width: 480, height: 320 });
    expect(added[1]).toMatchObject({ shape: 'door' });
    expect((added[1] as { rotation?: number }).rotation ?? 0).toBe(0);
    expect(selection.get().selectedId).toBe(added[0]!.id);
  });

  // docs/specs/009-elements/office-amenities.md "The Restroom preset": the room, its Door and its fittings, one commit.
  it('adds a tapped Restroom furnished, with its Door and sign, in one commit, the room selected', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() =>
      result.current.commitDraw(
        { type: 'shape', kind: 'room', variant: 'restroom' },
        500,
        400,
        500,
        400,
      ),
    );
    expect(commit).toHaveBeenCalledTimes(1);
    const added = commit.mock.calls[0]![0]([]);
    expect(added.map((e) => (e.type === 'shape' ? e.shape : e.type))).toEqual([
      'room',
      'door',
      'toilet-cubicle',
      'toilet-cubicle',
      'hand-dryer',
      'washbasin',
      'washbasin',
      'room-sign',
    ]);
    expect(added[0]).toMatchObject({ label: 'Restroom' });
    expect(selection.get().selectedId).toBe(added[0]!.id);
  });

  it('commits nothing for fewer than three corners', () => {
    const { result, commit } = roomSetup(false);
    act(() => result.current.beginRoomWalls());
    act(() => result.current.commitRoomWalls(L.slice(0, 2)));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pendingDraw).toBeNull();
  });

  it('gives a Viewer neither the tool nor a room', () => {
    const { result, commit } = roomSetup(true);
    act(() => result.current.beginRoomWalls());
    expect(result.current.pendingDraw).toBeNull();
    act(() => result.current.commitRoomWalls(L));
    expect(commit).not.toHaveBeenCalled();
  });
});
