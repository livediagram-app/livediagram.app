import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react';
import {
  angledElbow,
  arrowLabelAnchor,
  arrowStyleOf,
  curveAnchorPoints,
  curveControlPoint,
  endpointPosition,
  type ArrowElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { distToSegment } from '@/lib/drag-geometry';
import type { ArrowEnd, DragState } from '@/lib/canvas';
import type { EditorDragDeps } from './useEditorDrag.types';

type ArrowDragHandlerDeps = {
  depsRef: RefObject<EditorDragDeps>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  checkpointPendingRef: RefObject<boolean>;
  arrowConnectTrackedRef: RefObject<boolean>;
};

// The arrow-specific drag gesture starters (translate / endpoint / curve /
// curve-point / elbow / label) plus the curve-point add / delete commits.
// Each resolves the live arrow off depsRef, arms a history checkpoint, and
// sets the drag state the shared move effect in useEditorDrag then advances.
// Split out of useEditorDrag to keep that hook focused on the move loop.
export function useArrowDragHandlers({
  depsRef,
  setDrag,
  checkpointPendingRef,
  arrowConnectTrackedRef,
}: ArrowDragHandlerDeps) {
  const resolveArrowDrag = (arrowId: string) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null || d.formatToolActive) return null;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return null;
    return { d, arrow };
  };

  const beginArrowTranslate = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    if (arrow.from.kind !== 'free' || arrow.to.kind !== 'free') return;
    d.setSelectedId(arrowId);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-translate',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFromX: arrow.from.x,
      startFromY: arrow.from.y,
      startToX: arrow.to.x,
      startToY: arrow.to.y,
    });
  };

  // Where a shift-drag fork's tail sits on the trunk (spec/50): far enough
  // along that the shared trunk dominates and the fork reads as a Y near the
  // head, not a second arrow from the source.
  const FORK_T = 0.7;

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const start = endpointPosition(end === 'from' ? arrow.from : arrow.to, d.activeTab.elements);
    // Shift-drag on the HEAD forks a branch (spec/50): the arrow itself
    // stays put; a NEW arrow starts with its tail connected on this line
    // (~70% along) and its head following the drag — one trunk pointing at
    // several targets instead of parallel near-duplicate arrows. The branch
    // inherits the trunk's line look so the fork reads as one connector.
    if (e.shiftKey && end === 'to') {
      const branch: ArrowElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: { kind: 'on-arrow', arrowId, t: FORK_T },
        to: { kind: 'free', x: start.x, y: start.y },
        ...(arrow.strokeColor ? { strokeColor: arrow.strokeColor } : {}),
        ...(arrow.strokeWidth !== undefined ? { strokeWidth: arrow.strokeWidth } : {}),
        ...(arrow.strokeStyle ? { strokeStyle: arrow.strokeStyle } : {}),
      };
      d.commit((els) => [...els, branch]);
      d.setSelectedId(branch.id);
      track('Element', 'Added', 'Arrow');
      arrowConnectTrackedRef.current = false;
      setDrag({
        kind: 'arrow-endpoint',
        arrowId: branch.id,
        end: 'to',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCanvasX: start.x,
        startCanvasY: start.y,
      });
      return;
    }
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    arrowConnectTrackedRef.current = false;
    setDrag({
      kind: 'arrow-endpoint',
      arrowId,
      end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
      // Repositioning an existing endpoint is a manual correction: if it
      // lands on an anchor, mark it `manual` so auto-rebind leaves it.
      reposition: true,
    });
  };

  const beginArrowCurveDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrowStyleOf(arrow) !== 'curved') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const control = curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-curve',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidX: (from.x + to.x) / 2,
      startMidY: (from.y + to.y) / 2,
      // The cursor isn't always exactly on the control point at
      // grab time (the SVG handle has a 10px hit area). Storing the
      // cursor-to-control delta lets the move handler keep the
      // handle anchored to where the user originally clicked,
      // matching native drag UX.
      grabDx: control.x - (from.x + to.x) / 2,
      grabDy: control.y - (from.y + to.y) / 2,
    });
  };

  // Drag one control point of a multi-bend curve (curvePoints[index]). Same
  // gesture as beginArrowCurveDrag but anchored to that point + tagged with
  // its index so the tick writes back into the array slot.
  const beginArrowCurvePointDrag = (arrowId: string, index: number, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    // Any arrow carrying an explicit point at `index` can have it dragged —
    // curved (smooth spline) or angled (polyline bend) alike. The point's
    // existence is the gate; the style no longer is.
    if (!arrow.curvePoints?.[index]) return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const anchor = curveAnchorPoints(from, to, arrow.curvePoints)[index]!;
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-curve',
      arrowId,
      pointIndex: index,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidX: (from.x + to.x) / 2,
      startMidY: (from.y + to.y) / 2,
      grabDx: anchor.x - (from.x + to.x) / 2,
      grabDy: anchor.y - (from.y + to.y) / 2,
    });
  };

  // Snap a dragged arrow control point against its polyline neighbours + the
  // nearby element edges/centres, so a bend squares up to a right angle or
  // lines up with a shape instead of landing at an arbitrary spot. `pointIndex`
  // selects a multi-bend slot; null is the single bow / the elbow (which line
  // up to the endpoints). The pinned-endpoint elements are excluded so the
  // bend doesn't cling to the box the arrow connects to. Returns the snapped
  // point + the guide lines now in effect (for the alignment overlay).

  // Insert a control point at a clicked canvas position, so clicking an
  // arrow's line adds a bend. Works on ANY arrow style: a straight or angled
  // arrow is switched to a smooth curve at the same time (the user clicked
  // the line to bend it). A curve with an existing bow keeps its shape (the
  // bow is seeded as a point first). The new point lands in the nearest
  // segment of the from -> points -> to polyline so it inserts where clicked.
  const addCurvePoint = (arrowId: string, canvasX: number, canvasY: number) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const els = d.activeTab.elements;
    const from = endpointPosition(arrow.from, els);
    const to = endpointPosition(arrow.to, els);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const currentStyle = arrowStyleOf(arrow);
    // Preserve the arrow's style: an angled arrow gains another bend (stays a
    // polyline), a curved arrow gains a smooth control point. Only a straight
    // arrow has no bend concept, so it becomes a curve. Seed from the existing
    // single bend (bow / elbow) so adding a point doesn't reset the shape.
    const seeded =
      arrow.curvePoints && arrow.curvePoints.length > 0
        ? arrow.curvePoints.slice()
        : currentStyle === 'curved'
          ? (() => {
              const c = curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to);
              return [{ dx: c.x - mx, dy: c.y - my }];
            })()
          : currentStyle === 'angled'
            ? (() => {
                const elb = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
                return [{ dx: elb.x - mx, dy: elb.y - my }];
              })()
            : [];
    const nextStyle = currentStyle === 'straight' ? 'curved' : currentStyle;
    const anchors = [from, ...curveAnchorPoints(from, to, seeded), to];
    // Nearest segment of the anchor polyline → insert index in `seeded`.
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < anchors.length - 1; i++) {
      const dist = distToSegment({ x: canvasX, y: canvasY }, anchors[i]!, anchors[i + 1]!);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    const next = seeded.slice();
    next.splice(best, 0, { dx: canvasX - mx, dy: canvasY - my });
    d.commit((all) =>
      all.map((el) =>
        el.id === arrowId && el.type === 'arrow'
          ? { ...el, arrowStyle: nextStyle, curvePoints: next }
          : el,
      ),
    );
    d.setSelectedId(arrowId);
  };

  // Remove a control point (right-click a point handle). Drops the slot from
  // curvePoints; clearing it back to undefined when the last one goes, so the
  // arrow falls back to its default single bend / straight line.
  const deleteCurvePoint = (arrowId: string, index: number) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (
      arrow.locked === true ||
      d.layerInertIds.has(arrowId) ||
      d.isReadOnly ||
      !arrow.curvePoints?.[index]
    )
      return;
    const remaining = arrow.curvePoints.filter((_, i) => i !== index);
    d.commit((all) =>
      all.map((el) => {
        if (el.id !== arrowId || el.type !== 'arrow') return el;
        if (remaining.length > 0) return { ...el, curvePoints: remaining };
        // Deleting the last bend point leaves nothing to curve through, so the
        // arrow becomes a plain straight line: drop the points AND the curve /
        // elbow bow + the curved/angled style, rather than snapping back to a
        // single-handle bow the user didn't ask for.
        return {
          ...el,
          curvePoints: undefined,
          curveOffset: undefined,
          elbowOffset: undefined,
          arrowStyle: 'straight' as const,
        };
      }),
    );
    d.setSelectedId(arrowId);
  };

  // Elbow-handle drag for angled arrows. Same gesture shape as
  // beginArrowCurveDrag but stores the auto-elbow (the corner the
  // angled-arrow renderer would draw without offset) as the
  // baseline. On move we compute a fresh elbowOffset as
  // `(currentElbow - startBase)`, so the elbow lands wherever the
  // cursor goes and the value is preserved when endpoints later
  // move.
  const beginArrowElbowDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrowStyleOf(arrow) !== 'angled') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const baseElbow = angledElbow(from, to, arrow.from, arrow.to);
    const currentElbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-elbow',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBaseX: baseElbow.x,
      startBaseY: baseElbow.y,
      // Pointer-to-elbow offset at grab time, same trick as
      // beginArrowCurveDrag so the handle tracks the cursor cleanly.
      grabDx: currentElbow.x - baseElbow.x,
      grabDy: currentElbow.y - baseElbow.y,
    });
  };

  // Label drag: the user grabbed an arrow's text label and is sliding
  // it along the line / to either side. We capture the label's current
  // anchor point so the move handler tracks `anchor + pointer delta`
  // and projects it back onto the line into a {t, offset} placement.
  const beginArrowLabelDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.layerInertIds.has(arrowId) || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const anchor = arrowLabelAnchor(
      arrowStyleOf(arrow),
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-label',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startAnchorX: anchor.x,
      startAnchorY: anchor.y,
    });
  };

  return {
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
