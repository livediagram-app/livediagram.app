import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ArrowElement } from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';
import { AddPointHandle, CurveHandle, EndpointHandle } from './arrow-handles';

// The selected arrow's handle layer (spec/09), lifted out of ArrowView:
// the two endpoint grips, the single-bow curve handle, the multi-bend
// control points (right-click deletes), the "+" add-point handles at
// each segment midpoint, and the angled-arrow elbow handle. ArrowView
// mounts it only while the arrow is selected in an editing session; the
// geometry (resolved endpoints, curve anchors / control, elbow point)
// comes computed from the view so the two never disagree.
export function SelectedArrowHandles({
  arrow,
  from,
  to,
  curveControl,
  curveAnchors,
  elbowPoint,
  isLocked,
  onBeginEndpointDrag,
  onBeginCurveDrag,
  onBeginCurvePointDrag,
  onAddCurvePoint,
  onDeleteCurvePoint,
  onBeginElbowDrag,
}: {
  arrow: ArrowElement;
  from: { x: number; y: number };
  to: { x: number; y: number };
  curveControl: { x: number; y: number } | null;
  curveAnchors: { x: number; y: number }[] | null;
  elbowPoint: { x: number; y: number } | null;
  isLocked: boolean;
  onBeginEndpointDrag: (id: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginCurveDrag?: (id: string, e: ReactPointerEvent) => void;
  onBeginCurvePointDrag?: (id: string, index: number, e: ReactPointerEvent) => void;
  onAddCurvePoint?: (id: string, canvasX: number, canvasY: number) => void;
  onDeleteCurvePoint?: (id: string, index: number) => void;
  onBeginElbowDrag?: (id: string, e: ReactPointerEvent) => void;
}) {
  return (
    <>
      <EndpointHandle
        cx={from.x}
        cy={from.y}
        pinned={arrow.from.kind !== 'free'}
        disabled={isLocked}
        onPointerDown={(e) => {
          if (isLocked) return;
          e.stopPropagation();
          onBeginEndpointDrag(arrow.id, 'from', e);
        }}
      />
      <EndpointHandle
        cx={to.x}
        cy={to.y}
        pinned={arrow.to.kind !== 'free'}
        disabled={isLocked}
        onPointerDown={(e) => {
          if (isLocked) return;
          e.stopPropagation();
          onBeginEndpointDrag(arrow.id, 'to', e);
        }}
      />
      {curveControl && onBeginCurveDrag ? (
        <CurveHandle
          cx={curveControl.x}
          cy={curveControl.y}
          disabled={isLocked}
          onPointerDown={(e) => {
            if (isLocked) return;
            e.stopPropagation();
            onBeginCurveDrag(arrow.id, e);
          }}
        />
      ) : null}
      {curveAnchors && onBeginCurvePointDrag
        ? curveAnchors.map((a, i) => (
            <CurveHandle
              key={i}
              cx={a.x}
              cy={a.y}
              disabled={isLocked}
              onPointerDown={(e) => {
                // Primary button only. A right-click must fall through to
                // onContextMenu (delete this point) WITHOUT arming a drag:
                // arming one and then deleting the point on the same press
                // leaves the drag pointing at a now-missing index, which
                // crashes the snap maths on the next move.
                if (isLocked || e.button !== 0) return;
                e.stopPropagation();
                onBeginCurvePointDrag(arrow.id, i, e);
              }}
              onContextMenu={
                isLocked || !onDeleteCurvePoint
                  ? undefined
                  : (e) => {
                      // Right-click a control point to delete it.
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteCurvePoint(arrow.id, i);
                    }
              }
            />
          ))
        : null}
      {/* "+" handles at each segment midpoint: a deliberate target for
          adding a control point (so points aren't added by an accidental
          line click). Hidden while locked / when no add handler. */}
      {onAddCurvePoint && !isLocked
        ? (() => {
            const poly = [from, ...(curveAnchors ?? []), to];
            return poly.slice(0, -1).map((p, i) => {
              const q = poly[i + 1]!;
              const mx = (p.x + q.x) / 2;
              const my = (p.y + q.y) / 2;
              return (
                <AddPointHandle
                  key={`add-${i}`}
                  cx={mx}
                  cy={my}
                  onAdd={(e) => {
                    e.stopPropagation();
                    onAddCurvePoint(arrow.id, mx, my);
                  }}
                />
              );
            });
          })()
        : null}
      {elbowPoint && onBeginElbowDrag ? (
        // Angled-arrow elbow handle. Same affordance as the
        // curve handle (white square, brand-600 outline) so the
        // two read as siblings: each one bends its respective
        // arrow style. Sits exactly on the elbow point.
        <CurveHandle
          cx={elbowPoint.x}
          cy={elbowPoint.y}
          disabled={isLocked}
          onPointerDown={(e) => {
            if (isLocked) return;
            e.stopPropagation();
            onBeginElbowDrag(arrow.id, e);
          }}
        />
      ) : null}
    </>
  );
}
