// The drawing parts the versatility feature illustrations are built from: tinted node tones that
// read on the light and the dark canvas, a labelled node, a selection frame with its handles, a
// teammate's pointer, a floating chip, an arrowhead, the wand glyph and the shared panel styles.
//
// Versatility-specific on purpose: ./shared holds what every feature-art file uses (Frame and the
// colour constants), and none of these are wanted elsewhere. Colours are Tailwind utilities with a
// dark: half, never bare hex, so a card is right in both appearances.

import type { CSSProperties, ReactNode } from 'react';

export type Tone = 'sky' | 'violet' | 'emerald' | 'amber' | 'pink' | 'slate';

// A shape's fill and border in each tone: a pale tint on paper, a deep tint on the dark canvas.
export const TONE_SHAPE: Record<Tone, string> = {
  sky: 'fill-sky-50 stroke-sky-500 dark:fill-sky-500/15 dark:stroke-sky-400',
  violet: 'fill-violet-50 stroke-violet-500 dark:fill-violet-500/15 dark:stroke-violet-400',
  emerald: 'fill-emerald-50 stroke-emerald-500 dark:fill-emerald-500/15 dark:stroke-emerald-400',
  amber: 'fill-amber-50 stroke-amber-500 dark:fill-amber-500/15 dark:stroke-amber-400',
  pink: 'fill-pink-50 stroke-pink-500 dark:fill-pink-500/15 dark:stroke-pink-400',
  slate: 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600',
};

// A label inside a shape of that tone.
export const TONE_TEXT: Record<Tone, string> = {
  sky: 'fill-sky-800 dark:fill-sky-100',
  violet: 'fill-violet-800 dark:fill-violet-100',
  emerald: 'fill-emerald-800 dark:fill-emerald-100',
  amber: 'fill-amber-800 dark:fill-amber-100',
  pink: 'fill-pink-800 dark:fill-pink-100',
  slate: 'fill-slate-700 dark:fill-slate-200',
};

// Connectors, guides and the selection, as the editor draws them.
export const LINK = 'stroke-slate-500 dark:stroke-slate-400';
const LINK_HEAD = 'fill-slate-500 dark:fill-slate-400';
export const SELECT = 'stroke-sky-500 dark:stroke-sky-400';
export const MUTED_TEXT = 'fill-slate-500 dark:fill-slate-400';

/** A labelled shape on the canvas. `shape` picks a rounded box, a pill or a diamond. */
export function Node({
  x,
  y,
  w,
  h,
  label,
  tone = 'sky',
  shape = 'box',
  size = 7,
  className,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  tone?: Tone;
  shape?: 'box' | 'pill' | 'diamond';
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const body =
    shape === 'diamond' ? (
      <path
        className={TONE_SHAPE[tone]}
        d={`M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z`}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    ) : (
      <rect
        className={TONE_SHAPE[tone]}
        x={x}
        y={y}
        width={w}
        height={h}
        rx={shape === 'pill' ? h / 2 : 4}
        strokeWidth="1.4"
      />
    );
  return (
    <g className={className} style={style}>
      {body}
      {label ? (
        <text
          className={TONE_TEXT[tone]}
          x={x + w / 2}
          y={y + h / 2 + size * 0.36}
          fontSize={size}
          fontWeight="600"
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** The selection frame the editor draws round a selected element: a thin sky line and four handles. */
export function Selection({
  x,
  y,
  w,
  h,
  pad = 3,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  pad?: number;
}) {
  const x0 = x - pad;
  const y0 = y - pad;
  const x1 = x + w + pad;
  const y1 = y + h + pad;
  return (
    <g>
      <rect
        className={SELECT}
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        fill="none"
        strokeWidth="1"
      />
      {[
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ].map(([hx, hy]) => (
        <rect
          key={`${hx}-${hy}`}
          className={`fill-white dark:fill-slate-900 ${SELECT}`}
          x={hx! - 2}
          y={hy! - 2}
          width="4"
          height="4"
          rx="0.8"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

/** A teammate's pointer with their name tag, as live presence draws it. */
export function Pointer({
  x,
  y,
  name,
  color = '#ec4899',
}: {
  x: number;
  y: number;
  name?: string;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 0 L0 10 L2.8 7.4 L4.6 11.4 L6.2 10.7 L4.4 6.8 L8.2 6.6 Z"
        fill={color}
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {name ? (
        <g transform="translate(7 10)">
          <rect width={name.length * 4.2 + 6} height="8.5" rx="2.5" fill={color} />
          <text x="3" y="6.1" fontSize="5.8" fontWeight="700" fill="#fff">
            {name}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** A small floating chip over the art (a mode, a hint or a value), placed by its corner classes. */
export function Chip({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`absolute flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 ${className}`}
    >
      {children}
    </span>
  );
}

// An arrowhead marker for a connector, in the link colour. Ids are per card so two cards on one
// page never share a marker.
export function ArrowHead({ id, hollow = false }: { id: string; hollow?: boolean }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path
        className={hollow ? `fill-white dark:fill-slate-900 ${LINK}` : LINK_HEAD}
        d="M1 1 L9 5 L1 9 z"
        strokeWidth={hollow ? 1.3 : 0}
        strokeLinejoin="round"
      />
    </marker>
  );
}

export function WandIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        className="stroke-brand-600 dark:stroke-brand-300"
        d="M3 13 L11 5"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        className="fill-brand-600 dark:fill-brand-300"
        d="M12 2 l0.7 1.8 L14.5 4.5 l-1.8 0.7 L12 7 l-0.7-1.8 L9.5 4.5 l1.8-0.7 Z"
      />
    </svg>
  );
}

export const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

// A panel floating over the canvas, as the editor's popovers and panels sit.
export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
export const PANEL_TEXT = 'fill-slate-700 dark:fill-slate-200';
export const HAIRLINE = 'stroke-slate-200 dark:stroke-slate-700';
export const INK = 'stroke-slate-800 dark:stroke-slate-100';
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// The card stage: the full width of a card's frame (about 304 by 96 px), drawn at one scale.
export const STAGE = '0 0 300 96';
