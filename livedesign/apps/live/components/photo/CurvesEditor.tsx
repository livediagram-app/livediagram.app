'use client';

// Curves' own editor (docs/specs/031-photo/photo-adjustments.md "The adjustments" Curves): the curve
// over a grid, its points as handles; a press on the grid adds a point there, a drag moves one, and
// dragging one off the grid removes it (2 to 16 points; the ends stay). The curve drawn is the
// engine's own, so what shows is what applies.
import { useRef, useState, type PointerEvent } from 'react';
import { curveTable } from '@livedesign/photo-engine';

const SIZE = 200;
// How far past the grid a point is dragged to be removed, px.
const REMOVE_PAST = 24;
const MAX_POINTS = 16;

type Pt = [number, number];

export function CurvesEditor({
  points,
  onChange,
}: {
  points: readonly Pt[];
  onChange: (points: Pt[]) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const table = curveTable(
    sorted.length >= 2
      ? sorted
      : [
          [0, 0],
          [255, 255],
        ],
  );
  const path = Array.from(
    { length: 256 },
    (_, i) => `${i === 0 ? 'M' : 'L'}${(i / 255) * SIZE} ${SIZE - (table[i]! / 255) * SIZE}`,
  ).join('');
  const toValue = (e: PointerEvent): { v: Pt; outside: boolean } => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 255;
    const y = 255 - ((e.clientY - r.top) / r.height) * 255;
    const outside =
      e.clientX < r.left - REMOVE_PAST ||
      e.clientX > r.right + REMOVE_PAST ||
      e.clientY < r.top - REMOVE_PAST ||
      e.clientY > r.bottom + REMOVE_PAST;
    return {
      v: [Math.round(Math.min(255, Math.max(0, x))), Math.round(Math.min(255, Math.max(0, y)))],
      outside,
    };
  };
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="aspect-square w-full touch-none rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      role="img"
      aria-label={`Curve with ${sorted.length} points`}
      onPointerDown={(e) => {
        if (e.target !== ref.current || sorted.length >= MAX_POINTS) return;
        const { v } = toValue(e);
        const next = [...sorted, v].sort((a, b) => a[0] - b[0]);
        onChange(next);
        setDragging(next.findIndex((p) => p === v));
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging === null) return;
        const { v, outside } = toValue(e);
        const ends = dragging === 0 || dragging === sorted.length - 1;
        if (outside && !ends && sorted.length > 2) {
          onChange(sorted.filter((_, i) => i !== dragging));
          setDragging(null);
          return;
        }
        // A point stays between its neighbours.
        const lo = dragging > 0 ? sorted[dragging - 1]![0] + 1 : 0;
        const hi = dragging < sorted.length - 1 ? sorted[dragging + 1]![0] - 1 : 255;
        const next = sorted.map((p, i) =>
          i === dragging ? ([Math.min(hi, Math.max(lo, v[0])), v[1]] as Pt) : p,
        );
        onChange(next);
      }}
      onPointerUp={() => setDragging(null)}
    >
      {[1, 2, 3].map((i) => (
        <g key={i} stroke="currentColor" className="text-slate-200 dark:text-slate-700">
          <line x1={(i * SIZE) / 4} y1={0} x2={(i * SIZE) / 4} y2={SIZE} />
          <line x1={0} y1={(i * SIZE) / 4} x2={SIZE} y2={(i * SIZE) / 4} />
        </g>
      ))}
      <line
        x1={0}
        y1={SIZE}
        x2={SIZE}
        y2={0}
        stroke="currentColor"
        strokeDasharray="3 3"
        className="text-slate-300 dark:text-slate-600"
      />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-slate-800 dark:text-slate-100"
      />
      {sorted.map((p, i) => (
        <circle
          key={i}
          cx={(p[0] / 255) * SIZE}
          cy={SIZE - (p[1] / 255) * SIZE}
          r={4.5}
          className="cursor-grab fill-white stroke-brand-600"
          strokeWidth={1.5}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragging(i);
            ref.current!.setPointerCapture(e.pointerId);
          }}
        />
      ))}
    </svg>
  );
}
