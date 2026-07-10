// Drag state machine for the canvas, lifted out of editor-page.tsx so
// the editor route stays focused on top-level orchestration and the
// drag math can be reasoned about (and tested) on its own. Pure
// behavioural extraction: every dispatcher and the global pointer-
// move / pointer-up effect are unchanged from their previous inline
// shape; only the surrounding closure has changed.
//
// Why a hook (not a lib helper): the drag state IS React state
// (setDrag triggers re-render so the wrapper element renders with the
// right cursor + the resize handles see the live drag), and the
// pointer-move effect attaches global listeners that have to be torn
// down via the effect-cleanup convention. Both are React-shaped, so
// they belong in a hook rather than a pure module.
//
// Why a deps ref: the pointer-move effect's listeners need to read
// `activeTab.elements`, `tick`, `zoomRef`, etc. on every move event,
// but we don't want to re-attach those listeners every render. A ref
// gives the effect a stable hook (one attach per drag start) plus a
// fresh view of the parent state on every fire. The previous inline
// shape used an `// eslint-disable-next-line react-hooks/exhaustive-deps`
// comment for the same reason; the ref is the lint-clean version of
// that pattern.

import { useEffect, useRef, useState } from 'react';
import {
  acceptsInlineIcon,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  type ArrowElement,
  type Element,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import { iconDropSide, type DragState } from '@/lib/canvas';
import { elementHostsAtPoint } from '@/lib/dom-hit-test';
import type { EditorDragDeps, EditorDragApi } from './useEditorDrag.types';
import { applyCollisionAvoidance } from './arrow-avoidance-apply';
import { resolveArrowEndpointDrag } from './arrow-endpoint-resolve';
import { resolveArrowControlFrame, resolveArrowLabelFrame } from './arrow-control-resolve';
import {
  resolveBoxedMove,
  resolveBoxedResize,
  translateBoxedSelection,
} from './boxed-drag-resolve';
import { useSnapGuideState } from './useSnapGuideState';
import { useArrowDragHandlers } from './useArrowDragHandlers';
import { useBoxedDragHandlers } from './useBoxedDragHandlers';

// Screen-pixel distance the pointer must travel before a body drag
// actually starts moving the element. Below this a press (even one that
// wobbles a few pixels) just selects / opens the element for editing —
// it never nudges it. Distance-based, not time-based: a fast flick still
// covers far more than this, so real drags engage immediately. Resize /
// rotate / arrow-endpoint grabs are deliberate handle pulls and aren't
// gated.
const DRAG_ENGAGE_PX = 4;

export function useEditorDrag(deps: EditorDragDeps): EditorDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  // Cosmetic snap-guide overlay state (alignment + distribution guides,
  // arrow snap markers), coalesced through rAF. See useSnapGuideState.
  const { snapGuides, distGuides, snapTargets, scheduleGuides, scheduleSnapTargets } =
    useSnapGuideState();
  // Whether the current body drag has crossed DRAG_ENGAGE_PX. Reset at the
  // start of each gesture (in the move effect below); flipped true once the
  // pointer travels far enough that the press is unambiguously a drag.
  const dragEngagedRef = useRef(false);
  // A begin* handler ARMS a checkpoint here instead of taking it at
  // pointer-down. It's flushed lazily on the first real `tick` (the first
  // actual mutation) in the move effect below, so a plain click that
  // selects an element — or a press on a locked element / tab that never
  // mutates — leaves the undo history untouched. Taking the checkpoint at
  // pointer-down pushed a no-op snapshot (and cleared the redo stack) on
  // every click, evicting real states under the 3-deep HISTORY_LIMIT.
  const checkpointPendingRef = useRef(false);
  // One-shot guard so an arrow-to-arrow connection (spec/50) is tracked once
  // per endpoint drag, not on every pointer-move tick. Reset on drag start.
  const arrowConnectTrackedRef = useRef(false);
  // True for the duration of a gesture that edits EXISTING elements
  // (move / resize / rotate / arrow-handle), gating the activity-log
  // emit. Set when the armed checkpoint is flushed on the first real
  // tick; reset on pointer-up. Stays false for arrow creation-on-drag
  // (beginAnchorDrag), which never arms a checkpoint because it already
  // logged an "Added" entry via `commit` — so we don't double-log it.
  const logGestureRef = useRef(false);
  // The undo-marker token of the current gesture's checkpoint, handed
  // to the debounced log so its flush fills the right step.
  const gestureTokenRef = useRef<number | undefined>(undefined);

  // Stash deps on every render so the move-effect always reads
  // fresh values without re-subscribing global pointer listeners.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const { beginDrag, beginAnchorDrag } = useBoxedDragHandlers({
    depsRef,
    setDrag,
    checkpointPendingRef,
  });

  // Shared opening for every arrow-handle drag: refuse to start while a
  // format-painter or group-paste gesture is live, then resolve the
  // target as a typed arrow. Returns the deps snapshot + arrow, or null
  // when the drag shouldn't begin. The setSelectedId / locked / style
  // guards stay per-handler because their order differs between gestures.
  const {
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    addCurvePoint,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useArrowDragHandlers({ depsRef, setDrag, checkpointPendingRef, arrowConnectTrackedRef });

  // Global pointer-move / pointer-up listeners. Attached once per
  // drag-start, torn down when the drag ends. Every fire reads
  // through depsRef so an external state change (zoom, selection,
  // active-tab swap) is reflected without re-attaching.
  useEffect(() => {
    if (!drag) return;
    // Each new gesture starts un-engaged: a body move must cross
    // DRAG_ENGAGE_PX before it nudges anything (see the move branch).
    dragEngagedRef.current = false;
    // Cancel the drag (mirroring onUp's full cleanup: snap dots gone,
    // armed checkpoint + log flag disarmed so they can't leak into the
    // next gesture — once drag is null this effect tears down and onUp
    // never runs for this gesture).
    const cancelDrag = () => {
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
      checkpointPendingRef.current = false;
      logGestureRef.current = false;
      gestureTokenRef.current = undefined;
    };
    // Cancel the drag immediately when a second touch finger lands — that
    // signals a pinch gesture, not a solo drag.
    const onSecondTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !e.isPrimary) {
        cancelDrag();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (depsRef.current.isPinchingRef?.current) {
        cancelDrag();
        return;
      }
      const { activeTab, zoomRef } = depsRef.current;
      // Flush the armed checkpoint on the FIRST real mutation of the
      // gesture (every branch below writes through this `tick`), so a
      // press that never mutates leaves history untouched. After the
      // first flush it's a plain passthrough for the rest of the drag.
      const tick = (mapper: (els: Element[]) => Element[]) => {
        if (checkpointPendingRef.current) {
          // Keep the checkpoint's marker token so the debounced log
          // entry fills THIS gesture's undo step, even if another step
          // lands before the 500ms flush (see lib/entry-history).
          gestureTokenRef.current = depsRef.current.markCheckpoint();
          checkpointPendingRef.current = false;
          // A checkpoint was armed → this is an edit of existing
          // elements, so it earns an activity-log entry. (Arrow
          // creation-on-drag never arms one; it stays out.)
          logGestureRef.current = true;
        }
        depsRef.current.tick(mapper);
        // Re-arm the 500ms debounce on every mutating tick so the entry
        // lands once, after the gesture settles, diffing pre-gesture vs
        // final state. One shared key per drag → distinct gestures stay
        // distinct unless they overlap the window.
        if (logGestureRef.current) {
          depsRef.current.scheduleElementChangeLog('element-drag', {
            fillToken: gestureTokenRef.current,
          });
        }
      };
      // Screen-pixel delta into canvas-coord delta (invert the
      // current zoom).
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;
      // Hold Cmd / Ctrl while dragging to place freely: skip alignment +
      // distribution snapping and its guide lines for this gesture (spec/60).
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
            // Second pass: re-pin connected arrow anchors against
            // the moved positions so an arrow stays visually
            // attached as the user drags. Skipped when the per-
            // user preference (spec/20) is off, in which case
            // anchors stay frozen at whatever the user originally
            // chose. Read through a ref so a mid-drag flip lands
            // on the next pointermove without re-attaching.
            // ?? false mirrors spec/20's opt-in default should the
            // ref somehow be unset.
            const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? false;
            return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
          });
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
          });
          if (!resize) return;
          if (resize.guides !== null) scheduleGuides(resize.guides);
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const next = resize.boundsById.get(el.id);
              return next ? { ...el, ...next } : el;
            }),
          );
        }
        return;
      }

      if (drag.kind === 'arrow-curve') {
        // Snap + offset math live in resolveArrowControlFrame; the base
        // is the chord midpoint captured at gesture start.
        const pointIndex = drag.pointIndex;
        const { offsetDx, offsetDy, guides } = resolveArrowControlFrame({
          els: activeTab.elements,
          arrowId: drag.arrowId,
          baseX: drag.startMidX,
          baseY: drag.startMidY,
          grabDx: drag.grabDx,
          grabDy: drag.grabDy,
          dx,
          dy,
          pointIndex,
        });
        scheduleGuides((depsRef.current.alignmentGuidesRef.current ?? true) ? guides : []);
        tick((els) =>
          els.map((el) => {
            if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
            // Multi-bend: write the dragged control point's slot; otherwise
            // the legacy single bow.
            if (pointIndex != null && el.curvePoints) {
              const next = el.curvePoints.slice();
              if (!next[pointIndex]) return el;
              next[pointIndex] = { dx: offsetDx, dy: offsetDy };
              return { ...el, curvePoints: next };
            }
            return { ...el, curveOffset: { dx: offsetDx, dy: offsetDy } };
          }),
        );
        return;
      }

      if (drag.kind === 'arrow-elbow') {
        // Same shape as arrow-curve, but based at the auto-elbow
        // position captured at gesture start.
        const { offsetDx, offsetDy, guides } = resolveArrowControlFrame({
          els: activeTab.elements,
          arrowId: drag.arrowId,
          baseX: drag.startBaseX,
          baseY: drag.startBaseY,
          grabDx: drag.grabDx,
          grabDy: drag.grabDy,
          dx,
          dy,
          pointIndex: null,
        });
        scheduleGuides((depsRef.current.alignmentGuidesRef.current ?? true) ? guides : []);
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow'
              ? { ...el, elbowOffset: { dx: offsetDx, dy: offsetDy } }
              : el,
          ),
        );
        return;
      }

      if (drag.kind === 'arrow-label') {
        // Projection lives in resolveArrowLabelFrame; null = arrow gone.
        const labelOffset = resolveArrowLabelFrame({
          els: activeTab.elements,
          arrowId: drag.arrowId,
          startAnchorX: drag.startAnchorX,
          startAnchorY: drag.startAnchorY,
          dx,
          dy,
        });
        if (!labelOffset) return;
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow' ? { ...el, labelOffset } : el,
          ),
        );
        return;
      }

      if (drag.kind === 'arrow-translate') {
        // Shift both free endpoints by the same canvas delta from
        // their captured start positions. No anchor / angle snap:
        // the user explicitly chose a fully-floating arrow.
        tick((els) =>
          els.map((el) => {
            if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
            return {
              ...el,
              from: { kind: 'free', x: drag.startFromX + dx, y: drag.startFromY + dy },
              to: { kind: 'free', x: drag.startToX + dx, y: drag.startToY + dy },
            };
          }),
        );
        return;
      }

      // arrow-endpoint: the snap ladder (element anchor > arrow line >
      // angle lock + alignment) lives in resolveArrowEndpointDrag; this
      // handler just feeds it the frame and applies the result.
      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      const { endpoint, guides, snapTargets, arrowConnected } = resolveArrowEndpointDrag({
        cursor,
        elements: depsRef.current.activeTab.elements,
        arrowId: drag.arrowId,
        end: drag.end,
        reposition: drag.reposition === true,
        noSnap,
        guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
      });
      scheduleSnapTargets(snapTargets);
      scheduleGuides(guides);
      if (arrowConnected && !arrowConnectTrackedRef.current) {
        arrowConnectTrackedRef.current = true;
        track('Element', 'Linked', 'ArrowPoint');
      }
      tick((els) =>
        els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        ),
      );
    };
    // Shift-chaining (spec/09 quick-connect): landing a NEW arrow's endpoint
    // with Shift held immediately starts ANOTHER arrow from the same source
    // end, endpoint following the cursor — a hub fans out to several targets
    // in one flow without reopening the ring. Only for freshly drawn arrows
    // (never a reposition of an existing endpoint) whose source is pinned.
    // Returns true when the chain took over the gesture.
    const chainNextArrow = (e: PointerEvent): boolean => {
      if (!e.shiftKey) return false;
      if (drag?.kind !== 'arrow-endpoint' || drag.end !== 'to' || drag.reposition) return false;
      const d = depsRef.current;
      if (d.isReadOnly) return false;
      const placed = d.activeTab.elements.find(
        (el): el is ArrowElement => el.id === drag.arrowId && el.type === 'arrow',
      );
      if (!placed || (placed.from.kind !== 'pinned' && placed.from.kind !== 'pinned-group')) {
        return false;
      }
      const cursor = {
        x: drag.startCanvasX + (e.clientX - drag.startClientX) / d.zoomRef.current,
        y: drag.startCanvasY + (e.clientY - drag.startClientY) / d.zoomRef.current,
      };
      const arrow: ArrowElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: placed.from,
        to: { kind: 'free', x: cursor.x, y: cursor.y },
        ...(placed.strokeColor ? { strokeColor: placed.strokeColor } : {}),
      };
      d.commit((els) => [...els, arrow]);
      d.setSelectedId(arrow.id);
      track('Element', 'Added', 'Arrow');
      setDrag({
        kind: 'arrow-endpoint',
        arrowId: arrow.id,
        end: 'to',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCanvasX: cursor.x,
        startCanvasY: cursor.y,
        following: true,
      });
      return true;
    };
    const onUp = (e: PointerEvent) => {
      const d = depsRef.current;
      // Quick-connect arrow "click to place": if the arrow was started by a
      // click (clickToPlace) and this release ends a gesture that never
      // really moved, don't commit — flip into `following` so the endpoint
      // trails the cursor and the NEXT click (handled in capture below)
      // places it. A real press-drag (moved past the threshold) falls
      // through and commits like any anchor drag.
      if (drag?.kind === 'arrow-endpoint' && drag.clickToPlace && !drag.following) {
        const px = drag.pressClientX ?? drag.startClientX;
        const py = drag.pressClientY ?? drag.startClientY;
        const moved = Math.hypot(e.clientX - px, e.clientY - py) > 6;
        if (!moved) {
          setDrag({ ...drag, clickToPlace: false, following: true });
          return;
        }
      }
      // Follow mode rides THROUGH pointer-ups: after a shift-chained
      // placing click, the release of that same click arrives here with the
      // fresh arrow already following — committing now would land it where
      // it spawned. The gesture ends at the NEXT placing click, not on up.
      if (drag?.kind === 'arrow-endpoint' && drag.following) return;
      // A freshly DRAWN arrow (never a reposition) gets the one-shot
      // collision-avoiding bow (spec/77) as its gesture ends, whether it
      // ends here or chains below. Same commit stream as the drag ticks,
      // so it folds into the gesture's single undo step.
      if (drag?.kind === 'arrow-endpoint' && drag.end === 'to' && !drag.reposition) {
        const arrowId = drag.arrowId;
        d.commit((els) => applyCollisionAvoidance(els, arrowId));
      }
      // Shift-release of a press-drag chains the next arrow (same rule as
      // the placing click below). The landed endpoint is already committed
      // by the drag ticks; close this gesture's bookkeeping and follow on.
      if (drag?.kind === 'arrow-endpoint' && !drag.following && chainNextArrow(e)) {
        scheduleGuides([]);
        scheduleSnapTargets([]);
        checkpointPendingRef.current = false;
        logGestureRef.current = false;
        return;
      }
      // Fold a dragged standalone icon shape into the shape it was
      // released over. Only on a real move (not a click), only when the
      // dragged element is a line-art 'icon' shape, and only when the
      // element directly beneath the cursor (skipping the dragged icon
      // itself) is a non-icon shape. Technology icons (spec/41) reuse the
      // 'icon' shape but are ALWAYS standalone — a coloured brand tile
      // folded beside a shape's text isn't meaningful and the inline-icon
      // renderer only knows line-art prims — so they're excluded here.
      if (drag?.kind === 'boxed' && drag.mode === 'move' && d.onIconElementDroppedOnShape) {
        const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > 4;
        const dragged = d.activeTab.elements.find((el) => el.id === drag.primaryId);
        if (
          moved &&
          dragged &&
          dragged.type === 'shape' &&
          dragged.shape === 'icon' &&
          !isTechIconId(dragged.iconId)
        ) {
          for (const { id, host } of elementHostsAtPoint(e.clientX, e.clientY)) {
            if (id === drag.primaryId) continue;
            // First real element beneath the icon. Fold in only if it's a
            // shape that hosts inline icons (regular shapes — not an icon or
            // a frame); otherwise leave the icon as a plain move, so an icon
            // dropped on a frame lands inside it as a standalone element.
            const target = d.activeTab.elements.find((el) => el.id === id);
            if (target && acceptsInlineIcon(target)) {
              const rect = host.getBoundingClientRect();
              const position = iconDropSide(e.clientX, e.clientY, rect);
              d.onIconElementDroppedOnShape(drag.primaryId, id, position);
            }
            break;
          }
        }
      }
      // Annotations open their note on DOUBLE-click now (handled in
      // BoxedElementView), so a plain click just selects — no note-open here.
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
      // Disarm any checkpoint the gesture never used (a click that
      // selected without moving), so it can't attach to a later one.
      checkpointPendingRef.current = false;
      // Close the log gesture so the next drag starts clean. The
      // pending debounce timer (if any) still flushes the entry; this
      // only stops a later gesture from inheriting this one's "log it"
      // flag. (Cancelling the flush isn't wanted — that's the entry.)
      logGestureRef.current = false;
    };
    // Quick-connect arrow follow mode: the placing click. Captured on the
    // way DOWN (capture phase) so it commits the endpoint and is swallowed
    // before the canvas can read it as a marquee / deselect.
    const onPlaceClick = (e: PointerEvent) => {
      if (!(drag?.kind === 'arrow-endpoint' && drag.following)) return;
      e.preventDefault();
      e.stopPropagation();
      // The landed arrow gets the one-shot collision-avoiding bow
      // (spec/77), same as the press-drag end in onUp above.
      if (drag.end === 'to' && !drag.reposition) {
        const arrowId = drag.arrowId;
        depsRef.current.commit((els) => applyCollisionAvoidance(els, arrowId));
      }
      // The endpoint already tracks the cursor (last pointermove); this
      // click just lands it. Shift chains straight into the next arrow
      // from the same source (spec/09); otherwise clear and end.
      if (chainNextArrow(e)) {
        scheduleGuides([]);
        scheduleSnapTargets([]);
        return;
      }
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
    };
    // Escape aborts the gesture (spec/09). Capture phase + swallow so
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
      // An edit gesture that already mutated (move / resize / rotate /
      // arrow-handle — its armed checkpoint was flushed on the first
      // tick): restore the pre-drag state and discard the step, so the
      // element snaps back to where the grab started and no undo entry
      // is left behind. A press that never moved (checkpoint still
      // armed) or a creation drag (never arms one) just ends the mode.
      if (logGestureRef.current && !checkpointPendingRef.current) {
        depsRef.current.cancelToCheckpoint();
      }
      cancelDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onSecondTouch);
    window.addEventListener('pointerdown', onPlaceClick, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onSecondTouch);
      window.removeEventListener('pointerdown', onPlaceClick, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [drag, scheduleGuides, scheduleSnapTargets]);

  return {
    drag,
    snapGuides,
    distGuides,
    snapTargets,
    beginDrag,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    addCurvePoint,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  };
}
