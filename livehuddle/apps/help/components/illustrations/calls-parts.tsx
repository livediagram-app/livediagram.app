// The pieces the Calls figures (calls.tsx, calls-bubbles.tsx) are drawn from: the Call dock's strip
// segments in the strip's own tones and Lucide glyphs (apps/editor/components/calls/CallStripGroup.tsx),
// the dock row and its row labels, the talking bars (TalkingBars.tsx) and a hover card.

import type { ReactNode } from 'react';
import type { IconPrim } from '@liveworkspace/icons';
import { Prims } from '@livehuddle/ui';
import { Label } from '@liveworkspace/help-site/art/primitives';

// --- The strip ----------------------------------------------------------------

type Tone = 'rest' | 'live' | 'warn' | 'muted';

const TONE_INK: Record<Tone, { stroke: string; fill: string }> = {
  rest: { stroke: 'stroke-slate-600', fill: 'fill-slate-600' },
  live: { stroke: 'stroke-brand-700', fill: 'fill-brand-700' },
  warn: {
    stroke: 'stroke-amber-600 dark:stroke-amber-300',
    fill: 'fill-amber-600 dark:fill-amber-300',
  },
  muted: {
    stroke: 'stroke-rose-600 dark:stroke-rose-300',
    fill: 'fill-rose-600 dark:fill-rose-300',
  },
};

/** A Lucide glyph centred on (cx, cy) at `size` units, stroked in `className`. */
export function Icon({
  prims,
  cx,
  cy,
  size = 14,
  className = 'stroke-slate-600',
}: {
  prims: readonly IconPrim[];
  cx: number;
  cy: number;
  size?: number;
  className?: string;
}) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}
      className={className}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Prims prims={prims} />
    </g>
  );
}

export const SEG_H = 34;

export type Seg = {
  name: string;
  icon?: readonly IconPrim[];
  tone?: Tone;
  // The microphone's level meter is filling (it is open and somebody hears you).
  ring?: boolean;
  w?: number;
  // A divider before it: the Screen Share group sits behind one (avatar-mode.md "The Call dock").
  divider?: boolean;
};

// Every button is named beside its glyph on a desktop (avatar-mode.md "The Call dock").
const segWidth = (s: Seg) => s.w ?? (s.icon ? Math.round(s.name.length * 6 + 36) : 28);

/** A cluster strip: a white frame of segments parted by hairlines, each its icon and its name (a wide desktop's
 *  look). A segment with no icon is the strip's `?`. Returns the frame at (x, y). */
export function Strip({ x, y, segs }: { x: number; y: number; segs: Seg[] }) {
  const widths = segs.map(segWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  // Each segment's left edge: the frame's, plus the widths before it.
  const lefts = widths.map((_, i) => x + widths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={total}
        height={SEG_H}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {segs.map((s, i) => {
        const sx = lefts[i] ?? x;
        const w = widths[i] ?? 0;
        const ink = TONE_INK[s.tone ?? 'rest'];
        return (
          <g key={s.name}>
            {i > 0 && (
              <line
                x1={sx}
                y1={y}
                x2={sx}
                y2={y + SEG_H}
                className="stroke-slate-100"
                strokeWidth={1}
              />
            )}
            {s.ring && (
              // The level meter: the button fills from its foot with your voice (brand tint on white here).
              <rect
                x={sx + 2}
                y={y + SEG_H - 4 - 14}
                width={w - 4}
                height={14}
                rx={4}
                className="fill-brand-200"
                opacity={0.7}
              />
            )}
            {s.icon ? (
              <>
                <Icon prims={s.icon} cx={sx + 17} cy={y + SEG_H / 2} className={ink.stroke} />
                <Label
                  x={sx + 28}
                  y={y + SEG_H / 2 + 1}
                  size={10.5}
                  weight={600}
                  className={ink.fill}
                >
                  {s.name}
                </Label>
              </>
            ) : (
              <Label
                x={sx + w / 2}
                y={y + SEG_H / 2 + 1}
                anchor="middle"
                size={12}
                weight={700}
                tone="muted"
              >
                ?
              </Label>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The Call dock: a card at the bottom centre of the canvas holding the call's buttons side by side (Say's tint under
 *  each, desktop names beside the glyphs), centred in the scene (avatar-mode.md "The Call dock"). */
export function DockRow({ y, segs }: { y: number; segs: Seg[] }) {
  const gap = 4;
  const divW = 9;
  const widths = segs.map(segWidth);
  // Each button's left edge, a divider (the Screen Share group's) taking a little room before its button.
  const lefts: number[] = [];
  let cursor = 4;
  segs.forEach((seg, i) => {
    if (seg.divider) cursor += divW;
    lefts.push(cursor);
    cursor += (widths[i] ?? 0) + gap;
  });
  const cardW = cursor - gap + 4;
  const x = (420 - cardW) / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={cardW}
        height={SEG_H + 8}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {segs.map((s, i) => {
        const w = widths[i] ?? 0;
        const sx = x + (lefts[i] ?? 0);
        // on (live) is the solid brand, its ink white.
        const live = s.tone === 'live';
        const ink = live
          ? { stroke: 'stroke-white', fill: 'fill-white' }
          : TONE_INK[s.tone ?? 'rest'];
        return (
          <g key={s.name}>
            {s.divider && (
              <line
                x1={sx - (divW + gap) / 2}
                y1={y + 10}
                x2={sx - (divW + gap) / 2}
                y2={y + SEG_H - 2}
                className="stroke-slate-200"
                strokeWidth={1}
              />
            )}
            <rect
              x={sx}
              y={y + 5}
              width={w}
              height={SEG_H - 2}
              rx={5}
              className={
                live
                  ? 'fill-brand-600'
                  : s.tone === 'muted'
                    ? 'fill-rose-50 dark:fill-rose-500/15'
                    : 'fill-brand-50'
              }
            />
            {s.ring && (
              // The level meter: white fill from the button's foot as you speak (somebody hears you).
              <rect
                x={sx}
                y={y + 5 + (SEG_H - 2) - 16}
                width={w}
                height={16}
                rx={5}
                className="fill-white"
                opacity={0.3}
              />
            )}
            <Icon prims={s.icon ?? []} cx={sx + 17} cy={y + 4 + SEG_H / 2} className={ink.stroke} />
            <Label x={sx + 28} y={y + 5 + SEG_H / 2} size={10.5} weight={600} className={ink.fill}>
              {s.name}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

export function RowLabel({ y, children }: { y: number; children: ReactNode }) {
  return (
    <Label x={16} y={y} size={10} weight={600} tone="muted">
      {children}
    </Label>
  );
}

// --- On the board ---------------------------------------------------------------

/** Three talking bars, bottoms on `y`, centred on `cx`, in the speaker's colour. */
export function TalkingBars({
  cx,
  y,
  hue,
  faint = false,
}: {
  cx: number;
  y: number;
  hue: 'emerald' | 'violet' | 'brand';
  faint?: boolean;
}) {
  const fill = { emerald: 'fill-emerald-500', violet: 'fill-violet-500', brand: 'fill-brand-500' }[
    hue
  ];
  const heights = [6, 11, 8];
  return (
    <g opacity={faint ? 0.5 : 1}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={cx - 6.5 + i * 5}
          y={y - h}
          width={3}
          height={h}
          rx={1.5}
          className={fill}
        />
      ))}
    </g>
  );
}

/** A drawn hover card: a bold title, and a line under it when there is one. */
export function Card({
  x,
  y,
  w,
  title,
  line,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  line?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={line ? 42 : 26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 10} y={y + 14} size={10.5} weight={700} tone="strong">
        {title}
      </Label>
      {line && (
        <Label x={x + 10} y={y + 30} size={9.5} tone="muted">
          {line}
        </Label>
      )}
    </g>
  );
}
