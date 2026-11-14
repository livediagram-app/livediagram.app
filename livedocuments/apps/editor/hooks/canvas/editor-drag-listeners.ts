// The drag gesture's global pointer and key listeners: the per-pointer-move handler (rAF
// coalesced), cancelling, Escape and the Alt replay. Moved verbatim out of the
// useEditorDrag listener effect, which calls attachDragListeners once per drag start and
// returns its cleanup, so every listener closes over the same values it did inline. The
// gesture's release lives in editor-drag-release.ts.

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { isBoxed, rebindArrowAnchorsAfterMove, type Element } from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import type { DragState } from '@/lib/canvas';
import type { EditorDragDeps } from './useEditorDrag.types';
import { applyArrowDragMove } from './arrow-drag-apply';
import { applyShiftDuplicateSwap, type ShiftDupSwap } from './shift-duplicate-swap';
import {
  resizedElement,
  resolveBoxedMove,
  resolveBoxedResize,
  translateBoxedSelection,
} from './boxed-drag-resolve';
import { measureDrawnText } from '@/components/canvas/text-hug-measure';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { beginCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import {
  dragWaitsToEngage,
  gestureOfDrag,
} from '@liveworkspace/workbench/hooks/canvas/drag-gesture';
import type { useSnapGuideState } from './useSnapGuideState';
import { createDragRelease } from './editor-drag-release';

// Screen-pixel distance the pointer must travel before a body drag
// actually starts moving the element. Below this a press (even one that
// wobbles a few pixels) just selects / opens the element for editing —
// it never nudges it. Distance-based, not time-based: a fast flick still
// covers far more than this, so real drags engage immediately. Resize /
// rotate / arrow-endpoint grabs are deliberate handle pulls and aren't
// gated.
const DRAG_ENGAGE_PX = 4;

// Everything the move handler reads off a pointer event. Structural rather
// than `PointerEvent` so a pending move can outlive its event — a real PointerEvent keeps
// its fields on the prototype and so can't be copied with a spread.
type MovePointer = {
  clientX: number;
  clientY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

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
      if (drag.mode === 'move') {
        // Drag-engage threshold: until the pointer has travelled past
        // DRAG_ENGAGE_PX (screen space), treat the press as a click —
        // select / open-to-edit without moving anything. Once engaged it
        // tracks the full delta from the start, so there's no jump.
        if (!dragEngagedRef.current) {
          const travelled = Math.hypot(
            e.clientX - drag.startClientX,
            e.clientY - drag.startClientY,
          );
          if (travelled < DRAG_ENGAGE_PX) return;
          dragEngagedRef.current = true;
          engageGesture();
        }
        // Alignment / distribution snapping + the guide lines live in
        // resolveBoxedMove; this handler applies the resolved
        // translation and the rebind pass.
        const move = resolveBoxedMove({
          elements: activeTab.elements,
          startBounds: drag.startBounds,
          primaryId: drag.primaryId,
          dx,
          dy,
          noSnap,
          guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
          pageSnapBoxes: depsRef.current.pageSnapBoxes ?? undefined,
          ...(depsRef.current.pagesMode ? { pages: depsRef.current.pagesMode } : {}),
          keepOn: depsRef.current.stackFront ?? null,
        });
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
          pageSnapBoxes: depsRef.current.pageSnapBoxes ?? undefined,
          ...(depsRef.current.pagesMode ? { pages: depsRef.current.pagesMode } : {}),
        });
        if (!resize) return;
        if (resize.guides !== null) scheduleGuides(resize.guides);
        // A lone text box that fits or wraps hugs its text through the resize
        // (docs/specs/006-document/document-structure.md, a text box's sizing).
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
      pages: depsRef.current.pagesMode,
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
  return () => {
    endGesture?.();
    if (moveRaf !== null) cancelAnimationFrame(moveRaf);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('pointerdown', onSecondTouch);
    window.removeEventListener('pointerdown', onPlaceClick, true);
    window.removeEventListener('keydown', onKey, true);
  };
}
