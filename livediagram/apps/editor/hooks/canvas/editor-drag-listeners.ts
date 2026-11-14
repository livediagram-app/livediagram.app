// The drag gesture's global pointer and key listeners: the per-pointer-move handler (rAF
// coalesced), cancelling, Escape and the Alt replay. Moved verbatim out of the
// useEditorDrag listener effect, which calls attachDragListeners once per drag start and
// returns its cleanup, so every listener closes over the same values it did inline. The
// gesture's release lives in editor-drag-release.ts, a boxed drag's move in editor-drag-boxed-move.ts.

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Element } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import type { DragState } from '@/lib/canvas';
import type { InsertionSlot } from '@/lib/insert-between';
import { setInsertionDragInHand, setInsertionSlot } from '@/lib/insertion-preview';
import { setLanePreview } from '@/lib/lane-preview';
import { isSingleNoteDrag } from './note-insertion-drag';
import { laneAnchorOf, lanesHoldDrag } from './lane-drag';
import type { EditorDragDeps } from './useEditorDrag.types';
import { applyArrowDragMove } from './arrow-drag-apply';
import type { ShiftDupSwap } from './shift-duplicate-swap';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { beginCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import { dragWaitsToEngage, gestureOfDrag } from '@liveworkspace/workbench/hooks/canvas/drag-gesture';
import type { useSnapGuideState } from './useSnapGuideState';
import { createDragRelease } from './editor-drag-release';
import { DRAG_ENGAGE_PX, moveBoxedDrag, type MovePointer } from './editor-drag-boxed-move';

type SnapGuideApi = ReturnType<typeof useSnapGuideState>;

// What the listeners read from the hook: the gesture, the hook's refs and setters, and the
// gesture preview's effect events.
export type DragListenerContext = {
  drag: DragState;
  depsRef: RefObject<EditorDragDeps>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  scheduleGuides: SnapGuideApi['scheduleGuides'];
  scheduleSnapTargets: SnapGuideApi['scheduleSnapTargets'];
  dragEngagedRef: RefObject<boolean>;
  checkpointPendingRef: RefObject<boolean>;
  arrowConnectTrackedRef: RefObject<boolean>;
  dupSwapRef: RefObject<ShiftDupSwap | null>;
  setShiftDupGhostIds: Dispatch<SetStateAction<ReadonlySet<string> | null>>;
  insertSlotRef: RefObject<InsertionSlot | null>;
  virtualTab: () => EditorDragDeps['activeTab'];
  previewTick: (mapper: (els: Element[]) => Element[]) => void;
  commitPreview: () => void;
  cancelPreview: () => void;
};

// Attaches the listeners for one drag and returns their cleanup.
export function attachDragListeners({
  drag,
  depsRef,
  setDrag,
  scheduleGuides,
  scheduleSnapTargets,
  dragEngagedRef,
  checkpointPendingRef,
  arrowConnectTrackedRef,
  dupSwapRef,
  setShiftDupGhostIds,
  insertSlotRef,
  virtualTab,
  previewTick,
  commitPreview,
  cancelPreview,
}: DragListenerContext): () => void {
  // Each new gesture starts un-engaged: a body move must cross
  // DRAG_ENGAGE_PX before it nudges anything (see the move branch).
  dragEngagedRef.current = false;
  // The canvas gesture this drag is (docs/specs/008-canvas/canvas-performance.md): opened once it
  // engages, closed with the drag.
  let endGesture: (() => void) | null = null;
  const engageGesture = () => {
    endGesture ??= beginCanvasGesture(gestureOfDrag(drag));
  };
  if (!dragWaitsToEngage(drag)) engageGesture();
  // Tell the canvas a drag that could open a slot is in hand — for the whole
  // gesture rather than just while Alt is down, because the board's easing
  // must still be mounted when the slot CLOSES (or it snaps shut) and
  // because this is what offers the gesture to someone who has never heard
  // of it. Deliberately independent of the modifier: only the board, the
  // kind of thing being dragged, and how many of them.
  const movingOneNote =
    drag.kind === 'boxed' &&
    drag.mode === 'move' &&
    isSingleNoteDrag(virtualTab().elements, drag.primaryId, drag.startBounds);
  setInsertionDragInHand(movingOneNote && depsRef.current.insertGate.esBoard);
  // Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6) apply to ANY notes being moved on one
  // of these boards, one or many, and to a selection holding a workshop note
  // whatever else is in it (a label, a frame): a selection snaps by the note
  // in hand and still meets the board's places, its other members moving by
  // the same delta. The insertion gesture still wants exactly one note, so it
  // keeps its own flag.
  const draggedIds = drag.kind === 'boxed' ? new Set(drag.startBounds.keys()) : null;
  const notesEligible =
    drag.kind === 'boxed' &&
    drag.mode === 'move' &&
    depsRef.current.insertGate.esBoard &&
    lanesHoldDrag(virtualTab().elements, draggedIds!);
  // Always on a lane (docs/specs/021-event-storming/event-storming.md): a WORKSHOP note has no y tolerance.
  // A selection is snapped by the note in hand; when that is a plain
  // sticky, by the first workshop note in the selection, so every workshop
  // note in it stays on a lane. The previewed board: after a Shift-duplicate
  // the note in hand is a clone only the preview has.
  const laneAnchorId =
    drag.kind === 'boxed' ? laneAnchorOf(virtualTab().elements, drag.primaryId, draggedIds!) : null;
  // The last pointer position of this drag, so pressing or releasing Alt
  // without moving the mouse still opens / unwinds the slot (see onAltChange).
  let lastMove: MovePointer | null = null;
  // Cancel the drag (mirroring onUp's full cleanup: snap dots gone,
  // armed checkpoint + log flag disarmed so they can't leak into the
  // next gesture — once drag is null this effect tears down and onUp
  // never runs for this gesture).
  const cancelDrag = () => {
    cancelPreview();
    setDrag(null);
    scheduleGuides([]);
    scheduleSnapTargets([]);
    checkpointPendingRef.current = false;
    // An open insertion offer dies with the gesture. Only the preview is
    // being discarded here — the dragged note's live position is restored
    // by the checkpoint, and the other notes never moved for real.
    insertSlotRef.current = null;
    setInsertionSlot(null);
    setLanePreview(null);
    // A live shift-duplicate is torn down with the gesture: the clone set
    // goes (a no-op after the Escape path's cancelToCheckpoint already
    // restored, but pinch / second-touch cancels never restore) and the
    // selection swings back to the originals.
    const swap = dupSwapRef.current;
    if (swap) {
      dupSwapRef.current = null;
      setShiftDupGhostIds(null);
      depsRef.current.setSelectedId(swap.origSelectedId);
      depsRef.current.setMultiSelectedIds(swap.origMultiIds);
    }
  };
  // A pointer the system took back (a touch interrupted, a native drag starting from content in an
  // element) ends with `pointercancel` and no `pointerup`: the gesture is cancelled, as Escape cancels
  // it, rather than left live to follow a pointer with no button held and commit on a later release.
  // A click-to-place arrow rides through pointer releases by design and is left to its next click.
  const onPointerCancel = () => {
    if (drag?.kind === 'arrow-endpoint' && drag.following) return;
    cancelDrag();
  };
  // Cancel the drag immediately when a second touch finger lands — that
  // signals a pinch gesture, not a solo drag.
  const onSecondTouch = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && !e.isPrimary) {
      cancelDrag();
    }
  };
  const onMove = (e: MovePointer) => {
    if (depsRef.current.isPinchingRef?.current) {
      cancelDrag();
      return;
    }
    // A SNAPSHOT, not the event: a DOM event keeps its fields on the
    // prototype, so spreading one to replay it with a different modifier
    // yields an empty object and a NaN delta.
    lastMove = {
      clientX: e.clientX,
      clientY: e.clientY,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
    };
    const activeTab = virtualTab();
    const { zoomRef } = depsRef.current;
    // Every branch below writes through this: into the gesture's preview, never the document.
    const tick = previewTick;
    // Screen-pixel delta into canvas-coord delta (invert the
    // current zoom).
    const dx = (e.clientX - drag.startClientX) / zoomRef.current;
    const dy = (e.clientY - drag.startClientY) / zoomRef.current;
    // Hold Cmd / Ctrl while dragging to place freely: skip alignment +
    // distribution snapping and its guide lines for this gesture (docs/specs/008-canvas/snap-override.md).
    const noSnap = e.metaKey || e.ctrlKey;

    if (drag.kind === 'boxed') {
      // A body move or a resize (editor-drag-boxed-move.ts).
      moveBoxedDrag(
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
        },
        e,
        { activeTab, tick, dx, dy, noSnap },
      );
      return;
    }

    // Arrow drags engage like a body move: until the pointer travels past
    // DRAG_ENGAGE_PX a press is a click, so a quick double-click never nudges
    // a handle, pins a label or bends a line (docs/specs/008-canvas/arrow-bending.md). Drawing a
    // new arrow's endpoint is the exception: it follows the pointer at once.
    const engages = drag.kind !== 'arrow-endpoint' || drag.reposition === true;
    if (engages && !dragEngagedRef.current) {
      const travelled = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (travelled < DRAG_ENGAGE_PX) return;
      dragEngagedRef.current = true;
      engageGesture();
      if (drag.kind === 'arrow-bend') {
        debugLog('[arrow-bend]', drag.arrowId, drag.plan.kind);
        track('Element', 'Changed', 'ArrowBend');
      }
    }
    // Every remaining kind is an arrow-handle drag (curve / elbow /
    // label / bend / translate, and arrow-endpoint as the fall-through), all
    // of which apply the same way: delta in, resolved geometry out
    // through `tick`. See arrow-drag-apply.ts.
    applyArrowDragMove({
      drag,
      dx,
      dy,
      noSnap,
      shiftHeld: e.shiftKey,
      elements: activeTab.elements,
      guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
      tick,
      scheduleGuides,
      scheduleSnapTargets,
      onArrowConnected: () => {
        // Once per endpoint drag, not once per move tick.
        if (arrowConnectTrackedRef.current) return;
        arrowConnectTrackedRef.current = true;
        track('Element', 'Linked', 'ArrowPoint');
      },
    });
  };
  // How the gesture ends (editor-drag-release.ts). `flushMove` is declared below.
  const { onUp, onPlaceClick } = createDragRelease({
    drag,
    depsRef,
    setDrag,
    scheduleGuides,
    scheduleSnapTargets,
    checkpointPendingRef,
    dupSwapRef,
    setShiftDupGhostIds,
    insertSlotRef,
    virtualTab,
    previewTick,
    commitPreview,
    flushMove: () => flushMove(),
  });
  // Escape aborts the gesture (docs/specs/008-canvas/canvas-and-palette.md). Capture phase + swallow so
  // the editor-wide Escape handlers (deselect / zen exit) don't ALSO
  // fire on the same press — one Escape does exactly one thing.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !drag) return;
    e.preventDefault();
    e.stopPropagation();
    // Follow mode: the half-drawn arrow is removed outright.
    if (drag.kind === 'arrow-endpoint' && drag.following) {
      const arrowId = drag.arrowId;
      depsRef.current.commit((els) => els.filter((el) => el.id !== arrowId));
      depsRef.current.setSelectedId(null);
      cancelDrag();
      return;
    }
    // Nothing was written while the gesture lasted, so cancelling drops its preview and the
    // elements are where the grab started, with no undo step left behind.
    cancelDrag();
  };
  // Alt pressed or released with the hand held still (docs/specs/021-event-storming/event-storming.md): the slot
  // opens and unwinds at the instant the key moves, not at the next twitch.
  // Replaying the last pointer position with the new modifier state keeps
  // one code path deciding where the note goes. (A native HTML5 drag gets
  // no key events at all, which is why the palette path relies on
  // `dragover.altKey` instead — a pointer drag does get them.)
  const onAltChange = (e: KeyboardEvent) => {
    if (e.key !== 'Alt' || e.repeat || !lastMove) return;
    if (!(drag.kind === 'boxed' && drag.mode === 'move')) return;
    onMove({ ...lastMove, altKey: e.type === 'keydown' });
  };
  // Coalesce element-drag commits to one per animation frame, the same way
  // the pan gesture already does (useCanvasPanAndMarquee).
  //
  // pointermove fires faster than React can paint: a trackpad or a 120Hz
  // pointer delivers well above 60 events a second, and every one of them
  // was paying a commit. Over a realistic drag (180 events across ~90
  // frames) this cuts DOM writes by ~18%.
  //
  // Deliberately NOT claimed: that this fixes any particular reported
  // slowness. It was written while chasing one and the measurements that
  // seemed to show a 20ms-per-move cost turned out to be measuring the test
  // harness, not the app. What it does do is stop committing work that the
  // next event in the same frame immediately throws away, which is the same
  // reasoning the pan path already applied.
  //
  // Dropping the intermediate events is lossless. Every branch of `onMove`
  // computes from the gesture's ANCHOR (`drag.startClientX` and friends)
  // and the event's absolute position, never by accumulating deltas, so the
  // frame that lands is identical whether or not the ones before it ran.
  // `onUp` flushes anything still pending first, so a gesture always ends
  // on the true final position rather than the last painted frame.
  // `moveScheduled` rather than a null check on the handle: it is set
  // BEFORE requestAnimationFrame is called and cleared inside the flush, so
  // it is correct even when the callback runs synchronously (which is how
  // the tests drive a frame). Guarding on the handle alone left it assigned
  // AFTER a synchronous flush had already cleared it, so it never returned
  // to null and every later move was dropped.
  let moveScheduled = false;
  let moveRaf: number | null = null;
  let pendingMove: MovePointer | null = null;
  const flushMove = () => {
    moveScheduled = false;
    moveRaf = null;
    const move = pendingMove;
    pendingMove = null;
    if (move) onMove(move);
  };
  const onPointerMove = (e: PointerEvent) => {
    // A SNAPSHOT for the same reason `onMove` takes one: a DOM event's
    // fields live on the prototype, and this one has to outlive the
    // handler by up to a frame.
    pendingMove = {
      clientX: e.clientX,
      clientY: e.clientY,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
    };
    if (moveScheduled) return;
    moveScheduled = true;
    moveRaf = requestAnimationFrame(flushMove);
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('pointerdown', onSecondTouch);
  window.addEventListener('pointerdown', onPlaceClick, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keydown', onAltChange);
  window.addEventListener('keyup', onAltChange);
  return () => {
    endGesture?.();
    if (moveRaf !== null) cancelAnimationFrame(moveRaf);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('pointerdown', onSecondTouch);
    window.removeEventListener('pointerdown', onPlaceClick, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keydown', onAltChange);
    window.removeEventListener('keyup', onAltChange);
    // No gesture in flight: nothing may be left standing aside.
    insertSlotRef.current = null;
    setInsertionSlot(null);
    setLanePreview(null);
    setInsertionDragInHand(false);
  };
}
