// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShapeDrawing } from './useShapeDrawing';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// Arming a draw (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") clears the selection and holds
// for one gesture; a tool change arms nothing.

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
        setSelection: selection.setSelection,
        setEditingId,
        styleNewElement: (el) => el,
      });
      const { selectedId, multiSelectedIds: multi } = selection.get();
      return { drawing, selectedId, multi, editingId };
    },
    { initialProps: { tool: 'select' as CanvasTool } },
  );
}

describe('useShapeDrawing arming', () => {
  it('arms a draw and clears the selection', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginRoomWalls());
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'room-walls' });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.multi.size).toBe(0);
    expect(result.current.editingId).toBeNull();
  });

  it('is replaced by the next tile picked, like any one-shot arm', () => {
    const { result } = setup();
    act(() => result.current.drawing.beginRoomWalls());
    act(() => result.current.drawing.beginDraw({ type: 'sticky' }));
    expect(result.current.drawing.pendingDraw).toEqual({ type: 'sticky' });
  });

  it('commits nothing for a room-walls intent reaching the draw commit', () => {
    const commit = vi.fn<Commit>();
    const { result } = setup(commit);
    act(() => result.current.drawing.beginRoomWalls());
    act(() => result.current.drawing.commitDraw({ type: 'room-walls' }, 0, 0, 100, 100));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.drawing.pendingDraw).toBeNull();
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
        setSelection: selection.setSelection,
        setEditingId: vi.fn(),
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
  // docs/specs/009-elements/office.md "Placing selects every piece": the room and its Door land selected together.
  it('adds a tapped Room with its Door on the front wall in one commit, both selected', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.commitDraw({ type: 'shape', kind: 'room' }, 500, 400, 500, 400));
    expect(commit).toHaveBeenCalledTimes(1);
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ shape: 'room', roomDoor: 'none', width: 480, height: 320 });
    expect(added[1]).toMatchObject({ shape: 'door' });
    expect((added[1] as { rotation?: number }).rotation ?? 0).toBe(0);
    expect(selection.get()).toEqual({
      selectedId: null,
      multiSelectedIds: new Set([added[0]!.id, added[1]!.id]),
    });
  });

  // docs/specs/009-elements/office-amenities.md "The Restroom preset": the room, its Door and its fittings, one commit.
  it('adds a tapped Restroom furnished, with its Door and sign, in one commit, every piece selected', () => {
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
    expect(selection.get().selectedId).toBeNull();
    expect([...selection.get().multiSelectedIds]).toEqual(added.map((e) => e.id));
  });

  it('keeps a tapped lone piece a single selection', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.commitDraw({ type: 'shape', kind: 'plant' }, 500, 400, 500, 400));
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(1);
    expect(selection.get()).toEqual({ selectedId: added[0]!.id, multiSelectedIds: new Set() });
  });

  it('keeps a tapped sticky a single selection', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.commitDraw({ type: 'sticky' }, 500, 400, 500, 400));
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(1);
    expect(selection.get()).toEqual({ selectedId: added[0]!.id, multiSelectedIds: new Set() });
  });

  it('keeps a tapped Door a single selection, snapped onto the wall it landed by', () => {
    const { result, commit, selection } = roomSetup(false);
    act(() => result.current.commitDraw({ type: 'shape', kind: 'door' }, 500, 400, 500, 400));
    const added = commit.mock.calls[0]![0]([]);
    expect(added).toHaveLength(1);
    expect(selection.get()).toEqual({ selectedId: added[0]!.id, multiSelectedIds: new Set() });
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
