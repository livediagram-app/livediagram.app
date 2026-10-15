import { trustedHtml } from '@livediagram/ui';
// The hand-drawn marks the hero's Draw window is made of (components/hero-draw-board.tsx), in the
// look Draw mode gives them (docs/specs/023-draw-mode/draw-mode.md): marker strokes that wobble and
// overshoot their corners, stickies on the editor's pad colours with the paper-peel shadow, the
// hand face, and a sticker on its die-cut plate. Every path is generated from a fixed seed, so the
// wobble is the same on every render (and in the static HTML).

import type { CSSProperties, ReactNode } from 'react';
import { stickerArt, type StickerDef } from '@livediagram/icons';
import { seededRandom } from '@livediagram/document';
import { at } from '@/components/art-tokens';

// Draw mode's hand face, the self-hosted Caveat subset (app/hero-scenes/draw.css).
export const HAND = "'Caveat Hero', Caveat, 'Segoe Print', 'Bradley Hand', cursive";

// The inks, each as stroke and fill classes for both appearances: Marker 1 is the page's ink,
// Marker 2 blue and Marker 3 red (the dock's three), lifted on the dark canvas so they read there.
export const INKS = {
  black: { stroke: 'stroke-(--art-text)', fill: 'fill-(--art-text)' },
  blue: {
    stroke: 'stroke-[#2563eb] dark:stroke-[#60a5fa]',
    fill: 'fill-[#2563eb] dark:fill-[#60a5fa]',
  },
  red: {
    stroke: 'stroke-[#dc2626] dark:stroke-[#f87171]',
    fill: 'fill-[#dc2626] dark:fill-[#f87171]',
  },
  green: {
    stroke: 'stroke-[#15803d] dark:stroke-[#4ade80]',
    fill: 'fill-[#15803d] dark:fill-[#4ade80]',
  },
  violet: {
    stroke: 'stroke-[#7c3aed] dark:stroke-[#a78bfa]',
    fill: 'fill-[#7c3aed] dark:fill-[#a78bfa]',
  },
} as const;
export type Ink = keyof typeof INKS;

const r = (n: number) => Math.round(n * 10) / 10;

// A deterministic jitter in [-amount, amount), so a seed always wobbles the same way.
function wobble(seed: number) {
  const random = seededRandom(seed);
  return (amount: number) => (random() - 0.5) * 2 * amount;
}

// A hand-drawn box: each side a slightly bowed line, the pen overshooting where it closes.
export function roughRect(x: number, y: number, w: number, h: number, seed: number): string {
  const j = wobble(seed);
  const pts: [number, number][] = [
    [x + j(1.5), y + j(1.5)],
    [x + w + j(1.5), y + j(1.5)],
    [x + w + j(1.5), y + h + j(1.5)],
    [x + j(1.5), y + h + j(1.5)],
  ];
  let d = `M${r(pts[0]![0] + 6)} ${r(pts[0]![1] + j(1))}`;
  for (let i = 1; i <= 4; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i % 4]!;
    const mx = (ax + bx) / 2 + j(2.2);
    const my = (ay + by) / 2 + j(2.2);
    d += ` Q${r(mx)} ${r(my)} ${r(bx)} ${r(by)}`;
  }
  // Past the start, as a marker carries on a little after it meets its own line.
  d += ` L${r(pts[0]![0] + 16)} ${r(pts[0]![1] + j(1.2))}`;
  return d;
}

// The length a rough box's dash needs: its perimeter and the overshoot, with room to spare.
export const roughRectLen = (w: number, h: number) => Math.ceil((w + h) * 2 * 1.06 + 24);

// A loop drawn round a point, starting top left and running on past where it began.
export function ringPath(cx: number, cy: number, rx: number, ry: number): string {
  const p = (fx: number, fy: number) => `${r(cx + rx * fx)} ${r(cy + ry * fy)}`;
  return [
    `M${p(-0.2, -1.0)}`,
    `C${p(0.5, -1.1)} ${p(1.06, -0.6)} ${p(1.0, 0.04)}`,
    `C${p(0.97, 0.72)} ${p(0.42, 1.06)} ${p(-0.06, 1.0)}`,
    `C${p(-0.62, 0.96)} ${p(-1.05, 0.52)} ${p(-1.0, -0.08)}`,
    `C${p(-0.95, -0.66)} ${p(-0.48, -1.02)} ${p(0.22, -0.93)}`,
  ].join(' ');
}

// A ring's length: Ramanujan's ellipse perimeter, plus the overshoot.
export function ringLen(rx: number, ry: number): number {
  const h = (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))) * Math.PI;
  return Math.ceil(h * 1.18);
}

// A five-pointed star drawn in one stroke, a touch uneven.
export function starPath(cx: number, cy: number, radius: number): string {
  const j = wobble(Math.round(cx * 7 + cy));
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = (i % 2 ? radius * 0.44 : radius) + j(radius * 0.06);
    return `${r(cx + Math.cos(a) * rad)} ${r(cy + Math.sin(a) * rad)}`;
  });
  return `M${pts.join(' L')} L${pts[0]} L${pts[1]}`;
}

// A wavy underline, the way a heading gets underlined by hand.
export function wavyPath(x: number, y: number, w: number): string {
  const n = Math.max(2, Math.round(w / 14));
  const step = w / n;
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) d += ` q${r(step / 2)} ${i % 2 ? 3 : -3} ${r(step)} 0`;
  return d;
}

// A stroke that draws on over `dur` seconds after `d`, as a marker lays it.
export function Stroke({
  d: path,
  d0,
  dur,
  len,
  ink,
  width = 2.6,
  fill,
  className = '',
}: {
  d: string;
  d0: number;
  dur: number;
  len: number;
  ink?: Ink;
  width?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <path
      className={`hm-draw ${ink ? INKS[ink].stroke : ''} ${className}`}
      d={path}
      fill={fill ?? 'none'}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={at(d0, { '--dur': `${dur}s`, '--len': len })}
    />
  );
}

// Hand lettering, written on from the left (hd-write) at `d`.
export function Hand({
  x,
  y,
  size,
  ink = 'black',
  d,
  dur,
  anchor,
  fillClass,
  children,
}: {
  x: number;
  y: number;
  size: number;
  ink?: Ink;
  d: number;
  dur?: number;
  anchor?: 'middle' | 'end';
  fillClass?: string;
  children: string;
}) {
  return (
    <text
      className={`hd-write ${fillClass ?? INKS[ink].fill}`}
      style={at(d, { '--dur': `${dur ?? Math.min(1.1, 0.25 + children.length * 0.035)}s` })}
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={HAND}
      fontSize={size}
      fontWeight="600"
      stroke="none"
    >
      {children}
    </text>
  );
}

// A sticky note on one of the editor's pad colours (STICKY_PRESETS): square die-cut corners, the
// glued band a shade darker, and the paper-peel shadow heavier at the foot, as the canvas draws it.
export type StickyPaper = { fill: string; ink: string };
export function StickyNote({
  x,
  y,
  w,
  h,
  tilt,
  paper,
  lines,
  d,
  under,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tilt: number;
  paper: StickyPaper;
  lines: readonly string[];
  d: number;
  // Drawn on the paper under the writing (the highlighter's swipe).
  under?: ReactNode;
}) {
  return (
    <g className="hm-pop" style={at(d)}>
      <g transform={`rotate(${tilt} ${x + w / 2} ${y + h / 2})`}>
        <path
          d={`M${x + 3} ${y + h * 0.3} L${x + w - 3} ${y + h * 0.3} L${x + w + 3} ${y + h + 5} L${x - 3} ${y + h + 5} Z`}
          fill="#0f172a"
          opacity="0.07"
        />
        <path
          d={`M${x + 1} ${y + h * 0.55} L${x + w - 1} ${y + h * 0.55} L${x + w + 1.5} ${y + h + 2.5} L${x - 1.5} ${y + h + 2.5} Z`}
          fill="#0f172a"
          opacity="0.12"
        />
        <rect x={x} y={y} width={w} height={h} fill={paper.fill} />
        <rect x={x} y={y} width={w} height={h * 0.18} fill="#0f172a" opacity="0.04" />
        {under}
        {lines.map((line, i) => (
          <text
            key={line}
            x={x + 11}
            y={y + 36 + i * 22}
            fontFamily={HAND}
            fontSize="21"
            fontWeight="600"
            fill={paper.ink}
            stroke="none"
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// A sticker from the editor's own catalogue on its die-cut plate (stickerArt), so it is drawn the
// way the canvas draws one.
export function Sticker({
  def,
  x,
  y,
  size,
  tilt,
  d,
}: {
  def: StickerDef;
  x: number;
  y: number;
  size: number;
  tilt: number;
  d: number;
}) {
  const { viewBox, markup } = stickerArt(def);
  return (
    <g className="hm-pop" style={at(d) as CSSProperties}>
      <g transform={`rotate(${tilt} ${x + size / 2} ${y + size / 2})`}>
        <svg
          x={x}
          y={y}
          width={size}
          height={size}
          viewBox={viewBox}
          overflow="visible"
          dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
        />
      </g>
    </g>
  );
}
