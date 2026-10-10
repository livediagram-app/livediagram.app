// Shared primitives for the pages, slides and presenting card art (./infographics, ./present):
// paper that reads as a page on the canvas in light and dark, an editor panel, a presenting
// screen, lines of writing, a teammate's cursor. Every colour has its light value as the SVG
// attribute and its dark value as a dark: utility, so a card is right in both appearances.
//
// Motion lives in app/feature-art-animations.css (the fa-e-* block): each piece takes its own
// delay through --e-d, every loop is the same length, and reduced motion settles all of it.

import type { CSSProperties, ReactNode } from 'react';

export const SKY = '#0ea5e9';
export const SKY_DEEP = '#0369a1';
export const VIOLET = '#8b5cf6';
export const AMBER = '#f59e0b';
export const EMERALD = '#10b981';
export const ROSE = '#f43f5e';

/** A delay for an fa-e-* piece, so pieces in one card land in turn. */
export const at = (seconds: number) => ({ '--e-d': `${seconds}s` }) as CSSProperties;

// Ink on paper: headings, body lines and faint rules.
export const INK = 'fill-slate-800 dark:fill-slate-100';
export const INK_SOFT = 'fill-slate-500 dark:fill-slate-400';
export const LINE = 'fill-slate-200 dark:fill-slate-600';

/** A page on the canvas: white paper with a soft shadow in light, a lifted slate sheet in dark. */
export function Page({
  x,
  y,
  w,
  h,
  className = 'fill-white dark:fill-slate-800',
  fill = '#ffffff',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  className?: string;
  fill?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        className="fill-slate-900/10 dark:fill-black/40"
        x={x + 0.8}
        y={y + 1.6}
        width={w}
        height={h}
        rx="1.6"
        fill="#0f172a"
        fillOpacity="0.1"
      />
      <rect
        className={`${className} stroke-slate-200 dark:stroke-slate-600`}
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.6"
        fill={fill}
        stroke="#e2e8f0"
        strokeWidth="0.7"
      />
      {children}
    </g>
  );
}

/** A floating editor panel: white with a hairline and a shadow, slate in dark. */
export function Panel({
  x,
  y,
  w,
  h,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        className="dark:fill-black/40"
        x={x}
        y={y + 2}
        width={w}
        height={h}
        rx="4"
        fill="#0f172a"
        fillOpacity="0.08"
      />
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="4"
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth="0.8"
      />
      {title ? (
        <text x={x + 6} y={y + 9.5} fontSize="5.6" fontWeight="700" className={INK} fill="#1e293b">
          {title}
        </text>
      ) : null}
      {children}
    </g>
  );
}

/** A screen presenting a slide: near black in both appearances, with an edge so dark still sees it. */
export function Screen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect
        className="dark:fill-black/50"
        x={x}
        y={y + 2.5}
        width={w}
        height={h}
        rx="5"
        fill="#0f172a"
        fillOpacity="0.18"
      />
      <rect
        className="stroke-slate-800 dark:fill-slate-950 dark:stroke-slate-600"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        fill="#0b1220"
        stroke="#1e293b"
        strokeWidth="0.8"
      />
    </g>
  );
}

/** Rows of writing: soft bars, the last one short. */
export function Lines({
  x,
  y,
  w,
  count,
  gap = 4.2,
  className = LINE,
  height = 1.7,
}: {
  x: number;
  y: number;
  w: number;
  count: number;
  gap?: number;
  className?: string;
  height?: number;
}) {
  return (
    <g className={className} fill="#e2e8f0">
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === count - 1 && count > 1 ? w * 0.62 : w}
          height={height}
          rx={height / 2}
        />
      ))}
    </g>
  );
}

/** A teammate's pointer with their name tag, as the editor draws presence. */
export function Cursor({
  x,
  y,
  color,
  name,
}: {
  x: number;
  y: number;
  color: string;
  name?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 0 L0 9 L2.6 6.6 L4.4 10.4 L6 9.6 L4.3 6 L7.6 6 Z"
        fill={color}
        stroke="#ffffff"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {name ? (
        <g>
          <rect x="6.5" y="9" width={name.length * 3.3 + 5} height="7" rx="2" fill={color} />
          <text x="9" y="14" fontSize="4.8" fontWeight="700" fill="#ffffff">
            {name}
          </text>
        </g>
      ) : null}
    </g>
  );
}

// The serif an article or report headline is set in (Illustrate's Classic and Report looks).
export const SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", serif';
