// The drawing parts the API and MCP illustrations (./foundations) are built from: a small editor
// window, a card on its board, and the soft shadow a floating panel sits on. Every part reads the
// canvas palette (--art-*) or pairs its light colour with a dark: one, so a card reads the same in
// either appearance.
//
// Feature-specific on purpose: ./shared holds what every feature-art file uses (Frame and the
// colour constants), and none of these are wanted elsewhere.

import type { ReactNode } from 'react';

// Panel chrome in an SVG scene: the white of the editor's panels, slate-900 in dark.
export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
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

// A card in the Default scheme: the ink fill and stroke, and an optional label.
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
