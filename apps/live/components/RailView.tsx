'use client';

// Timeline rail (spec/51): a horizontal line with evenly-spaced points above
// it. Rendered inside its boxed element, so move / resize / select / group all
// come for free; the rail just paints the line + dots and, when interactive,
// an "add point" affordance at the right end. The first of a planned family of
// composite "rail" components, so the geometry is kept simple + declarative.

import { RAIL_DEFAULT_POINTS, RAIL_MAX_POINTS, RAIL_MIN_POINTS } from '@livediagram/diagram';
import type { ShapeElement } from '@livediagram/diagram';
import { Tooltip } from './Tooltip';

function clampRail(n: number): number {
  return Math.max(RAIL_MIN_POINTS, Math.min(RAIL_MAX_POINTS, Math.round(n)));
}

// Evenly-spaced x positions across the inset span (first point at the left
// inset, last at the right inset).
function pointXs(count: number, left: number, right: number): number[] {
  if (count <= 1) return [(left + right) / 2];
  const span = right - left;
  return Array.from({ length: count }, (_, i) => left + (span * i) / (count - 1));
}

export function RailView({
  element,
  accent,
  interactive,
  onAddPoint,
}: {
  element: ShapeElement;
  // The rail's accent (its strokeColor); the dots paint in it.
  accent: string;
  // True when the element is selected + editable: reveals the add-point button.
  interactive: boolean;
  onAddPoint?: () => void;
}) {
  const w = Math.max(1, element.width);
  const h = Math.max(1, element.height);
  const count = clampRail(element.railCount ?? RAIL_DEFAULT_POINTS);
  const padX = Math.min(44, w * 0.12);
  const lineY = h * 0.72;
  const dotY = h * 0.36;
  const r = Math.max(5, Math.min(9, h * 0.12));
  const xs = pointXs(count, padX, w - padX);
  const canAdd = interactive && !!onAddPoint && count < RAIL_MAX_POINTS;
  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {/* The rail line. */}
        <line
          x1={padX}
          y1={lineY}
          x2={w - padX}
          y2={lineY}
          stroke="#94a3b8"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {xs.map((x, i) => (
          <g key={i}>
            {/* Tick connecting the dot down to the line. */}
            <line x1={x} y1={dotY + r} x2={x} y2={lineY} stroke="#cbd5e1" strokeWidth={1.5} />
            <circle cx={x} cy={dotY} r={r} fill={accent} />
          </g>
        ))}
      </svg>
      {canAdd ? (
        <Tooltip title="Add point" description="Add another point at the end of the rail.">
          <button
            type="button"
            // Sit just past the right end of the line, on the dot row.
            className="pointer-events-auto absolute flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-brand-300 bg-white text-brand-600 shadow-sm transition hover:bg-brand-50 dark:border-brand-500/50 dark:bg-slate-800 dark:text-brand-200 dark:hover:bg-brand-500/15"
            style={{ right: -12, top: `${(dotY / h) * 100}%`, transform: 'translateY(-50%)' }}
            // Keep the click from starting an element drag / deselecting.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddPoint?.();
            }}
            aria-label="Add rail point"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
