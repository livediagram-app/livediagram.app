'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { pointerLeader, pointerTipOf, type ShapeElement } from '@livedocuments/document';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';

// A pointer note's leader, tip and (while selected) the tip handle (docs/specs/009-elements/pointer-note.md). Drawn
// over the note's ordinary box and label, overflowing it: the leader runs out to the tip. The handle drags the tip in
// element-local coordinates and commits once, on release (the setter snaps it to a host point or leaves it free).
export function PointerNoteOverlay({
  element,
  stroke,
  editable,
  onSetTip,
}: {
  element: ShapeElement;
  stroke: string;
  editable: boolean;
  onSetTip?: (elementId: string, tipAbs: { x: number; y: number }) => void;
}) {
  const zoom = useCanvasZoom();
  // The tip while the handle is being dragged, element-local; null at rest.
  const [dragTip, setDragTip] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; tip: { x: number; y: number } } | null>(null);
  const rest = pointerTipOf(element);
  const tip = dragTip ?? rest;
  const leader = pointerLeader({ ...element, pointerTip: tip });
  const pulsing = element.animation === 'pulse';

  const commit = (t: { x: number; y: number }) =>
    onSetTip?.(element.id, { x: element.x + t.x, y: element.y + t.y });

  const onPointerDown = (e: PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, tip: rest };
    setDragTip(rest);
  };
  const onPointerMove = (e: PointerEvent<SVGCircleElement>) => {
    const s = start.current;
    if (!s) return;
    const z = zoom || 1;
    setDragTip({ x: s.tip.x + (e.clientX - s.px) / z, y: s.tip.y + (e.clientY - s.py) / z });
  };
  const onPointerUp = (e: PointerEvent<SVGCircleElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    e.stopPropagation();
    const z = zoom || 1;
    const t = { x: s.tip.x + (e.clientX - s.px) / z, y: s.tip.y + (e.clientY - s.py) / z };
    setDragTip(null);
    if (t.x !== s.tip.x || t.y !== s.tip.y) commit(t);
  };
  // A drag the browser takes back (a gesture, a lost capture) stores nothing and puts the tip back where it was.
  const onPointerCancel = () => {
    start.current = null;
    setDragTip(null);
  };
  // Arrow keys nudge the tip (Shift for 10 px), committing each press.
  const onKeyDown = (e: KeyboardEvent<SVGCircleElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const d =
      e.key === 'ArrowLeft'
        ? { x: -step, y: 0 }
        : e.key === 'ArrowRight'
          ? { x: step, y: 0 }
          : e.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : e.key === 'ArrowDown'
              ? { x: 0, y: step }
              : null;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    commit({ x: rest.x + d.x, y: rest.y + d.y });
  };

  return (
    <svg
      aria-hidden={!editable}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={element.width}
      height={element.height}
      data-pointer-note=""
    >
      {leader ? (
        <line
          x1={leader.x1}
          y1={leader.y1}
          x2={leader.x2}
          y2={leader.y2}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ) : null}
      {pulsing ? (
        <circle
          className="lvd-pointer-tip-pulse"
          cx={tip.x}
          cy={tip.y}
          r={3.5}
          fill="none"
          stroke={stroke}
          style={{ transformOrigin: `${tip.x}px ${tip.y}px` }}
        />
      ) : null}
      <circle cx={tip.x} cy={tip.y} r={3.5} fill={stroke} data-pointer-tip="" />
      {editable && onSetTip ? (
        <circle
          role="button"
          tabIndex={0}
          aria-label="Move pointer tip"
          className="pointer-events-auto cursor-grab active:cursor-grabbing"
          cx={tip.x}
          cy={tip.y}
          r={6}
          fill="white"
          fillOpacity={0.01}
          stroke={stroke}
          strokeWidth={1.5}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
          onKeyDown={onKeyDown}
        />
      ) : null}
    </svg>
  );
}
