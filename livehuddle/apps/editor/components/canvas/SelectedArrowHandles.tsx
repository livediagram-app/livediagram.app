import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ArrowElement } from '@livehuddle/document';
import type { ArrowEnd } from '@/lib/canvas';
import {
  CurveHandle,
  EndpointHandle,
} from '@liveworkspace/workbench/components/canvas/arrow-handles';

// The selected arrow's handle layer (docs/specs/008-canvas/canvas-and-palette.md), lifted out of ArrowView:
// the two endpoint grips, the single-bow curve handle, the multi-bend
// control points (right-click deletes) and the angled-arrow elbow handle.
// Bends are added by dragging the line itself (docs/specs/008-canvas/arrow-bending.md), so there
// are no "+" handles. Every press first passes `guardPress`: the second press
// of a double-click must edit the arrow, never operate a handle the first
// press revealed. ArrowView mounts this only while the arrow is selected in an
// editing session; the geometry comes computed from the view so the two never
// disagree.
export function SelectedArrowHandles({
  arrow,
  from,
  to,
  curveControl,
  curveAnchors,
  elbowPoint,
  guardPress,
  onBeginEndpointDrag,
  onBeginCurveDrag,
  onBeginCurvePointDrag,
  onDeleteCurvePoint,
  onBeginElbowDrag,
}: {
  arrow: ArrowElement;
  from: { x: number; y: number };
  to: { x: number; y: number };
  curveControl: { x: number; y: number } | null;
  curveAnchors: { x: number; y: number }[] | null;
  elbowPoint: { x: number; y: number } | null;
  // Records the press; true when it was consumed as a double-press.
  guardPress: (e: ReactPointerEvent) => boolean;
  onBeginEndpointDrag: (id: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginCurveDrag?: (id: string, e: ReactPointerEvent) => void;
  onBeginCurvePointDrag?: (id: string, index: number, e: ReactPointerEvent) => void;
  onDeleteCurvePoint?: (id: string, index: number) => void;
  onBeginElbowDrag?: (id: string, e: ReactPointerEvent) => void;
}) {
  // Primary button only, and not the second half of a double.
  const pressed = (e: ReactPointerEvent): boolean => {
    if (e.button !== 0) return false;
    e.stopPropagation();
    return !guardPress(e);
  };
  return (
    <>
      <EndpointHandle
        disabled={false}
        cx={from.x}
        cy={from.y}
        pinned={arrow.from.kind !== 'free'}
        onPointerDown={(e) => {
          if (pressed(e)) onBeginEndpointDrag(arrow.id, 'from', e);
        }}
      />
      <EndpointHandle
        disabled={false}
        cx={to.x}
        cy={to.y}
        pinned={arrow.to.kind !== 'free'}
        onPointerDown={(e) => {
          if (pressed(e)) onBeginEndpointDrag(arrow.id, 'to', e);
        }}
      />
      {curveControl && onBeginCurveDrag ? (
        <CurveHandle
          disabled={false}
          cx={curveControl.x}
          cy={curveControl.y}
          onPointerDown={(e) => {
            if (pressed(e)) onBeginCurveDrag(arrow.id, e);
          }}
        />
      ) : null}
      {curveAnchors && onBeginCurvePointDrag
        ? curveAnchors.map((a, i) => (
            <CurveHandle
              disabled={false}
              key={i}
              cx={a.x}
              cy={a.y}
              onPointerDown={(e) => {
                // A right-click must fall through to onContextMenu (delete
                // this point) WITHOUT arming a drag: arming one and then
                // deleting the point on the same press leaves the drag
                // pointing at a now-missing index, which crashes the snap
                // maths on the next move. `pressed` ignores it.
                if (pressed(e)) onBeginCurvePointDrag(arrow.id, i, e);
              }}
              onContextMenu={
                onDeleteCurvePoint
                  ? (e) => {
                      // Right-click a control point to delete it.
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteCurvePoint(arrow.id, i);
                    }
                  : undefined
              }
            />
          ))
        : null}
      {elbowPoint && onBeginElbowDrag ? (
        // Angled-arrow elbow handle. Same affordance as the curve handle
        // (white square, brand-600 outline) so the two read as siblings: each
        // one bends its respective arrow style. Sits exactly on the elbow.
        <CurveHandle
          disabled={false}
          cx={elbowPoint.x}
          cy={elbowPoint.y}
          onPointerDown={(e) => {
            if (pressed(e)) onBeginElbowDrag(arrow.id, e);
          }}
        />
      ) : null}
    </>
  );
}
