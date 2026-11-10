// A boxed drag's move (editor-drag-listeners.ts, docs/specs/008-canvas/canvas-and-palette.md): a body move with its
// engage threshold, the insertion slot, the lanes, the alignment snap, the auto-rebind and the Shift-duplicate swap,
// or a resize with its snap and a text box's hug. Moved verbatim out of the listeners' move handler, which calls it
// for every boxed pointer move with the same values it read inline.

import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  ES_LANES,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  type Element,
} from '@livediagram/document';
import type { DragState } from '@/lib/canvas';
import type { InsertionSlot } from '@/lib/insert-between';
import { setInsertionSlot } from '@/lib/insertion-preview';
import { setLanePreview } from '@/lib/lane-preview';
import { landNoteInSlot, resolveNoteInsertion } from './note-insertion-drag';
import type { EditorDragDeps } from './useEditorDrag.types';
import { applyShiftDuplicateSwap, type ShiftDupSwap } from './shift-duplicate-swap';
import {
  resizedElement,
  resolveBoxedMove,
  resolveBoxedResize,
  translateBoxedSelection,
} from './boxed-drag-resolve';
import { measureDrawnText } from '@/components/canvas/text-hug-measure';
import type { useSnapGuideState } from './useSnapGuideState';

// Screen-pixel distance the pointer must travel before a body drag
// actually starts moving the element. Below this a press (even one that
// wobbles a few pixels) just selects / opens the element for editing:
// it never nudges it. Distance-based, not time-based: a fast flick still
// covers far more than this, so real drags engage immediately. Resize /
// rotate / arrow-endpoint grabs are deliberate handle pulls and aren't
// gated.
export const DRAG_ENGAGE_PX = 4;

// Everything the move handler reads off a pointer event. Structural rather
// than `PointerEvent` so the handler can be replayed from a stored position
// when only a MODIFIER changes (see onAltChange): a real PointerEvent keeps
// its fields on the prototype and so can't be copied with a spread.
export type MovePointer = {
  clientX: number;
  clientY: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

// What a boxed move reads from the listeners: the gesture, the hook's refs and setters, and what the gesture worked
// out when it started.
export type BoxedMoveContext = {
  drag: Extract<DragState, { kind: 'boxed' }>;
  depsRef: RefObject<EditorDragDeps>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  scheduleGuides: ReturnType<typeof useSnapGuideState>['scheduleGuides'];
  dragEngagedRef: RefObject<boolean>;
  engageGesture: () => void;
  insertSlotRef: RefObject<InsertionSlot | null>;
  dupSwapRef: RefObject<ShiftDupSwap | null>;
  setShiftDupGhostIds: Dispatch<SetStateAction<ReadonlySet<string> | null>>;
  notesEligible: boolean;
  laneAnchorId: string | null;
};

// This move's values, as the move handler worked them out.
export type BoxedMoveAt = {
  activeTab: EditorDragDeps['activeTab'];
  tick: (mapper: (els: Element[]) => Element[]) => void;
  dx: number;
  dy: number;
  noSnap: boolean;
};

export function moveBoxedDrag(
  {
    drag,
    depsRef,
    setDrag,
    scheduleGuides,
    dragEngagedRef,
    engageGesture,
    insertSlotRef,
    dupSwapRef,
    setShiftDupGhostIds,
    notesEligible,
    laneAnchorId,
  }: BoxedMoveContext,
  e: MovePointer,
  { activeTab, tick, dx, dy, noSnap }: BoxedMoveAt,
): void {
  if (drag.mode === 'move') {
    // Drag-engage threshold: until the pointer has travelled past
    // DRAG_ENGAGE_PX (screen space), treat the press as a click:
    // select / open-to-edit without moving anything. Once engaged it
    // tracks the full delta from the start, so there's no jump.
    if (!dragEngagedRef.current) {
      const travelled = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (travelled < DRAG_ENGAGE_PX) return;
      dragEngagedRef.current = true;
      engageGesture();
    }
    // Insert between (docs/specs/021-event-storming/event-storming.md): while Alt is held on an event-storming
    // board, a single sticky offers to take its place BETWEEN two notes
    // rather than just land near them. The slot is the placement while
    // it is open, so it wins over the alignment snap and over free
    // placement (Cmd/Ctrl) alike: two placement rules at once would
    // put the note, the marker and the drop in three different places.
    const slot = resolveNoteInsertion({
      gate: depsRef.current.insertGate,
      altHeld: e.altKey,
      shiftHeld: e.shiftKey,
      elements: activeTab.elements,
      primaryId: drag.primaryId,
      startBounds: drag.startBounds,
      dx,
      dy,
      inertIds: depsRef.current.layerInertIds,
      active: insertSlotRef.current,
    });
    insertSlotRef.current = slot;
    setInsertionSlot(slot);
    if (slot) {
      // An open slot IS the placement, so the lane rung stands down
      // with everything else below it.
      setLanePreview(null);
      // One vertical line where the board splits, in the guide overlay's
      // own visual language: the same marker the palette drag draws.
      scheduleGuides(
        [{ axis: 'x', position: slot.atX, start: slot.spanTop, end: slot.spanBottom }],
        [],
      );
      // The note moves live, as any dragged note does; the ripple it is
      // opening stays a preview until the drop.
      tick((els) => landNoteInSlot(els, drag.primaryId, slot));
      return;
    }
    // Alignment / distribution snapping + the guide lines live in
    // resolveBoxedMove; this handler applies the resolved
    // translation and the rebind pass.
    const move = resolveBoxedMove({
      elements: activeTab.elements,
      startBounds: drag.startBounds,
      primaryId: notesEligible && laneAnchorId ? laneAnchorId : drag.primaryId,
      dx,
      dy,
      noSnap,
      guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
      // Free placement (Cmd/Ctrl) skips the lanes with everything else:
      // the modifier means "I know where I want this".
      timeline: notesEligible && !noSnap ? ES_LANES : null,
      laneHeld: laneAnchorId !== null,
    });
    setLanePreview(move.lane);
    scheduleGuides(move.guides, move.distGuides);
    tick((els) => {
      // First pass: translate every dragged boxed element (and the
      // free ends of arrows pulled into a frame-section move).
      const moved = translateBoxedSelection(
        els,
        drag.startBounds,
        drag.startArrowEnds,
        move.tx,
        move.ty,
      );
      // Second pass, live on every frame: the auto-rebind
      // (docs/specs/008-canvas/arrow-anchors.md) moves an end whose
      // arrow now runs through a shape. Skipped when the
      // preference (docs/specs/007-editor/user-preferences.md) is
      // off. Read through a ref so a mid-drag flip lands on the
      // next pointermove; ?? true mirrors its default.
      const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? true;
      return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
    });
    // Shift-duplicate identity swap (docs/specs/008-canvas/shift-drag-duplicate.md): holding Shift turns
    // this move into a copy by parking the originals and handing the
    // cursor to a fresh clone set, and releasing it swings back. All
    // of that lives in shift-duplicate-swap.ts; a true return means
    // it took the tick over and the plain translate above no longer
    // applies.
    const d = depsRef.current;
    if (
      applyShiftDuplicateSwap({
        drag,
        shiftKey: e.shiftKey,
        isReadOnly: d.isReadOnly,
        dx,
        dy,
        elements: activeTab.elements,
        swap: dupSwapRef.current,
        setSwap: (next) => {
          dupSwapRef.current = next;
        },
        setGhostIds: setShiftDupGhostIds,
        setDrag,
        ...d.readSelection(),
        setSelectedId: d.setSelectedId,
        setMultiSelectedIds: d.setMultiSelectedIds,
        tick,
      })
    ) {
      return;
    }
  } else {
    // Single + multi resize (union scaling, rotated projection,
    // resize snapping) all live in resolveBoxedResize; this handler
    // writes the resolved per-element bounds. `guides: null` means
    // the frame doesn't own the guide state (multi-resize never
    // scheduled it).
    const resize = resolveBoxedResize({
      elements: activeTab.elements,
      startBounds: drag.startBounds,
      primaryId: drag.primaryId,
      mode: drag.mode,
      dx,
      dy,
      shiftHeld: e.shiftKey,
      dragAspectLocked: drag.aspectLocked,
      guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
      noSnap,
    });
    if (!resize) return;
    if (resize.guides !== null) scheduleGuides(resize.guides);
    // A lone text box that fits or wraps hugs its text through the resize, in either
    // editor mode (docs/specs/007-editor/editor-modes.md "A text box's sizing").
    const textHug =
      drag.startBounds.size === 1
        ? {
            mode: drag.mode,
            constrain: drag.aspectLocked || e.shiftKey,
            measure: measureDrawnText(activeTab.font, activeTab.finish),
          }
        : null;
    tick((els) =>
      els.map((el) => {
        if (!isBoxed(el)) return el;
        const next = resize.boundsById.get(el.id);
        return next ? resizedElement(el, next, textHug) : el;
      }),
    );
  }
}
