// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/live:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, SelectionBox, Panel, Label } from './primitives';
import { MenuCard, Strip } from './toolbar-layout';

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

/** A square icon button on a toolbar or in the corner cluster. */
function IconButton({
  x,
  y,
  size = 24,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  children: ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={6} className="fill-slate-50" />
      <g transform={`translate(${x + size / 2} ${y + size / 2})`}>{children}</g>
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

/** The bottom bar: the Tabs label, tab pills, the + button, then the quick
 *  controls at its right-hand end. */
function BottomBar({ y, w, labelled = false }: { y: number; w: number; labelled?: boolean }) {
  return (
    <g>
      <rect x={0} y={y} width={w} height={30} className="fill-white" />
      <line x1={0} y1={y} x2={w} y2={y} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={10} y={y + 16} size={10} weight={700} tone="muted">
        TABS
      </Label>
      <TabPill x={46} y={y + 5} w={74} label="Overview" active />
      <TabPill x={124} y={y + 5} w={44} label="Flow" />
      <Label x={180} y={y + 16} size={14} weight={600} tone="muted" anchor="middle">
        +
      </Label>
      <QuickControlsRow x={labelled ? w - 182 : w - 72} y={y + 15} labelled={labelled} />
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

/** The whole frame at a glance: the menu button card top-left, the palette strip across the
 *  top, a Vote panel docked top-right under it, the Map bottom-left, the corner cluster
 *  bottom-right, and the bottom bar. */
export function PanelLayout() {
  return (
    <Scene w={420} h={250}>
      <MenuCard x={12} y={12} />
      <Strip x={82} y={12} />
      <Panel x={318} y={56} w={90} h={66} title="AI ASSISTANT">
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={328}
            y={88 + i * 14}
            width={i === 0 ? 62 : 44}
            height={6}
            rx={3}
            className={i === 0 ? 'fill-brand-200' : 'fill-slate-200'}
          />
        ))}
      </Panel>
      <Shape x={146} y={68} w={74} h={38} label="Start" />
      <Shape x={146} y={134} w={74} h={38} accent label="Ship" />
      <Arrow from={[183, 106]} to={[183, 134]} />
      <Panel x={12} y={150} w={92} h={58} title="MAP">
        <rect x={36} y={182} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect x={36} y={194} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect
          x={28}
          y={178}
          width={46}
          height={26}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.4}
        />
      </Panel>
      <CornerCluster x={194} y={182} />
      <BottomBar y={220} w={420} />
    </Scene>
  );
}

/** The quick controls, close up: Search, Settings and the appearance switch
 *  at the right-hand end of the bottom bar, each named beside its icon. */
export function QuickControls() {
  return (
    <Scene w={420} h={130}>
      <Shape x={60} y={20} w={80} h={40} label="Idea" />
      <BottomBar y={86} w={420} labelled />
      <rect
        x={232}
        y={90}
        width={182}
        height={22}
        rx={6}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    </Scene>
  );
}

/** The bottom bar's tabs: the Tabs label, the active tab with its menu
 *  button and a presence avatar, another tab, a collapsible folder, the +
 *  button, and the quick controls at the far end. */
export function TabBar() {
  const y = 96;
  return (
    <Scene w={420} h={140}>
      <Shape x={150} y={22} w={110} h={46} label="Checkout" />
      <rect x={0} y={y} width={420} height={36} className="fill-white" />
      <line x1={0} y1={y} x2={420} y2={y} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={10} y={y + 19} size={10} weight={700} tone="muted">
        TABS
      </Label>
      {/* Active tab, with a presence avatar and its ⋯ menu button. */}
      <rect
        x={46}
        y={y + 7}
        width={100}
        height={22}
        rx={6}
        className="fill-white stroke-brand-400"
        strokeWidth={1.2}
      />
      <Label x={55} y={y + 19} size={10} weight={700} tone="strong">
        Overview
      </Label>
      <circle cx={117} cy={y + 18} r={6} className="fill-emerald-400" />
      <DotsGlyph x={134} y={y + 18} />
      <TabPill x={150} y={y + 8} w={44} label="Flow" />
      {/* A collapsed tab folder. */}
      <rect
        x={198}
        y={y + 8}
        width={58}
        height={20}
        rx={6}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1.2}
      />
      <path
        d={`M206 ${y + 14} l4 4 l-4 4`}
        className="stroke-brand-500"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      <Label x={215} y={y + 19} size={10} weight={600} tone="accent">
        Ideas
      </Label>
      <Label x={270} y={y + 19} size={15} weight={600} tone="muted" anchor="middle">
        +
      </Label>
      <QuickControlsRow x={340} y={y + 18} labelled={false} />
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

/** One selected shape with its toolbar above: the "Selected Square" caption,
 *  then More, Add text, Duplicate, Bring to front, Send to back, Lock and
 *  Delete (an editor's toolbar; Add Comment is in the More menu). */
export function ContextualToolbar() {
  const tx = 92;
  const ty = 40;
  const buttons: ReactNode[] = [
    <DotsGlyph key="more" x={0} y={0} />,
    <path key="text" d="M-5 -5 h10 M0 -5 v10" {...GLYPH} />,
    <g key="dup">
      <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
    </g>,
    <path key="front" d="M0 5 V-5 M-4 -1 L0 -5 L4 -1" {...GLYPH} />,
    <path key="back" d="M0 -5 V5 M-4 1 L0 5 L4 1" {...GLYPH} />,
    <g key="lock">
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} {...GLYPH} />
      <path d="M-3 -1 v-2 a3 3 0 0 1 6 0 v2" {...GLYPH} />
    </g>,
    <path key="delete" d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} />,
  ];
  return (
    <Scene w={420} h={210}>
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Square
      </Label>
      <Panel x={tx} y={ty} w={8 + buttons.length * 30} h={34}>
        {buttons.map((g, i) => (
          <IconButton key={i} x={tx + 6 + i * 30} y={ty + 5}>
            {g}
          </IconButton>
        ))}
      </Panel>
      <Shape x={150} y={108} w={120} h={60} label="Checkout" />
      <SelectionBox x={150} y={108} w={120} h={60} />
    </Scene>
  );
}

/** A mixed marquee selection (two shapes and an arrow) with the multi-select
 *  toolbar: More, Filter Selection, Duplicate, Export, Lock and Delete. */
export function MultiSelectToolbar() {
  const tx = 116;
  const ty = 34;
  const buttons: ReactNode[] = [
    <DotsGlyph key="more" x={0} y={0} />,
    <path key="filter" d="M-6 -5 h12 l-5 5 v5 l-2 -1 v-4 Z" {...GLYPH} />,
    <g key="dup">
      <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
    </g>,
    <path key="export" d="M0 3 V-6 M-4 -2 L0 -6 L4 -2 M-6 3 v3 h12 v-3" {...GLYPH} />,
    <g key="lock">
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} {...GLYPH} />
      <path d="M-3 -1 v-2 a3 3 0 0 1 6 0 v2" {...GLYPH} />
    </g>,
    <path key="delete" d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} />,
  ];
  return (
    <Scene w={420} h={220}>
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Elements (3)
      </Label>
      <Panel x={tx} y={ty} w={8 + buttons.length * 30} h={34}>
        {buttons.map((g, i) => (
          <IconButton key={i} x={tx + 6 + i * 30} y={ty + 5}>
            {g}
          </IconButton>
        ))}
      </Panel>
      <Shape x={94} y={112} w={90} h={46} label="Cart" />
      <Shape x={250} y={112} w={90} h={46} accent label="Pay" />
      <Arrow from={[184, 135]} to={[250, 135]} />
      <SelectionBox x={86} y={102} w={262} h={66} />
    </Scene>
  );
}

/** The element menu for a shape: collapsible sections, Layer first, then
 *  Size, Shape, Rotation, the Style and Text flyouts, Collaborate and
 *  Resources. */
export function ElementContextMenu() {
  const sections: { label: string; flyout?: boolean }[] = [
    { label: 'Layer' },
    { label: 'Size' },
    { label: 'Shape' },
    { label: 'Rotation' },
    { label: 'Style', flyout: true },
    { label: 'Text', flyout: true },
    { label: 'Collaborate' },
    { label: 'Resources' },
  ];
  const mx = 214;
  const my = 16;
  return (
    <Scene w={420} h={230}>
      <Shape x={56} y={60} w={112} h={56} accent label="Order" />
      <SelectionBox x={56} y={60} w={112} h={56} />
      <Panel x={mx} y={my} w={160} h={8 + sections.length * 25}>
        {sections.map((sec, i) => {
          const ry = my + 4 + i * 25;
          const on = sec.label === 'Style';
          return (
            <g key={sec.label}>
              {on && (
                <rect x={mx + 4} y={ry} width={152} height={23} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={mx + 14}
                y={ry + 12}
                size={11}
                weight={on ? 600 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {sec.label}
              </Label>
              <path
                d={
                  sec.flyout
                    ? `M${mx + 142} ${ry + 8} l4 4 l-4 4`
                    : `M${mx + 140} ${ry + 10} l4 4 l4 -4`
                }
                className="stroke-slate-400"
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** The bottom-left Map panel: a zoomed-out wireframe of the canvas, the area
 *  outside your view dimmed, and a brand rectangle marking what you see. */
export function Minimap() {
  return (
    <Scene w={420} h={210}>
      {/* The canvas the map mirrors. */}
      <Shape x={196} y={26} w={68} h={38} label="A" />
      <Shape x={176} y={116} w={62} h={36} accent label="B" />
      <Shape x={300} y={116} w={62} h={36} kind="circle" label="C" />
      <Arrow from={[230, 64]} to={[207, 116]} kind="elbow" />
      <Arrow from={[230, 64]} to={[331, 116]} kind="elbow" />
      {/* The Map panel, bottom-left, with the current-view box. */}
      <Panel x={20} y={110} w={136} h={88} title="MAP">
        <rect x={26} y={136} width={124} height={56} rx={4} className="fill-slate-100" />
        <rect x={52} y={146} width={70} height={40} rx={3} className="fill-white" />
        <rect x={80} y={150} width={20} height={10} rx={2} className="fill-slate-300" />
        <rect x={68} y={172} width={17} height={9} rx={2} className="fill-slate-300" />
        <circle cx={112} cy={176} r={5} className="fill-slate-300" />
        <line x1={90} y1={160} x2={76} y2={172} className="stroke-slate-300" strokeWidth={1.2} />
        <line x1={90} y1={160} x2={110} y2={171} className="stroke-slate-300" strokeWidth={1.2} />
        <rect
          x={52}
          y={146}
          width={70}
          height={40}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.6}
        />
      </Panel>
    </Scene>
  );
}
