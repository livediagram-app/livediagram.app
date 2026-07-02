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
  alignmentGuides,
  distributionSnap,
  arrowStyleOf,
  curveAnchorPoints,
  endpointPosition,
  projectToArrow,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  arrowSnapPoints,
  snapArrowPoint,
  snapResizeBounds,
  snapToAlignment,
  snapToAnchor,
  snapToArrowPoint,
  type AlignmentGuide,
  type ArrowElement,
  type Element,
  type Endpoint,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import {
  ALIGN_SNAP_THRESHOLD,
  ARROW_SNAP_REVEAL_PX,
  ARROW_SNAP_THRESHOLD_PX,
  cornerOf,
  iconDropSide,
  snapModeOf,
  MIN_SIZE,
  nextBounds,
  SNAP_THRESHOLD,
  unionOfBounds,
  unionResizeMember,
  type DragMode,
  type DragState,
} from '@/lib/canvas';
import { elementHostsAtPoint } from '@/lib/dom-hit-test';
import { computeSnapTargets, NO_ALIGN_EXCLUDE } from '@/lib/drag-geometry';
import type { EditorDragDeps, EditorDragApi } from './useEditorDrag.types';
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

// The corner / edge OPPOSITE each resize handle, in element-local sign space
// (±1 per axis from the centre). Used to anchor that point while resizing a
// rotated element so it grows from the dragged side only, not the centre.
const FIXED_SIGN: Partial<Record<DragMode, { sx: number; sy: number }>> = {
  'resize-e': { sx: -1, sy: 0 },
  'resize-w': { sx: 1, sy: 0 },
  'resize-s': { sx: 0, sy: -1 },
  'resize-n': { sx: 0, sy: 1 },
  'resize-se': { sx: -1, sy: -1 },
  'resize-sw': { sx: 1, sy: -1 },
  'resize-ne': { sx: -1, sy: 1 },
  'resize-nw': { sx: 1, sy: 1 },
};

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

  const snapArrowControl = (
    arrowId: string,
    raw: { x: number; y: number },
    pointIndex: number | null | undefined,
  ): { point: { x: number; y: number }; guides: AlignmentGuide[] } => {
    const els = depsRef.current.activeTab.elements;
    const arrow = els.find((e): e is ArrowElement => e.id === arrowId && e.type === 'arrow');
    if (!arrow) return { point: raw, guides: [] };
    const from = endpointPosition(arrow.from, els);
    const to = endpointPosition(arrow.to, els);
    const anchors = arrow.curvePoints ? curveAnchorPoints(from, to, arrow.curvePoints) : [];
    const poly = [from, ...anchors, to];
    // The dragged vertex sits at poly[pointIndex + 1], so its neighbours are
    // poly[pointIndex] and poly[pointIndex + 2]. Filter out any miss: if the
    // point was removed mid-drag the index can fall off the end, and an
    // undefined neighbour would crash snapArrowPoint reading `.x`.
    const neighbours =
      pointIndex != null && arrow.curvePoints
        ? [poly[pointIndex], poly[pointIndex + 2]].filter(
            (p): p is { x: number; y: number } => p != null,
          )
        : [from, to];
    const exclude = new Set<string>();
    if (arrow.from.kind === 'pinned') exclude.add(arrow.from.elementId);
    if (arrow.to.kind === 'pinned') exclude.add(arrow.to.elementId);
    return snapArrowPoint(raw, neighbours, els, ALIGN_SNAP_THRESHOLD, exclude);
  };

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
          // Snap the primary's candidate bounds to align with other
          // elements' edges / centres; apply the same nudge to every
          // group member so they translate together.
          const primaryStart = drag.startBounds.get(drag.primaryId);
          const memberIds = new Set(drag.startBounds.keys());
          let snapDx = 0;
          let snapDy = 0;
          if (primaryStart && !noSnap) {
            const candidate = {
              x: primaryStart.x + dx,
              y: primaryStart.y + dy,
              width: primaryStart.width,
              height: primaryStart.height,
            };
            const snap = snapToAlignment(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            snapDx = snap.dx;
            snapDy = snap.dy;
            // Equal-spacing (distribution) snap fills the axes alignment
            // didn't already claim, so the element lands evenly spaced
            // between / beyond its neighbours. Alignment (edge / centre)
            // wins per axis when both are in range.
            const dist = distributionSnap(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            // Distribution fills only the axes alignment didn't claim.
            // Keyed off snap.snappedX/Y (not snapDx === 0) so an EXACT
            // edge alignment, whose delta is 0, still wins over an
            // equal-spacing nudge that's also in range.
            if (!snap.snappedX) snapDx = dist.dx;
            if (!snap.snappedY) snapDy = dist.dy;
            // Derive guides from the SNAPPED primary bounds so a line
            // only appears once the snap has aligned an edge / centre.
            // Suppressed entirely when the user has turned guides off
            // (the snap above still applies; only the hint is hidden).
            const guidesOn = depsRef.current.alignmentGuidesRef.current ?? true;
            const guides = guidesOn
              ? alignmentGuides(
                  { ...candidate, x: candidate.x + snapDx, y: candidate.y + snapDy },
                  activeTab.elements,
                  memberIds,
                )
              : [];
            // Distribution guides only for the axis distribution actually
            // drove (alignment didn't already claim it).
            const distOut = guidesOn
              ? dist.guides.filter((g) =>
                  g.axis === 'x'
                    ? !snap.snappedX && dist.dx !== 0
                    : !snap.snappedY && dist.dy !== 0,
                )
              : [];
            scheduleGuides(guides, distOut);
          } else {
            scheduleGuides([]);
          }
          tick((els) => {
            // First pass: translate every dragged boxed element, and the
            // FREE endpoints of any arrows pulled into a frame-section move
            // (pinned ends are left for the rebind pass below).
            const moved = els.map((el) => {
              if (isBoxed(el)) {
                const start = drag.startBounds.get(el.id);
                if (!start) return el;
                return { ...el, x: start.x + dx + snapDx, y: start.y + dy + snapDy };
              }
              if (el.type === 'arrow') {
                const ends = drag.startArrowEnds.get(el.id);
                if (!ends) return el;
                const next = { ...el };
                if (ends.from && el.from.kind === 'free') {
                  next.from = {
                    kind: 'free',
                    x: ends.from.x + dx + snapDx,
                    y: ends.from.y + dy + snapDy,
                  };
                }
                if (ends.to && el.to.kind === 'free') {
                  next.to = {
                    kind: 'free',
                    x: ends.to.x + dx + snapDx,
                    y: ends.to.y + dy + snapDy,
                  };
                }
                return next;
              }
              return el;
            });
            // Second pass: re-pin connected arrow anchors against
            // the moved positions so an arrow stays visually
            // attached as the user drags. Skipped when the per-
            // user preference (spec/20) is off, in which case
            // anchors stay frozen at whatever the user originally
            // chose. Read through a ref so a mid-drag flip lands
            // on the next pointermove without re-attaching.
            const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? true;
            return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
          });
        } else {
          // Resize branch handles BOTH single-element and group /
          // multi resizes uniformly:
          // - Single member: scale the lone member directly via
          //   nextBounds (the original behaviour, snapping included).
          // - Multiple members: compute a UNION start box, scale
          //   that as if it were one element, then map every member
          //   through the same proportional scale around the anchor
          //   (corner opposite the drag handle).
          const corner = cornerOf(drag.mode);
          // Corner OR single edge — so edge resizes snap + dimension-match
          // on their axis (multi-member scaling below stays corner-only).
          const snapMode = snapModeOf(drag.mode);
          const memberIds = new Set(drag.startBounds.keys());

          // Shift-held during resize is the standard "constrain
          // aspect" modifier (Figma, Photoshop, Illustrator). It
          // works on top of the per-element aspectLocked toggle: a
          // shape with the toggle off honours the shift; a shape
          // with the toggle on stays locked regardless.
          const constrain = drag.aspectLocked || e.shiftKey;
          if (drag.startBounds.size <= 1) {
            const start = drag.startBounds.get(drag.primaryId);
            if (!start) return;
            const primary = activeTab.elements.find((el) => el.id === drag.primaryId);
            const rotation = (primary && isBoxed(primary) ? primary.rotation : 0) ?? 0;
            if (rotation) {
              // Rotated: project the screen drag into the element's local
              // (unrotated) frame so the size changes along its own axes,
              // then keep the edge / corner OPPOSITE the handle visually
              // fixed — so it grows from the dragged side only, not the
              // centre. (Axis-aligned snapping doesn't apply to a rotated
              // box.) FIXED_SIGN points at that opposite anchor in local
              // coords (±half-width, ±half-height).
              const r = (rotation * Math.PI) / 180;
              const cos = Math.cos(r);
              const sin = Math.sin(r);
              const dxl = dx * cos + dy * sin;
              const dyl = -dx * sin + dy * cos;
              const sized = nextBounds(start, drag.mode, dxl, dyl, constrain);
              const sign = FIXED_SIGN[drag.mode] ?? { sx: 0, sy: 0 };
              const cx0 = start.x + start.width / 2;
              const cy0 = start.y + start.height / 2;
              // World position of the fixed anchor before the resize.
              const ax0 = (sign.sx * start.width) / 2;
              const ay0 = (sign.sy * start.height) / 2;
              const anchorX = cx0 + (ax0 * cos - ay0 * sin);
              const anchorY = cy0 + (ax0 * sin + ay0 * cos);
              // Same anchor after the resize, relative to the new centre.
              const ax1 = (sign.sx * sized.width) / 2;
              const ay1 = (sign.sy * sized.height) / 2;
              const cx1 = anchorX - (ax1 * cos - ay1 * sin);
              const cy1 = anchorY - (ax1 * sin + ay1 * cos);
              const next = {
                x: cx1 - sized.width / 2,
                y: cy1 - sized.height / 2,
                width: sized.width,
                height: sized.height,
              };
              scheduleGuides([]);
              tick((els) =>
                els.map((el) =>
                  el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el,
                ),
              );
              return;
            }
            const raw = nextBounds(start, drag.mode, dx, dy, constrain);
            const next =
              !constrain && snapMode
                ? snapResizeBounds(
                    raw,
                    snapMode,
                    activeTab.elements,
                    memberIds,
                    ALIGN_SNAP_THRESHOLD,
                    MIN_SIZE,
                  )
                : raw;
            // Guide off the snapped bounds (same rationale as move). A
            // constrained resize skips the snap, so guides only appear
            // when an edge / centre genuinely lines up. Suppressed when
            // the user has turned alignment guides off.
            const guides =
              (depsRef.current.alignmentGuidesRef.current ?? true)
                ? alignmentGuides(next, activeTab.elements, memberIds)
                : [];
            scheduleGuides(guides);
            tick((els) =>
              els.map((el) => (el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el)),
            );
            return;
          }

          // Multi-member resize: derive union bounds, run them
          // through nextBounds, and scale every member around the
          // anchor (corner opposite the drag handle). Aspect-lock is
          // forced on if ANY member is aspect-locked so locked
          // figures (e.g. the actor) don't get warped by an
          // unevenly-dragged corner. Snap is skipped for multi-
          // resize because the primary's edges aren't load-bearing
          // here: snapping one member's edge would push the whole
          // group around in ways the user didn't ask for.
          const unionStart = unionOfBounds(drag.startBounds.values());
          if (!unionStart || !corner) return;
          const anyAspectLocked = activeTab.elements.some(
            (el) => isBoxed(el) && drag.startBounds.has(el.id) && el.aspectLocked === true,
          );
          // Shift-held forces constrain for multi-resize too, on
          // top of the per-element flags. Any aspect-locked member
          // already forces constrain to avoid warping (e.g. an
          // actor inside the selection) so this just adds the
          // user's modifier-key opt-in for unlocked selections.
          const unionNext = nextBounds(
            unionStart,
            drag.mode,
            dx,
            dy,
            drag.aspectLocked || anyAspectLocked || e.shiftKey,
          );
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, ...unionResizeMember(start, unionStart, unionNext, corner) };
            }),
          );
        }
        return;
      }

      if (drag.kind === 'arrow-curve') {
        // The control point should sit at `pointer + grab`, where
        // grab is the pointer-to-control delta we captured on
        // gesture start. Translating that into a curveOffset means
        // subtracting the chord midpoint (also captured at start so
        // a concurrent endpoint move doesn't yank the curve).
        const rawX = drag.startMidX + drag.grabDx + dx;
        const rawY = drag.startMidY + drag.grabDy + dy;
        const pointIndex = drag.pointIndex;
        const { point: snapped, guides } = snapArrowControl(
          drag.arrowId,
          { x: rawX, y: rawY },
          pointIndex,
        );
        const offsetDx = snapped.x - drag.startMidX;
        const offsetDy = snapped.y - drag.startMidY;
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
        // Same shape as arrow-curve, but for the angled-arrow elbow
        // handle. The new elbow sits at `pointer + grab` (where
        // grab is the cursor-to-elbow delta at gesture start), and
        // we store it as a delta from the auto-elbow position so
        // the bend survives concurrent endpoint moves the same way
        // the curveOffset does.
        const rawX = drag.startBaseX + drag.grabDx + dx;
        const rawY = drag.startBaseY + drag.grabDy + dy;
        const { point: snapped, guides } = snapArrowControl(
          drag.arrowId,
          { x: rawX, y: rawY },
          null,
        );
        const offsetDx = snapped.x - drag.startBaseX;
        const offsetDy = snapped.y - drag.startBaseY;
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
        // The dragged point is the label's grab-time anchor plus the
        // pointer delta; project it onto the line to get the new
        // {t, offset} placement (stays attached to the line, either
        // side). Resolve endpoints fresh so it survives endpoint moves.
        const arrow = activeTab.elements.find((el) => el.id === drag.arrowId);
        if (!arrow || arrow.type !== 'arrow') return;
        const from = endpointPosition(arrow.from, activeTab.elements);
        const to = endpointPosition(arrow.to, activeTab.elements);
        const point = { x: drag.startAnchorX + dx, y: drag.startAnchorY + dy };
        const labelOffset = projectToArrow(
          arrowStyleOf(arrow),
          from,
          to,
          arrow.from,
          arrow.to,
          arrow.curveOffset,
          arrow.elbowOffset,
          point,
          arrow.curvePoints,
        );
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

      // arrow-endpoint: pin to an anchor if the cursor is close,
      // otherwise free + optional 45-degree angle snap from the
      // other endpoint.
      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      const els0 = depsRef.current.activeTab.elements;
      // Element anchor wins over angle / alignment snap: pinning to
      // another shape is the strongest constraint and the most desirable
      // outcome when both are plausible.
      const anchorSnap = snapToAnchor(cursor, els0, SNAP_THRESHOLD);
      // No element anchor nearby → look for a nearby arrow line to connect to
      // (spec/50). REVEAL distance shows the line's snap dots as you approach;
      // the tighter SNAP distance actually connects. Element anchors win.
      const arrowHit = anchorSnap
        ? null
        : snapToArrowPoint(cursor, els0, ARROW_SNAP_REVEAL_PX, drag.arrowId);
      const arrowSnap = arrowHit && arrowHit.dist <= ARROW_SNAP_THRESHOLD_PX ? arrowHit : null;
      // Reveal the connection points of nearby shapes + arrows so the user can
      // see where the endpoint will snap, highlighting the active one.
      const targets = computeSnapTargets(
        cursor,
        els0,
        anchorSnap?.elementId ?? null,
        anchorSnap?.anchor ?? null,
      );
      if (arrowHit) {
        const targetArrow = els0.find((e) => e.id === arrowHit.arrowId && e.type === 'arrow') as
          | ArrowElement
          | undefined;
        if (targetArrow) {
          for (const sp of arrowSnapPoints(targetArrow, els0)) {
            targets.push({
              x: sp.x,
              y: sp.y,
              active: !!arrowSnap && Math.abs(sp.t - arrowHit.t) < 1e-6,
            });
          }
        }
      }
      scheduleSnapTargets(targets);
      let endpoint: Endpoint;
      if (anchorSnap) {
        endpoint = {
          kind: 'pinned',
          elementId: anchorSnap.elementId,
          anchor: anchorSnap.anchor,
          // A hand-repositioned endpoint that lands on an anchor is a manual
          // override; auto-rebind then leaves this end's face alone.
          ...(drag.reposition ? { manual: true } : {}),
        };
        scheduleGuides([]);
      } else if (arrowSnap) {
        // Connect to a point along the target arrow's line; it resolves
        // dynamically so it tracks the target as it moves (spec/50).
        endpoint = { kind: 'on-arrow', arrowId: arrowSnap.arrowId, t: arrowSnap.t };
        if (!arrowConnectTrackedRef.current) {
          arrowConnectTrackedRef.current = true;
          track('Element', 'Linked', 'ArrowPoint');
        }
        scheduleGuides([]);
      } else {
        // Angle snap: lock the arrow to 45-degree increments from its
        // other endpoint when the cursor is within ~5 degrees of one.
        // Keeps right-angle connectors easy to draw without fighting the
        // cursor at oblique angles.
        const arrow = els0.find((e) => e.id === drag.arrowId && e.type === 'arrow') as
          | ArrowElement
          | undefined;
        let resolved = cursor;
        let angleLocked = false;
        let other: { x: number; y: number } | null = null;
        if (arrow) {
          const otherKey = drag.end === 'from' ? 'to' : 'from';
          other = endpointPosition(arrow[otherKey], els0);
          const ax = cursor.x - other.x;
          const ay = cursor.y - other.y;
          const len = Math.hypot(ax, ay);
          if (len > 0) {
            const angle = Math.atan2(ay, ax);
            const STEP = Math.PI / 4;
            const THRESH = (5 * Math.PI) / 180;
            const nearest = Math.round(angle / STEP) * STEP;
            if (Math.abs(angle - nearest) <= THRESH) {
              resolved = {
                x: other.x + Math.cos(nearest) * len,
                y: other.y + Math.sin(nearest) * len,
              };
              angleLocked = true;
            }
          }
        }
        // Alignment snapping for the free endpoint (skipped once the 45°
        // angle lock already constrains it): nudge the point to line up
        // with nearby boxed elements' edges / centres AND with the arrow's
        // OTHER endpoint (so it clicks into a perfectly horizontal /
        // vertical line), showing the same faint guides a boxed move does.
        const guidesOn = depsRef.current.alignmentGuidesRef.current ?? true;
        if (!angleLocked && !noSnap) {
          const boxSnap = snapToAlignment(
            { x: resolved.x, y: resolved.y, width: 0, height: 0 },
            els0,
            NO_ALIGN_EXCLUDE,
            ALIGN_SNAP_THRESHOLD,
          );
          resolved = { x: resolved.x + boxSnap.dx, y: resolved.y + boxSnap.dy };
          const extraGuides: AlignmentGuide[] = [];
          // Endpoint-to-other-endpoint alignment fills the axes the box
          // snap didn't claim, so a near-straight arrow latches truly
          // straight with a guide spanning the two ends.
          if (other) {
            if (!boxSnap.snappedX && Math.abs(resolved.x - other.x) <= ALIGN_SNAP_THRESHOLD) {
              resolved = { x: other.x, y: resolved.y };
              extraGuides.push({
                axis: 'x',
                position: other.x,
                start: Math.min(other.y, resolved.y),
                end: Math.max(other.y, resolved.y),
              });
            }
            if (!boxSnap.snappedY && Math.abs(resolved.y - other.y) <= ALIGN_SNAP_THRESHOLD) {
              resolved = { x: resolved.x, y: other.y };
              extraGuides.push({
                axis: 'y',
                position: other.y,
                start: Math.min(other.x, resolved.x),
                end: Math.max(other.x, resolved.x),
              });
            }
          }
          const boxGuides = guidesOn
            ? alignmentGuides(
                { x: resolved.x, y: resolved.y, width: 0, height: 0 },
                els0,
                NO_ALIGN_EXCLUDE,
              )
            : [];
          scheduleGuides(guidesOn ? [...boxGuides, ...extraGuides] : []);
        } else {
          scheduleGuides([]);
        }
        endpoint = { kind: 'free', x: resolved.x, y: resolved.y };
      }
      tick((els) =>
        els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        ),
      );
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
      // The endpoint already tracks the cursor (last pointermove); this
      // click just lands it. Clear guides and end the gesture.
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
    };
    // Escape cancels follow mode, removing the half-drawn arrow.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!(drag?.kind === 'arrow-endpoint' && drag.following)) return;
      const arrowId = drag.arrowId;
      depsRef.current.commit((els) => els.filter((el) => el.id !== arrowId));
      depsRef.current.setSelectedId(null);
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onSecondTouch);
    window.addEventListener('pointerdown', onPlaceClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onSecondTouch);
      window.removeEventListener('pointerdown', onPlaceClick, true);
      window.removeEventListener('keydown', onKey);
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
