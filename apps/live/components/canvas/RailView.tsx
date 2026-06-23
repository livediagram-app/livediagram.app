'use client';

// Timeline rail (spec/51): a horizontal line with evenly-spaced points, an
// editable label above each point, rendered inside its boxed element so move /
// resize / select / group all come for free. Adding points is offered from the
// element's standard quick-connect "+" (QuickConnectRing), so the rail draws no
// competing on-canvas button. The first of a planned family of composite "rail"
// components, so the geometry stays simple + declarative.

import { useEffect, useState } from 'react';
import { RAIL_DEFAULT_POINTS } from '@livediagram/diagram';
import type { ShapeElement } from '@livediagram/diagram';

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
  textColor,
  fontFamily,
  editable,
  onSetLabel,
}: {
  element: ShapeElement;
  // The rail's accent (its strokeColor); the dots paint in it.
  accent: string;
  textColor: string;
  fontFamily?: string;
  // True when selected + editable: the per-point labels become editable.
  editable: boolean;
  onSetLabel?: (elementId: string, index: number, text: string) => void;
}) {
  const w = Math.max(1, element.width);
  const h = Math.max(1, element.height);
  const count = Math.max(1, Math.round(element.railCount ?? RAIL_DEFAULT_POINTS));
  const labels = element.railLabels ?? [];
  const padX = Math.min(44, w * 0.12);
  const labelTop = h * 0.06;
  const labelH = h * 0.36;
  const dotY = h * 0.58;
  const lineY = h * 0.82;
  const r = Math.max(5, Math.min(9, h * 0.1));
  const xs = pointXs(count, padX, w - padX);
  const slotW = count > 1 ? ((w - 2 * padX) / (count - 1)) * 0.92 : w * 0.7;
  const fontSize = Math.max(10, Math.min(16, h * 0.16));
  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
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
            <line x1={x} y1={dotY + r} x2={x} y2={lineY} stroke="#cbd5e1" strokeWidth={1.5} />
            <circle cx={x} cy={dotY} r={r} fill={accent} />
          </g>
        ))}
      </svg>
      {/* One editable label per point, above the dot. */}
      {xs.map((x, i) => (
        <RailLabel
          key={i}
          value={labels[i] ?? ''}
          editable={editable && !!onSetLabel}
          onCommit={(text) => onSetLabel?.(element.id, i, text)}
          style={{
            position: 'absolute',
            left: `${(x / w) * 100}%`,
            top: labelTop,
            width: slotW,
            height: labelH,
            transform: 'translateX(-50%)',
            color: textColor,
            fontFamily,
            fontSize,
          }}
        />
      ))}
    </div>
  );
}

// One point's label. Local draft while editing, committed on blur / Enter (one
// undo step). Re-seeds from the prop when it changes externally (e.g. undo) —
// safe because we only commit on blur, so `value` is stable while typing.
function RailLabel({
  value,
  editable,
  onCommit,
  style,
}: {
  value: string;
  editable: boolean;
  onCommit: (text: string) => void;
  style: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editable) {
    return (
      <div
        className="pointer-events-none flex items-end justify-center overflow-hidden text-center font-medium leading-tight"
        style={style}
        aria-hidden
      >
        <span className="line-clamp-2 break-words">{value}</span>
      </div>
    );
  }
  return (
    <textarea
      className="pointer-events-auto resize-none rounded border border-transparent bg-transparent text-center font-medium leading-tight outline-none transition focus:border-brand-300 focus:bg-white/80 dark:focus:bg-slate-900/70"
      style={style}
      value={draft}
      placeholder="Label"
      rows={2}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
