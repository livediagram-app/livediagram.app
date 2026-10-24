// The building blocks the category scenes share (docs/specs/018-help/help-pages.md "Category art"). The scenes
// draw with the in-article illustration kit (components/illustrations/primitives.tsx) for anything the editor
// shows: shapes, arrows, cursors, avatars, panels. This file adds only what a category scene needs on top: the
// stage it stands on, the floating window most scenes frame their moment in, and a handful of small motifs
// (chips, keycaps, ticks, sparkles, document thumbnails) that recur across the set.
//
// Colours follow the kit's house style: Tailwind fill/stroke classes in the light ramp, retargeted for dark by
// packages/help-site/src/help-art.css because the stage carries `help-art`.

import { useId, type ReactNode } from 'react';
import { Label } from '@/components/illustrations/primitives';

/** Every scene is drawn on this stage, in these units. */
const ART_W = 400;
const ART_H = 220;

/** The SVG a scene draws into: the editor's dot grid under a soft brand glow. The scene always fits whole
 *  (`meet`), and the ground runs far past the stage on every side, so a frame of any shape (a card's banner, the
 *  half of a wide card, a page header) shows the whole scene on unbroken ground rather than cropping it. */
export function Stage({ children }: { children: ReactNode }) {
  const id = useId().replace(/:/g, '');
  // The ground's reach past the stage, in stage units: enough for a frame four times as wide or tall.
  const BLEED = 1200;
  const ground = { x: -BLEED, y: -BLEED, width: ART_W + 2 * BLEED, height: ART_H + 2 * BLEED };
  return (
    <svg
      viewBox={`0 0 ${ART_W} ${ART_H}`}
      className="help-art block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={`dots-${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="1.1" className="fill-brand-200" />
        </pattern>
        <radialGradient
          id={`glow-${id}`}
          gradientUnits="userSpaceOnUse"
          cx={ART_W / 2}
          cy={ART_H * 0.45}
          r={ART_W * 0.6}
        >
          <stop offset="0%" style={{ stopColor: 'var(--color-white)', stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-brand-50)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect {...ground} className="fill-brand-50" />
      <rect {...ground} fill={`url(#dots-${id})`} opacity={0.7} />
      <rect {...ground} fill={`url(#glow-${id})`} />
      {children}
    </svg>
  );
}

/** A soft drop shadow under a floating surface, drawn as an offset translucent rect (no SVG filter). */
export function Shadow({
  x,
  y,
  w,
  h,
  r = 12,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}) {
  return (
    <>
      <rect x={x + 2} y={y + 8} width={w} height={h} rx={r} className="fill-slate-900/[0.06]" />
      <rect x={x + 1} y={y + 3} width={w} height={h} rx={r} className="fill-slate-900/[0.05]" />
    </>
  );
}

/** A floating window: a shadowed white card with a title bar (traffic-light dots and an optional title). */
export function Window({
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
      <Shadow x={x} y={y} w={w} h={h} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${x} ${y + 12} a12 12 0 0 1 12 -12 H${x + w - 12} a12 12 0 0 1 12 12 V${y + 22} H${x} Z`}
        className="fill-slate-50"
      />
      <line
        x1={x}
        y1={y + 22}
        x2={x + w}
        y2={y + 22}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <circle cx={x + 12} cy={y + 11} r={3} className="fill-rose-300" />
      <circle cx={x + 22} cy={y + 11} r={3} className="fill-amber-300" />
      <circle cx={x + 32} cy={y + 11} r={3} className="fill-emerald-300" />
      {title && (
        <Label x={x + w / 2} y={y + 11.5} anchor="middle" size={9} weight={600} tone="muted">
          {title}
        </Label>
      )}
      {children}
    </g>
  );
}

/** A floating card with no title bar: a shadowed white rounded rect. */
export function Card({
  x,
  y,
  w,
  h,
  r = 10,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <Shadow x={x} y={y} w={w} h={h} r={r} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {children}
    </g>
  );
}

const CHIP_TONES = {
  brand: { box: 'fill-brand-50 stroke-brand-200', text: 'fill-brand-700' },
  solid: { box: 'fill-brand-500 stroke-brand-600', text: 'fill-white help-art-as-drawn' },
  emerald: {
    box: 'fill-emerald-50 stroke-emerald-200',
    text: 'fill-emerald-700 dark:fill-emerald-300',
  },
  amber: { box: 'fill-amber-50 stroke-amber-200', text: 'fill-amber-700 dark:fill-amber-300' },
  rose: { box: 'fill-rose-50 stroke-rose-200', text: 'fill-rose-700 dark:fill-rose-300' },
  violet: { box: 'fill-violet-50 stroke-violet-200', text: 'fill-violet-700 dark:fill-violet-300' },
  slate: { box: 'fill-white stroke-slate-200', text: 'fill-slate-600' },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

/** A rounded pill with a short label, sized to its text. Returns its width through `w` when given. */
export function Chip({
  x,
  y,
  label,
  tone = 'brand',
  h = 18,
  size = 9.5,
  w,
}: {
  x: number;
  y: number;
  label: string;
  tone?: ChipTone;
  h?: number;
  size?: number;
  w?: number;
}) {
  const width = w ?? chipWidth(label, size);
  const t = CHIP_TONES[tone];
  return (
    <g>
      <rect x={x} y={y} width={width} height={h} rx={h / 2} className={t.box} strokeWidth={1} />
      <Label
        x={x + width / 2}
        y={y + h / 2 + 0.5}
        anchor="middle"
        size={size}
        weight={600}
        className={t.text}
      >
        {label}
      </Label>
    </g>
  );
}

/** How wide a chip draws `label` at `size`: an average glyph advance plus the pill's padding. */
export function chipWidth(label: string, size = 9.5): number {
  return Math.round(label.length * size * 0.58 + 16);
}

/** A keyboard keycap with a raised lip. */
export function Kbd({
  x,
  y,
  label,
  w = 30,
  h = 30,
  active = false,
}: {
  x: number;
  y: number;
  label: string;
  w?: number;
  h?: number;
  active?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y + 3}
        width={w}
        height={h}
        rx={7}
        className={active ? 'fill-brand-600' : 'fill-slate-200'}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className={active ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
        strokeWidth={1.2}
      />
      <Label
        x={x + w / 2}
        y={y + h / 2 + 0.5}
        anchor="middle"
        size={label.length > 2 ? 9 : 13}
        weight={700}
        tone={active ? 'onAccent' : 'strong'}
      >
        {label}
      </Label>
    </g>
  );
}

/** A tick in a filled disc, for "done" and "allowed". */
export function TickDisc({
  cx,
  cy,
  r = 8,
  tone = 'emerald',
}: {
  cx: number;
  cy: number;
  r?: number;
  tone?: 'emerald' | 'brand';
}) {
  const fill = tone === 'emerald' ? 'fill-emerald-500 dark:fill-emerald-700' : 'fill-brand-500';
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={fill} />
      <path
        d={`M${cx - r * 0.42} ${cy + r * 0.02} l${r * 0.3} ${r * 0.3} l${r * 0.55} -${r * 0.6}`}
        className="fill-none stroke-white help-art-as-drawn"
        strokeWidth={r * 0.26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A four-point sparkle, the house mark for "helpful" and "AI". */
export function Sparkle({
  cx,
  cy,
  r = 8,
  className = 'fill-amber-400',
}: {
  cx: number;
  cy: number;
  r?: number;
  className?: string;
}) {
  const k = r * 0.28;
  return (
    <path
      d={`M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`}
      className={className}
    />
  );
}

/** A document thumbnail: a page with a folded corner, a title bar and a tiny diagram or text lines. */
export function DocThumb({
  x,
  y,
  w = 54,
  h = 66,
  accent = 'brand',
  lines = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  accent?: 'brand' | 'violet' | 'emerald' | 'amber' | 'rose';
  lines?: boolean;
}) {
  const f = Math.min(12, w * 0.22);
  const tone = {
    brand: 'fill-brand-400',
    violet: 'fill-violet-400',
    emerald: 'fill-emerald-400',
    amber: 'fill-amber-400',
    rose: 'fill-rose-400',
  }[accent];
  return (
    <g>
      <Shadow x={x} y={y} w={w} h={h} r={6} />
      <path
        d={`M${x + 5} ${y} H${x + w - f} L${x + w} ${y + f} V${y + h - 5} a5 5 0 0 1 -5 5 H${x + 5} a5 5 0 0 1 -5 -5 V${y + 5} a5 5 0 0 1 5 -5 Z`}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <path
        d={`M${x + w - f} ${y} V${y + f} H${x + w}`}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.3}
      />
      <rect x={x + 7} y={y + 9} width={w * 0.45} height={4.5} rx={2.2} className={tone} />
      {lines ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={x + 7}
              y={y + 21 + i * 9}
              width={(w - 14) * (i === 3 ? 0.6 : 1)}
              height={3.5}
              rx={1.7}
              className="fill-slate-200"
            />
          ))}
        </>
      ) : (
        <>
          <rect
            x={x + 8}
            y={y + h * 0.42}
            width={w * 0.26}
            height={h * 0.16}
            rx={2.5}
            className="fill-brand-100 stroke-brand-300"
            strokeWidth={1}
          />
          <rect
            x={x + w * 0.58}
            y={y + h * 0.62}
            width={w * 0.26}
            height={h * 0.16}
            rx={2.5}
            className={`${tone} opacity-70`}
          />
          <path
            d={`M${x + 8 + w * 0.26} ${y + h * 0.5} H${x + w * 0.71} V${y + h * 0.62}`}
            className="fill-none stroke-slate-300"
            strokeWidth={1.2}
          />
        </>
      )}
    </g>
  );
}
