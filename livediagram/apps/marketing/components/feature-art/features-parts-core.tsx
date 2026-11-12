// The core drawing parts the editor-feature, tab and connection illustrations (./features,
// ./foundations) are built from (re-exported by ./features-parts): a collaborator's pointer with its name tag, a small editor
// window, a node on the canvas, an arrow between nodes, and a key cap. Every part reads the
// canvas palette (--art-*) or pairs its light colour with a dark: one, so a card reads the same
// in either appearance.
//
// Feature-specific on purpose: ./shared holds what every feature-art file uses (Frame and the
// colour constants), and none of these are wanted elsewhere.

import type { CSSProperties, ReactNode } from 'react';
import { Cursor } from '@liveworkspace/marketing-site/components/feature-art/shared';

// Panel chrome in an SVG scene: the white of the editor's panels, slate-900 in dark.
export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
// A muted rule or placeholder line inside a panel.
export const MUTED = 'fill-slate-200 dark:fill-slate-700';
// Secondary text inside a panel.
export const SUBTLE = 'fill-slate-500 dark:fill-slate-400';
// Primary text inside a panel.
export const STRONG = 'fill-slate-800 dark:fill-slate-100';

// A soft drop shadow under a floating panel, drawn as a blurred-looking offset rect (no filter,
// so it stays crisp at any scale and cheap to paint).
export function PanelShadow({
  x,
  y,
  w,
  h,
  r = 4,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}) {
  return (
    <rect
      className="fill-slate-900/[0.06] dark:fill-black/40"
      x={x + 0.5}
      y={y + 1.5}
      width={w}
      height={h}
      rx={r}
    />
  );
}

// A collaborator's pointer and name tag, as the editor draws a teammate's cursor: the arrow in
// their colour with a white edge, the initials on a pill beside it. Its tip sits at (0, 0).
// `flip` hangs the name tag above and to the pointer's left, for a pointer working near the
// right or bottom edge.
export function Pointer({
  color,
  name,
  flip = false,
}: {
  color: string;
  name?: string;
  flip?: boolean;
}) {
  return <Cursor color={color} name={name} size={11.5} flip={flip} />;
}

// A node on the canvas in the Default scheme: the ink fill and stroke, and an optional label.
export function Node({
  x,
  y,
  w,
  h,
  label,
  r = 4,
  className,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  r?: number;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <g className={className}>
      <rect
        className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        strokeWidth="1.6"
        strokeDasharray={dashed ? '4 2.5' : undefined}
      />
      {label ? (
        <text
          className="fill-(--art-ink-text)"
          x={x + w / 2}
          y={y + h / 2 + 2.3}
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="600"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

// An arrow on the canvas: a path with the editor's filled triangle head at its end.
export function Arrow({ d, head }: { d: string; head: [number, number, number] }) {
  const [x, y, angle] = head;
  return (
    <g>
      <path className="stroke-(--art-arrow)" d={d} fill="none" strokeWidth="1.4" />
      <path
        className="fill-(--art-arrow)"
        d="M0 0 L-5 -2.6 L-5 2.6 Z"
        transform={`translate(${x} ${y}) rotate(${angle})`}
      />
    </g>
  );
}

// A small editor window: a title bar with three dots and a name, and a dotted canvas below.
export function MiniWindow({
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
  title: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <PanelShadow x={x} y={y} w={w} h={h} r={5} />
      <rect className={PANEL} x={x} y={y} width={w} height={h} rx="5" strokeWidth="1" />
      <path
        className="fill-slate-50 dark:fill-slate-800"
        d={`M${x + 0.5} ${y + 13} V${y + 5} a4.5 4.5 0 0 1 4.5 -4.5 H${x + w - 5} a4.5 4.5 0 0 1 4.5 4.5 V${y + 13} Z`}
      />
      <path
        className="stroke-slate-200 dark:stroke-slate-700"
        d={`M${x} ${y + 13} H${x + w}`}
        strokeWidth="1"
      />
      {['#fb7185', '#fbbf24', '#34d399'].map((c, i) => (
        <circle key={c} cx={x + 6 + i * 5} cy={y + 6.8} r="1.6" fill={c} />
      ))}
      <text
        className={SUBTLE}
        x={x + w / 2}
        y={y + 9}
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="600"
      >
        {title}
      </text>
      {children}
    </g>
  );
}

// A key cap, raised: a face over a darker base, the label centred. `pressed` drops it onto its
// base (the fa-b-key loop) as the key goes down.
export function KeyCap({
  x,
  y,
  w = 16,
  label,
  pressed = false,
  delay,
}: {
  x: number;
  y: number;
  w?: number;
  label: string;
  pressed?: boolean;
  delay?: string;
}) {
  return (
    <g>
      <rect
        className="fill-slate-300 dark:fill-slate-950"
        x={x}
        y={y + 2}
        width={w}
        height="16"
        rx="3.5"
      />
      <g
        className={pressed ? 'fa-b-key' : undefined}
        style={delay ? { animationDelay: delay } : undefined}
      >
        <rect
          className="fill-white stroke-slate-300 dark:fill-slate-700 dark:stroke-slate-600"
          x={x}
          y={y}
          width={w}
          height="16"
          rx="3.5"
          strokeWidth="0.8"
        />
        <text
          className={STRONG}
          x={x + w / 2}
          y={y + 10.8}
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="600"
        >
          {label}
        </text>
      </g>
    </g>
  );
}

// Every features scene is drawn on a 300 by 96 stage, the card's art frame at its usual width.
export const VIEW = '0 0 300 96';

// A CSS custom property set for a moving piece's destination (fa-b-go, fa-b-drag, fa-b-carry).
export const to = (x: number, y: number, extra?: Record<string, string>) =>
  ({ '--tx': `${x}px`, '--ty': `${y}px`, ...extra }) as CSSProperties;
