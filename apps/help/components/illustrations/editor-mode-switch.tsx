// Editor-mode illustrations for the Canvas articles on Draw mode and Illustrate Mode
// (docs/specs/018-help/help-app.md): the mode switch in the Palette panel's title row with its
// menu open (chrome/editor-mode/ModeMenuChip.tsx), and Draw mode's dock across the top of the
// canvas in the Toolbar layout (canvas/whiteboard/WhiteboardDock.tsx). Real labels throughout:
// the four modes, the ⇧D hint on the row the key leads to, the dock's tools and their keys.

import type { ReactNode } from 'react';
import { Scene, Label, Panel } from './primitives';

// --- Mode glyphs -------------------------------------------------------------------------------

/** A small glyph per editor mode, centred on (0, 0). */
function ModeGlyph({ mode, tone = 'slate' }: { mode: string; tone?: 'slate' | 'brand' }) {
  const cls = tone === 'brand' ? 'stroke-brand-600' : 'stroke-slate-500';
  const common = {
    fill: 'none',
    className: cls,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (mode) {
    case 'Diagram':
      return (
        <g>
          <rect x={-6} y={-6} width={5} height={5} rx={1} {...common} />
          <rect x={1} y={1} width={5} height={5} rx={1} {...common} />
          <path d="M-1 -3.5 h4.5 v4.5" {...common} />
        </g>
      );
    case 'Draw':
      return <path d="M-6 4 c3 -8 5 4 8 -3 s3 -4 4 -2" {...common} />;
    case 'Illustrate':
      return (
        <g>
          <rect x={-5} y={-6} width={10} height={12} rx={1} {...common} />
          <path d="M-2.5 -2.5 h5 M-2.5 0.5 h5 M-2.5 3 h3" {...common} />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-6} y={-6} width={3.5} height={12} rx={1} {...common} />
          <rect x={-1.75} y={-6} width={3.5} height={8} rx={1} {...common} />
          <rect x={2.5} y={-6} width={3.5} height={10} rx={1} {...common} />
        </g>
      );
  }
}

const MODES = ['Diagram', 'Draw', 'Illustrate', 'Plan'];

/** The mode switch in the Palette panel's title row, its menu open: the four modes, the current
 *  one checked, and ⇧D on the row the key leads to. */
export function ModeSwitchScene() {
  const mx = 232;
  const my = 52;
  const rowH = 26;
  return (
    <Scene w={420} h={200}>
      <Panel x={150} y={14} w={252} h={176} title="PALETTE" />
      {/* The chip, labelled in the Floating layout */}
      <rect
        x={292}
        y={17}
        width={84}
        height={17}
        rx={5}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1}
      />
      <g transform="translate(302 25.5) scale(0.8)">
        <ModeGlyph mode="Diagram" tone="brand" />
      </g>
      <Label x={312} y={26} size={10} weight={600} tone="accent">
        Diagram
      </Label>
      <path
        d="M362 24 l3 3 l3 -3"
        fill="none"
        className="stroke-brand-600"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* The menu, hanging below the chip */}
      <rect
        x={mx}
        y={my - 12}
        width={144}
        height={MODES.length * rowH + 8}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {MODES.map((m, i) => {
        const ry = my - 8 + i * rowH;
        const on = i === 0;
        return (
          <g key={m}>
            {on && (
              <rect
                x={mx + 4}
                y={ry}
                width={136}
                height={rowH - 2}
                rx={6}
                className="fill-brand-100"
              />
            )}
            <g transform={`translate(${mx + 18} ${ry + rowH / 2 - 1})`}>
              <ModeGlyph mode={m} tone={on ? 'brand' : 'slate'} />
            </g>
            <Label
              x={mx + 32}
              y={ry + rowH / 2}
              size={11}
              weight={600}
              tone={on ? 'accent' : 'body'}
            >
              {m}
            </Label>
            {on && (
              <path
                d={`M${mx + 118} ${ry + 12} l3.5 3.5 l6 -7`}
                fill="none"
                className="stroke-brand-600"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {i === 1 && (
              <g>
                <rect
                  x={mx + 110}
                  y={ry + 5}
                  width={24}
                  height={15}
                  rx={3}
                  className="fill-slate-50 stroke-slate-300"
                  strokeWidth={1}
                />
                <Label x={mx + 122} y={ry + 13} anchor="middle" size={10} weight={600} tone="body">
                  ⇧D
                </Label>
              </g>
            )}
          </g>
        );
      })}
      {/* The canvas beside it */}
      <rect
        x={24}
        y={70}
        width={70}
        height={40}
        rx={7}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path d="M94 90 h34" className="stroke-brand-400" strokeWidth={2.2} />
      <path
        d="M30 150 c14 -20 26 12 40 -6 s20 -14 30 0"
        fill="none"
        className="stroke-slate-600"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
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

/** Draw mode's dock in the Toolbar layout: the drawing tools, the pinned shapes and Shapes, and
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
