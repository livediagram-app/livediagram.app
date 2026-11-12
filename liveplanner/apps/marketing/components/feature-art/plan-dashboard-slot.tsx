// The slot a Dashboard tab's feature art (./plan-dashboard-more, ./plan-dashboard-page) draws each
// figure in: its frame, its small caption, and the green a done or rising figure wears.

import type { ReactNode } from 'react';

import { at, MUTED } from './mode-parts';

export const SLOT = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
export const EMERALD = '#10b981';

/** One slot's frame and its small caption. */
export function Slot({
  x,
  y,
  w,
  h,
  label,
  d,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  d?: number;
  children?: ReactNode;
}) {
  return (
    <g
      className={d === undefined ? undefined : 'fa-f-in'}
      style={d === undefined ? undefined : at(d)}
    >
      <rect className={SLOT} x={x} y={y} width={w} height={h} rx="3" strokeWidth="0.7" />
      <text className={MUTED} x={x + 5} y={y + 9} fontSize="5" fontWeight="600" fill="#64748b">
        {label}
      </text>
      {children}
    </g>
  );
}
