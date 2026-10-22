// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/editor:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import type {} from 'react';
import { Scene, Shape, Panel, Label } from './primitives';

// --- Glyphs ------------------------------------------------------------------

const GLYPH = {
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

function DotsGlyph({ x, y, tone = 'slate' }: { x: number; y: number; tone?: 'slate' | 'brand' }) {
  const cls = tone === 'brand' ? 'fill-brand-500' : 'fill-slate-400';
  return (
    <g>
      <circle cx={x - 4} cy={y} r={1.3} className={cls} />
      <circle cx={x} cy={y} r={1.3} className={cls} />
      <circle cx={x + 4} cy={y} r={1.3} className={cls} />
    </g>
  );
}

// --- Fixed chrome ------------------------------------------------------------

/** One tab pill in the bottom bar. */
function TabPill({
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
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={6}
        className={active ? 'fill-white stroke-brand-400' : 'fill-slate-100 stroke-slate-200'}
        strokeWidth={1.2}
      />
      <Label
        x={x + 9}
        y={y + 11}
        size={10}
        weight={active ? 700 : 500}
        tone={active ? 'strong' : 'body'}
      >
        {label}
      </Label>
      {active && <DotsGlyph x={x + w - 11} y={y + 10} />}
    </g>
  );
}

/** The quick controls at the right-hand end of the bottom bar: Search,
 *  Settings and the appearance switch, labelled as on a computer. */
function QuickControlsRow({ x, y, labelled = true }: { x: number; y: number; labelled?: boolean }) {
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

/** The bottom-right corner cluster: Undo / Redo, Layers, the Theme & canvas
 *  paintbrush, then the zoom controls (minus, the level, plus). */
function CornerCluster({ x, y, level = '100%' }: { x: number; y: number; level?: string }) {
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
          d={`M${x + 63} ${y + 11} l7 -4 l7 4 l-7 4 Z M${x + 63} ${y + 16} l7 4 l7 -4`}
          {...GLYPH}
        />
      </Panel>
      <Panel x={x + 88} y={y} w={28} h={28}>
        <path
          d={`M${x + 96} ${y + 21} q1 -5 5 -5 l6 -7 l2 2 l-7 6 q0 4 -6 4 Z`}
          className="stroke-brand-500"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
        />
      </Panel>
      <Panel x={x + 120} y={y} w={94} h={28}>
        <Label x={x + 134} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          −
        </Label>
        <Label x={x + 167} y={y + 15} size={10} weight={600} tone="body" anchor="middle">
          {level}
        </Label>
        <Label x={x + 200} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          +
        </Label>
      </Panel>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The bottom bar's tabs: the Tabs label, the active tab with its menu
 *  button and a presence avatar, another tab, a collapsible folder, the +
 *  button, and the quick controls at the far end. */
export function TabBar() {
  const y = 96;
  return (
    <Scene w={500} h={140}>
      <Shape x={195} y={22} w={110} h={46} label="Checkout" />
      <rect x={0} y={y} width={500} height={36} className="fill-white" />
      <line x1={0} y1={y} x2={500} y2={y} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={10} y={y + 19} size={10} weight={700} tone="muted">
        TABS
      </Label>
      {/* Active tab, with a presence avatar and its ⋯ menu button. */}
      <rect
        x={40}
        y={y + 7}
        width={92}
        height={22}
        rx={6}
        className="fill-white stroke-brand-400"
        strokeWidth={1.2}
      />
      <Label x={47} y={y + 19} size={9.5} weight={700} tone="strong">
        Overview
      </Label>
      <circle cx={108} cy={y + 18} r={5} className="fill-emerald-400" />
      <DotsGlyph x={122} y={y + 18} />
      <TabPill x={140} y={y + 8} w={40} label="Flow" />
      {/* A collapsed tab folder, as TabFolderChip draws it: dashed slate, folder glyph, the name in
          capitals and a count. */}
      <rect
        x={188}
        y={y + 8}
        width={60}
        height={20}
        rx={6}
        className="fill-slate-50 stroke-slate-300"
        strokeWidth={1.2}
        strokeDasharray="3 2"
      />
      <path
        d={`M193 ${y + 14} h4 l1.5 2 h4.5 v6 h-10 Z`}
        className="fill-none stroke-slate-500"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Label x={207} y={y + 19} size={8.5} weight={700} tone="muted">
        IDEAS
      </Label>
      <circle cx={240} cy={y + 18} r={5} className="fill-slate-200" />
      <Label x={240} y={y + 19} anchor="middle" size={7.5} weight={700} tone="body">
        2
      </Label>
      <Label x={262} y={y + 19} size={15} weight={600} tone="muted" anchor="middle">
        +
      </Label>
      {/* On a computer the quick controls carry their words, beside the TABS label. */}
      <QuickControlsRow x={310} y={y + 18} />
    </Scene>
  );
}

/** The bottom-right cluster with the zoom presets open above the level:
 *  25% to 150% and Fit to screen. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const px = 231;
  const py = 14;
  return (
    <Scene w={420} h={240}>
      <Shape x={40} y={60} w={110} h={52} label="Detail" />
      <Panel x={px} y={py} w={92} h={170}>
        {presets.map((p, i) => {
          const ry = py + 8 + i * 22;
          const on = p === '100%';
          return (
            <g key={p}>
              {on && (
                <rect x={px + 5} y={ry} width={82} height={20} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={px + 46}
                y={ry + 11}
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
                anchor="middle"
              >
                {p}
              </Label>
            </g>
          );
        })}
        <line
          x1={px + 8}
          y1={py + 143}
          x2={px + 84}
          y2={py + 143}
          className="stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={px + 46} y={py + 157} size={10} weight={500} tone="body" anchor="middle">
          Fit to screen
        </Label>
      </Panel>
      <CornerCluster x={110} y={198} />
    </Scene>
  );
}
