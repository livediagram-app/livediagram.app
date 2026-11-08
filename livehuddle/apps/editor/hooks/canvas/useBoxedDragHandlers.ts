import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react';
import { withAttachedDoors, isBoxed } from '@livehuddle/document';
import { type DragMode, type DragState, type ShapeBounds } from '@/lib/canvas';
import type { EditorDragDeps } from './useEditorDrag.types';

type BoxedDragHandlerDeps = {
  depsRef: RefObject<EditorDragDeps>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  checkpointPendingRef: RefObject<boolean>;
};

// The drag gesture starter for boxed elements: beginDrag (move / resize a
// shape, sticky, image or other boxed element). It snapshots the pressed element off depsRef,
// arms a history checkpoint, and sets the drag state the shared move effect in
// useEditorDrag then advances. Split out of useEditorDrag.
export function useBoxedDragHandlers({
  depsRef,
  setDrag,
  checkpointPendingRef,
}: BoxedDragHandlerDeps) {
  // A press that an armed action takes instead of selecting: true when it took it. Shared by a drag's press and
  // a tap that panned instead of dragging (docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)").
  const pressArmedAction = (elementId: string): boolean => {
    const d = depsRef.current;
    // Persistent Format tool: first click arms the source, each later
    // click paints onto the target and (in Keep painting) KEEPS the
    // source armed so the user can format many elements in a row.
    if (d.formatToolActive) {
      if (d.formatSourceId === null) d.setFormatSourceId(elementId);
      else d.applyFormatFromSource(elementId);
      return true;
    }
    return false;
  };

  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (mode === 'move' && pressArmedAction(elementId)) return;
    if (d.editingId === elementId) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    // The selection as the press found it, before this press changes it.
    const { multiSelectedIds } = d.readSelection();
    d.setSelectedId(elementId);
    // Only Shift adds to a selection (docs/specs/008-canvas/canvas-and-palette.md "Marquee
    // box-select"): a press outside the multi-selection selects this element alone.
    if (multiSelectedIds.size > 0 && !multiSelectedIds.has(elementId)) {
      d.setMultiSelectedIds(new Set());
    }
    // Selection above still lands so viewers can inspect; the drag
    // itself is blocked for a read-only session.
    // A Participant moves and resizes only what it may (docs/specs/013-workspace/share-roles.md).
    if (d.isReadOnly && !(mode === 'move' ? d.canMove : d.canResize)?.(element)) return;

    // A multi-selection drags in lockstep: for 'move' the whole set
    // translates together, for 'resize-*' the whole set scales together
    // (members reposition + resize proportionally around the corner opposite
    // the drag handle). A bare single-element drag falls through to the
    // singleton set.
    const baseIds = multiSelectedIds.has(elementId)
      ? new Set(multiSelectedIds)
      : new Set<string>([elementId]);

    // A room's doors ride its move (docs/specs/009-elements/room-builder.md "Door"). Nothing else is carried: a stored
    // lane or boundary is a retired placeholder that holds nothing (docs/specs/002-project-scope/not-in-livehuddle.md
    // "The element engine", part 3).
    const ids = mode === 'move' ? withAttachedDoors(d.activeTab.elements, baseIds) : baseIds;

    const startBounds = new Map<string, ShapeBounds>();
    for (const el of d.activeTab.elements) {
      if (!ids.has(el.id)) continue;
      if (isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      }
    }

    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      startElements: d.activeTab.elements,
      aspectLocked: element.aspectLocked === true,
    });
  };

  return { beginDrag, pressArmedAction };
}
