// The drawing parts the editor-feature, tab and connection illustrations (./features,
// ./foundations) are built from: a collaborator's pointer with its name tag, a small editor
// window, a node on the canvas, an arrow between nodes, and a key cap. Every part reads the
// canvas palette (--art-*) or pairs its light colour with a dark: one, so a card reads the same
// in either appearance.
//
// Feature-specific on purpose: ./shared holds what every feature-art file uses (Frame and the
// colour constants), and none of these are wanted elsewhere.

import type { CSSProperties } from 'react';
import { Cursor, SKY } from '@liveworkspace/marketing-site/components/feature-art/shared';

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

// ── Scene-specific parts for ./features: the tab bar's pills, a window's tabs and its roadmap,
// the undo cluster, a layer plane and the Layers panel's eye, a photograph and its selection
// handles, a palette tile with its key, and a sticky collecting votes.

// One tab pill in the bottom bar: the mode glyph (a small diagram mark) in the tab's accent, its
// name, and on the active tab a tint and the people on it.
export function TabPill({
  x,
  name,
  color,
  w,
  active = false,
  className,
}: {
  x: number;
  name: string;
  color: string;
  w: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <g className={className}>
      {active ? (
        <rect x={x} y="71" width={w} height="16" rx="4" fill={color} fillOpacity="0.14" />
      ) : null}
      <g fill="none" stroke={color} strokeWidth="1" transform={`translate(${x + 5} 75.5)`}>
        <rect x="0" y="0" width="3.2" height="3.2" rx="0.6" />
        <rect x="4.6" y="3.8" width="3.2" height="3.2" rx="0.6" />
        <path d="M1.6 3.2 V5.4 H4.6" />
      </g>
      <text
        className={active ? undefined : SUBTLE}
        x={x + 15}
        y="81.3"
        fontSize="6.5"
        fontWeight={active ? 700 : 500}
        fill={active ? color : undefined}
      >
        {name}
      </text>
    </g>
  );
}

// A sticky with its dot votes landing one by one, and the count badge once they are in.
export function VoteSticky({
  x,
  fill,
  ink,
  label,
  votes,
  i,
}: {
  x: number;
  fill: string;
  ink: string;
  label: string;
  votes: number;
  i: number;
}) {
  return (
    <g>
      <rect
        x={x + 0.6}
        y="15.5"
        width="44"
        height="40"
        rx="1.5"
        fill="#0f172a"
        fillOpacity="0.08"
      />
      <rect x={x} y="14" width="44" height="40" rx="1.5" fill={fill} />
      <text x={x + 5} y="25" fontSize="6" fontWeight="600" fill={ink}>
        {label}
      </text>
      {Array.from({ length: votes }, (_, d) => (
        <circle
          key={d}
          className="fa-pop"
          style={{ animationDelay: `${0.25 + (i * 3 + d) * 0.18}s` }}
          cx={x + 8 + d * 7}
          cy="45"
          r="2.8"
          fill={SKY}
          stroke="#fff"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

// Every features scene is drawn on a 300 by 96 stage, the card's art frame at its usual width.
export const VIEW = '0 0 300 96';

// A CSS custom property set for a moving piece's destination (fa-b-go, fa-b-drag, fa-b-carry).
export const to = (x: number, y: number, extra?: Record<string, string>) =>
  ({ '--tx': `${x}px`, '--ty': `${y}px`, ...extra }) as CSSProperties;
