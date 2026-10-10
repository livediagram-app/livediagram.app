// Shared marks for the richer feature-card scenes (content.tsx, structure.tsx, motion.tsx): the
// scene's SVG surface, the editor's chrome surfaces, a teammate's cursor and a text caret. Each
// scene reads finished at rest and moves only an accent (fa-d-* in app/feature-art/content.css),
// so any moment of the loop is a good picture, in light and in dark.

import type { CSSProperties, ReactNode } from 'react';

// Every scene is drawn in this box: the card's art strip is about three times wider than tall.
const VIEWBOX = '0 0 300 96';

// The editor's floating chrome (a picker, a toolbar, a panel): white on light, slate on dark.
export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
export const SHADOW =
  '[filter:drop-shadow(0_1px_1.5px_rgb(15_23_42/0.10))] dark:[filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.45))]';
export const TEXT_STRONG = 'fill-slate-800 dark:fill-slate-100';
export const TEXT_BODY = 'fill-slate-600 dark:fill-slate-300';
export const TEXT_MUTED = 'fill-slate-400 dark:fill-slate-500';
export const HAIRLINE = 'stroke-slate-200 dark:stroke-slate-700';

// An unpainted canvas element: the Default scheme's ink, light or dark with the appearance.
export const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
export const INK_TEXT = 'fill-(--art-ink-text)';
export const INK_SHADE = 'fill-(--art-ink-shade)';
export const ARROW = 'stroke-(--art-arrow)';

// The selection the editor draws round what you picked, and its corner handles.
export const SELECT = 'stroke-brand-500 dark:stroke-brand-400';

export function Scene({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox={VIEWBOX}
      className="absolute inset-0 h-full w-full"
      fontFamily="inherit"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// A selection box with the editor's four corner handles.
export function Selection({
  x,
  y,
  w,
  h,
  className = '',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <rect className={SELECT} x={x} y={y} width={w} height={h} fill="none" strokeWidth="1" />
      {[
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([cx, cy]) => (
        <rect
          key={`${cx}-${cy}`}
          className={`fill-white dark:fill-slate-900 ${SELECT}`}
          x={cx! - 2}
          y={cy! - 2}
          width="4"
          height="4"
          rx="0.8"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

// A teammate's cursor with their name: drawn where it ends up, gliding in from (fx, fy) away.
export function Cursor({
  x,
  y,
  color,
  name,
  fx = 0,
  fy = 0,
  delay = '0s',
}: {
  x: number;
  y: number;
  color: string;
  name: string;
  fx?: number;
  fy?: number;
  delay?: string;
}) {
  const moving = fx !== 0 || fy !== 0;
  return (
    <g
      className={moving ? 'fa-d-move' : undefined}
      style={
        moving
          ? ({ '--fx': `${fx}px`, '--fy': `${fy}px`, animationDelay: delay } as CSSProperties)
          : undefined
      }
    >
      <g transform={`translate(${x} ${y})`}>
        <path
          d="M0 0 L0 9.5 L2.7 7 L4.6 10.9 L6.1 10.2 L4.2 6.4 L7.8 6.4 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <rect x="6.5" y="10" width={name.length * 3.6 + 6} height="8" rx="2" fill={color} />
        <text x="9.5" y="15.9" fontSize="5.6" fontWeight="600" fill="#fff">
          {name}
        </text>
      </g>
    </g>
  );
}

// A blinking text caret.
export function Caret({ x, y, h = 9 }: { x: number; y: number; h?: number }) {
  return (
    <rect
      className="fa-d-blink fill-brand-500 dark:fill-brand-400"
      x={x}
      y={y}
      width="0.9"
      height={h}
    />
  );
}
