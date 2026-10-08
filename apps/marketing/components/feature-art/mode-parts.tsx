// Shared parts for the mode categories' card art (whiteboard.tsx, plan.tsx, documents.tsx):
// the editor's surfaces drawn small, on a 300 by 96 stage (one unit is one CSS pixel in the
// card's 96px Frame). Every surface has a light and a dark half, through Tailwind's dark:
// variants and the canvas palette (--art-*), with the light value restated as the SVG attribute
// underneath. Motion comes from the fa-f-* loops (app/feature-art-animations.css, the whiteboard, Plan and documents block).

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from './shared';

export const FONT = 'ui-sans-serif, system-ui, sans-serif';
export { SERIF } from './page-kit';

// People on the canvas: you, and a teammate in their own colour.
export const YOU = '#0ea5e9';
export const TEAMMATE = '#ec4899';

// A surface in the editor (a card, a panel, a page): white in light, slate in dark, with the
// soft shadow the editor lifts it on.
export const SURFACE =
  'fill-white stroke-slate-200 drop-shadow-[0_1px_1.5px_rgb(15_23_42/0.10)] dark:fill-slate-800 dark:stroke-slate-700 dark:drop-shadow-none';
// A surface one step back (a column, a well).
export const WELL = 'fill-slate-50 stroke-slate-200 dark:fill-slate-900/70 dark:stroke-slate-700';
// Ink for text and for the grey bars standing in for text.
export const INK = 'fill-slate-800 dark:fill-slate-100';
export const MUTED = 'fill-slate-500 dark:fill-slate-400';
export const BAR = 'fill-slate-200 dark:fill-slate-600';
export const BAR_SOFT = 'fill-slate-100 dark:fill-slate-700';

/** The card's stage: the canvas Frame and a 300 by 96 drawing centred in it. */
export function Stage({
  children,
  canvas = true,
  overlay,
}: {
  children: ReactNode;
  canvas?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <Frame canvas={canvas}>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full" fontFamily={FONT}>
        {children}
      </svg>
      {overlay}
    </Frame>
  );
}

/** A loop's start, as a style: the --d stagger of the fa-f-* loops. */
export const at = (d: number, extra: Record<string, string | number> = {}) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

/** A person's initials in a filled circle. */
export function Avatar({
  x,
  y,
  initials,
  colour,
  r = 5.5,
}: {
  x: number;
  y: number;
  initials: string;
  colour: string;
  r?: number;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 0.9} className="fill-white dark:fill-slate-800" fill="#fff" />
      <circle cx={x} cy={y} r={r} fill={colour} />
      <text
        x={x}
        y={y + r * 0.37}
        textAnchor="middle"
        fontSize={r * 0.95}
        fontWeight="700"
        fill="#fff"
      >
        {initials}
      </text>
    </g>
  );
}

/** A collaborator's pointer with their name tag, its tip at (0, 0) of the group. */
export function Cursor({ colour, name }: { colour: string; name?: string }) {
  return (
    <g>
      <path
        d="M0 0 L0 10.5 L3 7.8 L5.2 12.4 L7 11.6 L4.9 7.1 L8.8 7 Z"
        fill={colour}
        stroke="#fff"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {name ? (
        <g>
          <rect x="7" y="10" width={name.length * 4.6 + 6} height="9" rx="3" fill={colour} />
          <text x="10" y="16.6" fontSize="6.2" fontWeight="700" fill="#fff">
            {name}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** A small label pill. `tone` picks its colour; the default is neutral. */
export function Pill({
  x,
  y,
  text,
  tone = 'neutral',
  w,
}: {
  x: number;
  y: number;
  text: string;
  tone?: 'neutral' | 'brand' | 'amber' | 'rose' | 'emerald' | 'violet';
  w?: number;
}) {
  const tones = {
    neutral: ['fill-slate-100 dark:fill-slate-700', 'fill-slate-600 dark:fill-slate-200'],
    brand: ['fill-sky-100 dark:fill-sky-500/25', 'fill-sky-700 dark:fill-sky-200'],
    amber: ['fill-amber-100 dark:fill-amber-500/25', 'fill-amber-700 dark:fill-amber-200'],
    rose: ['fill-rose-100 dark:fill-rose-500/25', 'fill-rose-700 dark:fill-rose-200'],
    emerald: [
      'fill-emerald-100 dark:fill-emerald-500/25',
      'fill-emerald-700 dark:fill-emerald-200',
    ],
    violet: ['fill-violet-100 dark:fill-violet-500/25', 'fill-violet-700 dark:fill-violet-200'],
  } as const;
  const [bg, fg] = tones[tone];
  const width = w ?? text.length * 3.9 + 8;
  return (
    <g>
      <rect className={bg} x={x} y={y} width={width} height="9" rx="4.5" fill="#f1f5f9" />
      <text
        className={fg}
        x={x + width / 2}
        y={y + 6.4}
        textAnchor="middle"
        fontSize="6"
        fontWeight="600"
        fill="#475569"
      >
        {text}
      </text>
    </g>
  );
}

/** Rows of text drawn as soft bars: `widths` are fractions of `w`, one per line. */
export function TextLines({
  x,
  y,
  w,
  widths,
  gap = 5,
  h = 2,
  className = BAR,
}: {
  x: number;
  y: number;
  w: number;
  widths: readonly number[];
  gap?: number;
  h?: number;
  className?: string;
}) {
  return (
    <g className={className} fill="#e2e8f0">
      {widths.map((f, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w * f} height={h} rx={h / 2} />
      ))}
    </g>
  );
}

/** A floating tool strip across the top of the canvas, as the Toolbar layout draws it. */
export function ToolStrip({
  x,
  y,
  w,
  children,
}: {
  x: number;
  y: number;
  w: number;
  children: ReactNode;
}) {
  return (
    <g>
      <rect className={SURFACE} x={x} y={y} width={w} height="15" rx="4" strokeWidth="0.8" />
      {children}
    </g>
  );
}

/** A keyboard key with its label. */
export function Keycap({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-300 dark:fill-slate-700 dark:stroke-slate-500"
        x={x}
        y={y}
        width="9"
        height="9.5"
        rx="2"
        strokeWidth="0.8"
        fill="#fff"
        stroke="#cbd5e1"
      />
      <rect
        className="fill-slate-200 dark:fill-slate-900"
        x={x + 0.8}
        y={y + 8}
        width="7.4"
        height="1"
        rx="0.5"
        fill="#e2e8f0"
      />
      <text
        className={INK}
        x={x + 4.5}
        y={y + 6.6}
        textAnchor="middle"
        fontSize="5.6"
        fontWeight="700"
        fill="#1e293b"
      >
        {label}
      </text>
    </g>
  );
}
