import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';

// The smallest pieces of liveknowledge's figures (kit.tsx): the scene units, writing lines, the page's ground,
// ticks, pills, buttons, code and chevrons. Pure drawing, no chrome.

/** Chrome hairline, in scene units (scenes render near 2x). */
export const HAIR = 0.75;
/** The sidebar's width, the top row's and the footer's height inside an AppFrame. */
export const SIDEBAR_W = 112;
export const TOP_H = 20;
export const FOOT_H = 20;
/** A tree row's height. */
export const ROW_H = 15;

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const;

/** Muted bars standing in for lines of writing: each `widths` entry is one line. */
export function Lines({
  x,
  y,
  widths,
  gap = 8,
  h = 3.5,
  className = 'fill-slate-200',
}: {
  x: number;
  y: number;
  widths: readonly number[];
  gap?: number;
  h?: number;
  className?: string;
}) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height={h} rx={h / 2} className={className} />
      ))}
    </>
  );
}

/** A white surface with a hairline border: a card, a dialog, a menu. `lift` adds the soft shadow of a floating one. */
export function Surface({
  x,
  y,
  w,
  h,
  r = 8,
  lift = false,
  className = 'fill-white stroke-slate-200',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  lift?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      {lift ? <Lift x={x} y={y} w={w} h={h} r={r} /> : null}
      <rect x={x} y={y} width={w} height={h} rx={r} className={className} strokeWidth={HAIR} />
      {children}
    </g>
  );
}

/** A tick, drawn as a stroke at (cx, cy): the Verified mark, a chosen row, a ticked checkbox. */
export function Tick({
  cx,
  cy,
  r = 4,
  className = 'stroke-brand-600',
}: {
  cx: number;
  cy: number;
  r?: number;
  className?: string;
}) {
  return (
    <path
      d={`M${cx - r * 0.7} ${cy + r * 0.05} l${r * 0.5} ${r * 0.5} l${r * 0.9} -${r}`}
      className={`fill-none ${className}`}
      strokeWidth={r * 0.36}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** The Verified mark as the editor draws it: a tick in a pale brand disc. */
export function VerifiedMark({ cx, cy, r = 5 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-brand-100" />
      <Tick cx={cx} cy={cy} r={r * 0.62} className="stroke-brand-700" />
    </g>
  );
}

/** The width a pill of `label` takes at `size`. */
export function pillWidth(label: string, size = 7.5): number {
  return Math.ceil(label.length * size * 0.56 + 10);
}

const PILL_TONES = {
  amber: { box: 'fill-amber-50 stroke-amber-200', text: 'fill-amber-700 dark:fill-amber-300' },
  brand: { box: 'fill-brand-50 stroke-brand-200', text: 'fill-brand-700' },
  slate: { box: 'fill-slate-100 stroke-slate-200', text: 'fill-slate-600' },
  rose: { box: 'fill-rose-50 stroke-rose-200', text: 'fill-rose-700 dark:fill-rose-300' },
  violet: { box: 'fill-violet-50 stroke-violet-200', text: 'fill-violet-700 dark:fill-violet-300' },
  solid: { box: 'fill-brand-600 stroke-brand-600', text: 'fill-white help-art-as-drawn' },
  dark: { box: 'fill-slate-800 stroke-slate-800', text: 'fill-white help-art-as-drawn' },
} as const;
export type PillTone = keyof typeof PILL_TONES;

/** A pill with a word in it: Review Due (amber), a scope chip, a count. Its left edge is `x`, its middle `y`. */
export function Pill({
  x,
  y,
  label,
  tone = 'amber',
  size = 7.5,
  w,
  h = 12,
}: {
  x: number;
  y: number;
  label: string;
  tone?: PillTone;
  size?: number;
  w?: number;
  h?: number;
}) {
  const width = w ?? pillWidth(label, size);
  const t = PILL_TONES[tone];
  return (
    <g>
      <rect
        x={x}
        y={y - h / 2}
        width={width}
        height={h}
        rx={h / 2}
        className={t.box}
        strokeWidth={HAIR}
      />
      <Label
        x={x + width / 2}
        y={y + 0.4}
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

/** A button: `primary` is the filled one. Its left edge is `x`, its top `y`. */
export function Btn({
  x,
  y,
  w,
  h = 16,
  label,
  variant = 'default',
  size = 8,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  variant?: 'default' | 'primary' | 'quiet';
  size?: number;
}) {
  const box = {
    default: 'fill-white stroke-slate-300',
    primary: 'fill-brand-600 stroke-brand-600',
    quiet: 'fill-slate-100 stroke-slate-100',
  }[variant];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} className={box} strokeWidth={HAIR} />
      <Label
        x={x + w / 2}
        y={y + h / 2 + 0.4}
        anchor="middle"
        size={size}
        weight={600}
        tone={variant === 'primary' ? 'onAccent' : 'strong'}
      >
        {label}
      </Label>
    </g>
  );
}

/** Text in the code face, for a command, a tool's name or a path. */
export function Code({
  x,
  y,
  children,
  size = 8,
  className = 'fill-slate-700',
  anchor = 'start',
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={className}
      style={{ ...MONO, whiteSpace: 'pre' }}
    >
      {children}
    </text>
  );
}

/** A chevron: right (a closed page) or down (an open one). */
export function Chevron({ cx, cy, open = false }: { cx: number; cy: number; open?: boolean }) {
  const d = open
    ? `M${cx - 2.4} ${cy - 1.2} L${cx} ${cy + 1.4} L${cx + 2.4} ${cy - 1.2}`
    : `M${cx - 1.2} ${cy - 2.4} L${cx + 1.4} ${cy} L${cx - 1.2} ${cy + 2.4}`;
  return (
    <path
      d={d}
      className="fill-none stroke-slate-400"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Where each of a run of items starts, from `start`, each `sizes[i]` long: positions worked out before drawing. */
export function runningStarts(start: number, sizes: readonly number[]): number[] {
  const starts: number[] = [];
  let at = start;
  for (const size of sizes) {
    starts.push(at);
    at += size;
  }
  return starts;
}
