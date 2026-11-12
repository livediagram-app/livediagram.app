// The scene-specific drawing parts for ./features: the tab bar's pills, a window's tabs and its
// roadmap, the undo cluster, a layer plane and the Layers panel's eye, a photograph and its
// selection handles, a palette tile with its key, and a sticky collecting votes. The core parts
// (pointer, mini window, node, arrow, key cap and the panel colours) live in ./features-parts-core,
// re-exported here so every feature-art file imports its parts from one place.

import type { ReactNode } from 'react';
import { EMERALD, SKY, VIOLET } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { PANEL, PanelShadow, SUBTLE } from './features-parts-core';

export * from './features-parts-core';

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

// A tiny roadmap: three bars on lanes, the content a Roadmap tab holds.
export function RoadmapBars({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="stroke-slate-200 dark:stroke-slate-700"
        d="M0 0 V34 M28 0 V34 M56 0 V34 M84 0 V34"
        strokeWidth="0.6"
      />
      <rect x="4" y="3" width="40" height="7" rx="2" fill={SKY} />
      <rect x="24" y="13" width="44" height="7" rx="2" fill={VIOLET} />
      <rect x="50" y="23" width="32" height="7" rx="2" fill={EMERALD} />
    </g>
  );
}

// A small row of a window's tabs along its foot.
export function WindowTab({
  x,
  y,
  name,
  color,
  active,
  className,
}: {
  x: number;
  y: number;
  name: string;
  color: string;
  active?: boolean;
  className?: string;
}) {
  const w = name.length * 3.6 + 10;
  return (
    <g className={className}>
      <rect
        x={x}
        y={y}
        width={w}
        height="9"
        rx="2.5"
        fill={color}
        fillOpacity={active ? 0.16 : 0}
      />
      <circle cx={x + 4} cy={y + 4.5} r="1.6" fill={color} />
      <text
        className={active ? undefined : SUBTLE}
        x={x + 7.5}
        y={y + 6.5}
        fontSize="5.2"
        fontWeight={active ? 700 : 500}
        fill={active ? color : undefined}
      >
        {name}
      </text>
    </g>
  );
}

// The canvas cluster's undo and redo buttons, bottom right, as the editor draws them.
export function UndoCluster({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <PanelShadow x={0} y={0} w={44} h={18} r={4} />
      <rect className={PANEL} width="44" height="18" rx="4" strokeWidth="1" />
      <rect
        className="fa-b-press"
        x="2"
        y="2"
        width="19"
        height="14"
        rx="3"
        fill={SKY}
        fillOpacity="0.18"
      />
      <path className="stroke-slate-200 dark:stroke-slate-700" d="M22 3 V15" strokeWidth="1" />
      <g
        className="stroke-slate-600 dark:stroke-slate-300"
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6.5 H13.5 a3 3 0 0 1 0 6 H8.5" />
        <path d="M10.5 4.3 L8.2 6.5 L10.5 8.7" />
        <path d="M35 6.5 H30.5 a3 3 0 0 0 0 6 H35.5" />
        <path d="M33.5 4.3 L35.8 6.5 L33.5 8.7" />
      </g>
    </g>
  );
}

// One layer plane in the isometric stack, centred at (110, y).
export function Plane({
  y,
  fill,
  stroke,
  className,
  children,
}: {
  y: number;
  fill: string;
  stroke: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <g className={className}>
      <g transform={`translate(76 ${y})`}>
        <path d="M-50 0 0 15 50 0 0 -15 Z" className={fill} strokeWidth="1.2" />
        <path d="M-50 0 0 15 50 0 0 -15 Z" fill="none" className={stroke} strokeWidth="1.2" />
        {children}
      </g>
    </g>
  );
}

// An eye in the Layers panel: open, or struck through once the layer is hidden.
export function Eye({ x, y, hides = false }: { x: number; y: number; hides?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="stroke-slate-500 dark:stroke-slate-400"
      fill="none"
      strokeWidth="0.9"
    >
      <path d="M-4 0 C-2.2 -2.6 2.2 -2.6 4 0 C2.2 2.6 -2.2 2.6 -4 0 Z" />
      <circle r="1.1" />
      {hides ? <path className="fa-b-late" d="M-4 3 L4 -3" strokeWidth="1.1" /> : null}
    </g>
  );
}

// A landscape photograph, drawn: a sky gradient, the sun, two ranges of hills and a lake line.
export function Photo({
  x,
  y,
  w,
  h,
  id,
  tint = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
  tint?: number;
}) {
  const skies = [
    ['#7dd3fc', '#e0f2fe'],
    ['#f9a8d4', '#fde68a'],
    ['#c4b5fd', '#e0e7ff'],
    ['#6ee7b7', '#ecfccb'],
  ][tint]!;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skies[0]} />
          <stop offset="1" stopColor={skies[1]} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x={x} y={y} width={w} height={h} rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
        <circle cx={x + w * 0.72} cy={y + h * 0.32} r={h * 0.13} fill="#fef3c7" />
        <path
          d={`M${x} ${y + h * 0.78} L${x + w * 0.28} ${y + h * 0.42} L${x + w * 0.5} ${y + h * 0.66} L${x + w * 0.7} ${y + h * 0.48} L${x + w} ${y + h * 0.74} V${y + h} H${x} Z`}
          fill="#0ea5e9"
          fillOpacity="0.55"
        />
        <path
          d={`M${x} ${y + h * 0.88} L${x + w * 0.4} ${y + h * 0.62} L${x + w} ${y + h * 0.9} V${y + h} H${x} Z`}
          fill="#0369a1"
          fillOpacity="0.75"
        />
      </g>
    </g>
  );
}

// An image element's selection: its outline and four corner handles.
export function Handles({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect
        x={x - 1.5}
        y={y - 1.5}
        width={w + 3}
        height={h + 3}
        rx="3"
        fill="none"
        stroke={SKY}
        strokeWidth="1.1"
      />
      {[
        [x - 1.5, y - 1.5],
        [x + w + 1.5, y - 1.5],
        [x - 1.5, y + h + 1.5],
        [x + w + 1.5, y + h + 1.5],
      ].map(([cx, cy], i) => (
        <rect
          key={i}
          className="fill-white dark:fill-slate-900"
          x={cx! - 2.2}
          y={cy! - 2.2}
          width="4.4"
          height="4.4"
          rx="1"
          stroke={SKY}
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

// A palette tile in the strip: its glyph, and the key that drops it once ⌘ is held.
export function PaletteTile({
  x,
  glyph,
  keyLabel,
  i,
}: {
  x: number;
  glyph: ReactNode;
  keyLabel: string;
  i: number;
}) {
  return (
    <g>
      <g
        className="stroke-slate-600 dark:stroke-slate-300"
        fill="none"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${x + 11} 44)`}
      >
        {glyph}
      </g>
      <g className="fa-b-hold" style={{ animationDelay: `${i * 0.05}s` }}>
        <rect x={x + 14} y="30" width="10" height="9" rx="2" fill={SKY} />
        <text x={x + 19} y="36.6" textAnchor="middle" fontSize="5.8" fontWeight="700" fill="#fff">
          {keyLabel}
        </text>
      </g>
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
