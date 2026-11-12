// The editor's fixed chrome the User Interface figures (user-interface.tsx) are composed from: the
// glyphs, the bottom bar with its tab card, tab pill and quick controls, and the bottom-right
// corner cluster (Undo / Redo, the Theme & canvas paintbrush, zoom). livehuddle's cluster has no
// Layers button, and its icon buttons can be drawn pressed in the brand colour.

import type { ReactNode } from 'react';
import { Label, Panel } from '@liveworkspace/help-site/art/primitives';

// --- Glyphs ------------------------------------------------------------------

export const GLYPH = {
  className: 'stroke-slate-500',
  strokeWidth: 1.6,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function SearchGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={4.5} {...GLYPH} />
      <path d="M3.4 3.4 L6.5 6.5" {...GLYPH} />
    </g>
  );
}

// Settings is two-and-more sliders in the editor (lucide sliders-horizontal),
// never a cog: a cog's spokes read as the appearance toggle's sun.
function SettingsGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-7 -4 h3 M-1 -4 h8 M-7 0 h7 M3 0 h4 M-7 4 h2 M1 4 h6 M-2.5 -6 v4 M1.5 -2 v4 M-3 2 v4"
        {...GLYPH}
        strokeLinecap="round"
      />
    </g>
  );
}

function SunGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={3} {...GLYPH} />
      <path
        d="M0 -7 v1.8 M0 7 v-1.8 M-7 0 h1.8 M7 0 h-1.8 M-5 -5 l1.3 1.3 M5 5 l-1.3 -1.3 M5 -5 l-1.3 1.3 M-5 5 l1.3 -1.3"
        {...GLYPH}
      />
    </g>
  );
}

export function DotsGlyph({
  x,
  y,
  tone = 'slate',
}: {
  x: number;
  y: number;
  tone?: 'slate' | 'brand';
}) {
  const cls = tone === 'brand' ? 'fill-brand-500' : 'fill-slate-400';
  return (
    <g>
      <circle cx={x - 4} cy={y} r={1.3} className={cls} />
      <circle cx={x} cy={y} r={1.3} className={cls} />
      <circle cx={x + 4} cy={y} r={1.3} className={cls} />
    </g>
  );
}

/** A square icon button on a toolbar or in the corner cluster. */
export function IconButton({
  x,
  y,
  size = 24,
  tone = 'plain',
  children,
}: {
  x: number;
  y: number;
  size?: number;
  /** `brand` fills it in the brand colour, as a pressed toggle button draws. */
  tone?: 'plain' | 'brand';
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={6}
        className={tone === 'brand' ? 'fill-brand-500' : 'fill-slate-50'}
      />
      {/* A brand button's white glyph stays white in dark mode too (help-art-as-drawn). */}
      <g
        transform={`translate(${x + size / 2} ${y + size / 2})`}
        className={tone === 'brand' ? 'help-art-as-drawn' : undefined}
      >
        {children}
      </g>
    </g>
  );
}

// --- Fixed chrome ------------------------------------------------------------

/** The open tab's card: rounded only at the top, joining the bar's bottom edge. */
export function TabCard({
  x,
  top,
  bottom,
  w,
}: {
  x: number;
  top: number;
  bottom: number;
  w: number;
}) {
  const r = 6;
  return (
    <path
      d={`M${x} ${bottom} V${top + r} a${r} ${r} 0 0 1 ${r} ${-r} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${bottom} Z`}
      className="fill-white stroke-slate-300"
      strokeWidth={1}
    />
  );
}

/** One tab in the bottom bar, standing on its bottom edge: the open one a card with its name in
 *  the accent and its ⋯, the others bare names. */
export function TabPill({
  x,
  y,
  w,
  label,
  active = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g>
      {active && <TabCard x={x} top={y - 2} bottom={y + 25} w={w} />}
      <Label
        x={x + 9}
        y={y + 12}
        size={10}
        weight={active ? 650 : 500}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
      {active && <DotsGlyph x={x + w - 11} y={y + 11} />}
    </g>
  );
}

/** The quick controls at the right-hand end of the bottom bar: Search,
 *  Settings and the appearance switch, labelled as on a computer. */
export function QuickControlsRow({
  x,
  y,
  labelled = true,
}: {
  x: number;
  y: number;
  labelled?: boolean;
}) {
  if (!labelled) {
    return (
      <g>
        <SearchGlyph x={x + 8} y={y} />
        <SettingsGlyph x={x + 30} y={y} />
        <SunGlyph x={x + 52} y={y} />
      </g>
    );
  }
  return (
    <g>
      <SearchGlyph x={x + 8} y={y} />
      <Label x={x + 18} y={y + 1} size={10} tone="body">
        Search
      </Label>
      <SettingsGlyph x={x + 66} y={y} />
      <Label x={x + 77} y={y + 1} size={10} tone="body">
        Settings
      </Label>
      <SunGlyph x={x + 134} y={y} />
      <Label x={x + 145} y={y + 1} size={10} tone="body">
        Light
      </Label>
    </g>
  );
}

/** The bottom bar: tabs, the + button, then the quick
 *  controls at its right-hand end. */
export function BottomBar({
  y,
  w,
  labelled = false,
}: {
  y: number;
  w: number;
  labelled?: boolean;
}) {
  return (
    <g>
      <rect x={0} y={y} width={w} height={30} className="fill-slate-100" />
      <line x1={0} y1={y} x2={w} y2={y} className="stroke-slate-200" strokeWidth={1.5} />
      <TabPill x={46} y={y + 5} w={74} label="Overview" active />
      <TabPill x={124} y={y + 5} w={44} label="Flow" />
      <Label x={180} y={y + 16} size={14} weight={600} tone="muted" anchor="middle">
        +
      </Label>
      <QuickControlsRow x={labelled ? w - 182 : w - 72} y={y + 15} labelled={labelled} />
    </g>
  );
}

/** The bottom-right corner cluster: Undo / Redo, the Theme & canvas
 *  paintbrush, then the zoom controls (minus, the level, plus). */
export function CornerCluster({ x, y, level = '100%' }: { x: number; y: number; level?: string }) {
  return (
    <g>
      <Panel x={x} y={y} w={52} h={28}>
        <path d={`M${x + 10} ${y + 15} a6 6 0 1 1 3 5`} {...GLYPH} />
        <path d={`M${x + 8} ${y + 11} l2 4 l4 -2`} {...GLYPH} />
        <path d={`M${x + 42} ${y + 15} a6 6 0 1 0 -3 5`} {...GLYPH} />
        <path d={`M${x + 44} ${y + 11} l-2 4 l-4 -2`} {...GLYPH} />
      </Panel>
      <Panel x={x + 56} y={y} w={28} h={28}>
        <path
          d={`M${x + 64} ${y + 21} q1 -5 5 -5 l6 -7 l2 2 l-7 6 q0 4 -6 4 Z`}
          className="stroke-brand-500"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
        />
      </Panel>
      <Panel x={x + 88} y={y} w={94} h={28}>
        <Label x={x + 102} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          −
        </Label>
        <Label x={x + 135} y={y + 15} size={10} weight={600} tone="body" anchor="middle">
          {level}
        </Label>
        <Label x={x + 168} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          +
        </Label>
      </Panel>
    </g>
  );
}
