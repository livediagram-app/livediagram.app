// Shared primitives for the pages and photo card art (./pages, ./photo): paper that reads as a
// page on the canvas in light and dark, an editor panel and lines of writing. Every colour has its
// light value as the SVG attribute and its dark value as a dark: utility, so a card is right in
// both appearances.
//
// Motion lives in app/feature-art/pages.css (the fa-e-* block): each piece takes its own
// delay through --e-d, every loop is the same length, and reduced motion settles all of it.

import type { CSSProperties, ReactNode } from 'react';

export { AMBER, EMERALD, ROSE, SKY, VIOLET } from './shared';

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

// The serif a wordmark or a page's headline is set in.
export const SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", serif';

// The small caption over a page, as the editor labels its pages.
export function PageLabel({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize="4.6" fontWeight="600" className={INK_SOFT} fill="#64748b">
      {children}
    </text>
  );
}
