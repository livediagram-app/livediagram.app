// Editor-mode illustrations for the Canvas articles on Draw mode and Pages Mode
// (docs/specs/018-help/help-app.md): the mode switch beside the menu button with its menu open, the
// list of modes and the preview of one (chrome/editor-mode/ModeMenu.tsx), and Draw mode's dock
// across the top of the canvas (canvas/whiteboard/WhiteboardDock.tsx). Real labels throughout: the
// five modes, a mode's description and tools, ⇧D in the preview, the dock's tools and their keys.

import type { ReactNode } from 'react';
import { Scene, Label } from './primitives';
import { MenuCard, Strip } from './toolbar-layout';
import { ModeMark, type Mode } from './mode-mark';

// The modes in the switch's order (the catalogue's), each with its tint in the menu.
const MODES: { mode: Mode; tile: string; mark: string }[] = [
  { mode: 'Diagram', tile: 'fill-sky-100', mark: 'stroke-sky-700' },
  { mode: 'Draw', tile: 'fill-orange-100', mark: 'stroke-orange-700' },
  { mode: 'Facilitate', tile: 'fill-violet-100', mark: 'stroke-violet-700' },
  { mode: 'Pages', tile: 'fill-pink-100', mark: 'stroke-pink-700' },
  { mode: 'Plan', tile: 'fill-emerald-100', mark: 'stroke-emerald-700' },
];

/** The mode switch beside the menu button in the top-left card, its menu open: the list of the
 *  five modes (the current one checked, Plan marked as a new tab) and the preview of the one under
 *  the pointer, Draw: its picture, name with ⇧D, description and tools. */
export function ModeSwitchScene() {
  const mx = 40;
  const my = 54;
  const listW = 118;
  const pw = 210;
  const rowH = 28;
  const menuH = MODES.length * rowH + 12;
  const shown = 1;
  const px = mx + listW;
  return (
    <Scene w={420} h={my + menuH + 14}>
      <MenuCard x={12} y={14} />
      <Strip x={82} y={14} />
      {/* The menu, hanging below the switch */}
      <rect
        x={mx}
        y={my}
        width={listW + pw}
        height={menuH}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line
        x1={px}
        y1={my}
        x2={px}
        y2={my + menuH}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {MODES.map(({ mode, tile, mark }, i) => {
        const ry = my + 6 + i * rowH;
        const on = i === 0;
        return (
          <g key={mode}>
            {i === shown && (
              <rect
                x={mx + 4}
                y={ry}
                width={listW - 8}
                height={rowH - 2}
                rx={6}
                className="fill-slate-100"
              />
            )}
            <rect x={mx + 9} y={ry + 4} width={18} height={18} rx={5} className={tile} />
            <g transform={`translate(${mx + 18} ${ry + 13})`}>
              <ModeMark mode={mode} className={mark} scale={0.5} />
            </g>
            <Label
              x={mx + 34}
              y={ry + 13}
              size={11}
              weight={on ? 600 : 500}
              tone={on ? 'strong' : 'body'}
            >
              {mode}
            </Label>
            {on && (
              <path
                d={`M${mx + listW - 22} ${ry + 13} l3.5 3.5 l6 -7`}
                fill="none"
                className="stroke-brand-600"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {mode === 'Plan' && (
              // Plan opens in a new tab from a tab with something on it: a box with an arrow leaving it.
              <path
                d={`M${mx + listW - 18} ${ry + 9} h4 v4 M${mx + listW - 14} ${ry + 9} l-5 5 M${mx + listW - 16} ${ry + 14} v3 h-7 v-7 h3`}
                fill="none"
                className="stroke-slate-400"
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
      {/* The preview of Draw */}
      <rect
        x={px + 10}
        y={my + 10}
        width={pw - 20}
        height={50}
        rx={7}
        className="fill-orange-100"
      />
      <path
        d={`M${px + 30} ${my + 46} c10 -22 18 -26 24 -14 s10 14 18 -2 s16 -18 22 -4 s12 16 20 6 s10 -12 16 -10`}
        fill="none"
        className="stroke-orange-700"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Label x={px + 10} y={my + 76} size={12} weight={600} tone="strong">
        Draw
      </Label>
      <rect
        x={px + pw - 34}
        y={my + 69}
        width={24}
        height={15}
        rx={3}
        className="fill-slate-50 stroke-slate-300"
        strokeWidth={1}
      />
      <Label x={px + pw - 22} y={my + 77} anchor="middle" size={10} weight={600} tone="body">
        ⇧D
      </Label>
      <Label x={px + 10} y={my + 94} size={9.5} tone="body">
        Sketch freehand with pens, tidied into
      </Label>
      <Label x={px + 10} y={my + 106} size={9.5} tone="body">
        shapes as you go.
      </Label>
      {['Pens', 'Highlighter', 'Eraser'].map((tool, i) => {
        const tx = px + 10 + [0, 34, 94][i]!;
        const tw = [30, 56, 40][i]!;
        return (
          <g key={tool}>
            <rect x={tx} y={my + 115} width={tw} height={14} rx={7} className="fill-slate-100" />
            <Label x={tx + tw / 2} y={my + 122} anchor="middle" size={8.5} weight={500} tone="body">
              {tool}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
// --- Draw mode's dock --------------------------------------------------------------------------

/** One dock button: a glyph, with its key in the corner. */
function DockTool({
  x,
  y,
  keyName,
  on = false,
  children,
}: {
  x: number;
  y: number;
  keyName?: string;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={32}
        height={32}
        rx={7}
        className={on ? 'fill-brand-100 stroke-brand-300' : 'fill-transparent stroke-transparent'}
        strokeWidth={1.2}
      />
      <g transform={`translate(${x + 15} ${y + 17})`}>{children}</g>
      {keyName && (
        <Label x={x + 29} y={y + 7} anchor="end" size={10} weight={600} tone="muted">
          {keyName}
        </Label>
      )}
    </g>
  );
}

const STROKE = {
  fill: 'none',
  className: 'stroke-slate-600',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A marker nib in a given colour class. */
function Marker({ cls }: { cls: string }) {
  return (
    <g>
      <path
        d="M-4 6 l2 -7 l6 -6 l3 3 l-6 6 Z"
        fill="none"
        className="stroke-slate-600"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M-4 6 l2 -7 l4 4 Z" className={cls} />
    </g>
  );
}

/** Draw mode's dock across the top of the canvas: the drawing tools, the pinned shapes and Shapes, and
 *  Settings, each with its key, over a board with a pen stroke on it. */
export function DrawDockScene() {
  const y = 22;
  return (
    <Scene w={440} h={170}>
      <rect
        x={14}
        y={y - 6}
        width={412}
        height={44}
        rx={11}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Drawing tools */}
      <DockTool x={22} y={y} keyName="V">
        <path d="M-5 -7 v13 l3.5 -3.5 l2.5 5.5 l2.5 -1 l-2.5 -5.5 h5 Z" {...STROKE} />
      </DockTool>
      <DockTool x={56} y={y} keyName="1" on>
        <Marker cls="fill-slate-800" />
      </DockTool>
      <DockTool x={90} y={y} keyName="2">
        <Marker cls="fill-brand-500" />
      </DockTool>
      <DockTool x={124} y={y} keyName="3">
        <Marker cls="fill-rose-500" />
      </DockTool>
      <DockTool x={158} y={y} keyName="T">
        <path d="M-6 -6 h12 M0 -6 v13" {...STROKE} />
      </DockTool>
      <DockTool x={192} y={y} keyName="P">
        <path d="M0 7 l-5 -7 l5 -7 l5 7 Z M0 7 v-5" {...STROKE} />
      </DockTool>
      <DockTool x={226} y={y} keyName="E">
        <path d="M-6 3 l7 -8 l6 6 l-5 5 h-5 Z M-2 -1 l6 6" {...STROKE} />
      </DockTool>
      <line
        x1={264}
        y1={y + 4}
        x2={264}
        y2={y + 28}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      {/* Pinned shapes, then Shapes */}
      <DockTool x={270} y={y} keyName="A">
        <path d="M-6 6 L6 -6 M0 -6 h6 v6" {...STROKE} />
      </DockTool>
      <DockTool x={304} y={y} keyName="R">
        <rect x={-7} y={-5} width={14} height={10} rx={1.5} {...STROKE} />
      </DockTool>
      <DockTool x={338} y={y} keyName="S">
        <g>
          <circle cx={-3} cy={-3} r={3.5} {...STROKE} />
          <rect x={1} y={1} width={6} height={6} rx={1} {...STROKE} />
        </g>
      </DockTool>
      <line
        x1={376}
        y1={y + 4}
        x2={376}
        y2={y + 28}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      {/* Settings */}
      <DockTool x={384} y={y}>
        <g>
          <circle r={3} {...STROKE} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={0}
              y1={-4.5}
              x2={0}
              y2={-6.8}
              transform={`rotate(${a})`}
              {...STROKE}
            />
          ))}
        </g>
      </DockTool>
      {/* Group captions */}
      <Label x={140} y={78} anchor="middle" size={10} tone="muted">
        Drawing tools
      </Label>
      <Label x={321} y={78} anchor="middle" size={10} tone="muted">
        Shapes
      </Label>
      <Label x={400} y={78} anchor="middle" size={10} tone="muted">
        Settings
      </Label>
      {/* A sketch on the board */}
      <path
        d="M60 140 c20 -34 40 18 66 -8 s36 -24 52 4 c10 16 26 10 40 -6"
        fill="none"
        className="stroke-slate-700"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <rect
        x={270}
        y={104}
        width={90}
        height={50}
        rx={4}
        fill="none"
        className="stroke-slate-700"
        strokeWidth={2}
      />
      <path d="M218 128 L266 128" className="stroke-slate-700" strokeWidth={2} />
      <path d="M258 122 l8 6 l-8 6" fill="none" className="stroke-slate-700" strokeWidth={2} />
    </Scene>
  );
}
