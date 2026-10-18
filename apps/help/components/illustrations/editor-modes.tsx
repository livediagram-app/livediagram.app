// Editor-mode illustrations for the Canvas article on Editor Modes (docs/specs/018-help/help-app.md,
// docs/specs/007-editor/editor-modes.md): the tab menu's mode rows, the five modes at its foot
// (chrome/TabModeMenuRows.tsx), the tab pill leading with the mode icon (TabModeIcon.tsx), and the
// confirmation card that hangs from the mode switch when an editor leaves Pages on a tab with
// pages (dialogs/LeavePagesConfirm.tsx). The mode switch itself is `ModeSwitchScene` in
// editor-mode-switch.tsx. Real labels throughout: the modes' names and one-line descriptions from the
// mode catalogue (packages/document/src/editor-mode.ts), and the card's title, sentence and buttons.

import { Scene, Label, Button } from './primitives';
import { MenuCard } from './toolbar-layout';
import { ModeMark, type Mode } from './mode-mark';

// The five modes as the tab menu's mode rows list them: name, then the catalogue's description, wrapped.
const OPENS_IN: { mode: Mode; lines: string[] }[] = [
  { mode: 'Diagram', lines: ['Flowcharts, architecture and org charts', 'with snapping shapes.'] },
  { mode: 'Draw', lines: ['Sketch freehand with pens, tidied into', 'shapes as you go.'] },
  { mode: 'Facilitate', lines: ['Run a live session: timers, votes, polls', 'and reveals.'] },
  { mode: 'Pages', lines: ['Lay out slides, infographics, articles', 'and logos on pages.'] },
  { mode: 'Plan', lines: ['Boards of cards moving through columns,', 'with types and fields.'] },
];

/** The foot of the tab menu: the content rows (Import, Export, Clear), a hairline, then the five
 *  mode rows, each with its mark, name and what it is for, a dot on the tab's current one (Draw),
 *  above the tab bar whose pill leads with the same mark. */
export function TabModeMenuScene() {
  const mx = 150;
  const my = 10;
  const mw = 252;
  const rowH = 18;
  const current: Mode = 'Draw';
  let y = my + 6;
  const content = ['Import', 'Export', 'Clear'].map((label, i) => ({ label, y: y + i * rowH }));
  y += content.length * rowH;
  const sepY = y + 4;
  y += 10;
  const rows: { mode: Mode; lines: string[]; y: number; h: number }[] = [];
  for (const r of OPENS_IN) {
    const h = 18 + r.lines.length * 12;
    rows.push({ ...r, y, h });
    y += h;
  }
  const menuH = y + 6 - my;
  const barY = my + menuH + 10;
  return (
    <Scene w={420} h={barY + 36}>
      {/* The menu */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={menuH}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Import, Export, Clear: full-width rows */}
      {content.map(({ label, y: ry }) => (
        <g key={label}>
          <rect
            x={mx + 16}
            y={ry + 5}
            width={8}
            height={8}
            rx={2}
            className="fill-none stroke-slate-300"
            strokeWidth={1.2}
          />
          <Label x={mx + 34} y={ry + 9.5} size={11} tone="body">
            {label}
          </Label>
        </g>
      ))}
      <line
        x1={mx}
        y1={sepY}
        x2={mx + mw}
        y2={sepY}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {rows.map((r) => {
        const on = r.mode === current;
        return (
          <g key={r.mode}>
            {on && (
              <rect
                x={mx + 4}
                y={r.y}
                width={mw - 8}
                height={r.h - 2}
                rx={6}
                className="fill-slate-50"
              />
            )}
            <g transform={`translate(${mx + 20} ${r.y + 10})`}>
              <ModeMark mode={r.mode} className="stroke-slate-600" />
            </g>
            <Label x={mx + 34} y={r.y + 10} size={11} weight={600} tone="strong">
              {r.mode}
            </Label>
            {r.lines.map((line, i) => (
              <Label key={line} x={mx + 34} y={r.y + 23 + i * 12} size={10} tone="muted">
                {line}
              </Label>
            ))}
            {on && <circle cx={mx + mw - 16} cy={r.y + 11} r={3.5} className="fill-brand-600" />}
          </g>
        );
      })}
      {/* The tab bar: each pill leads with the mode you work in on that tab */}
      <rect x={0} y={barY} width={420} height={36} className="fill-slate-50" />
      <line x1={0} y1={barY} x2={420} y2={barY} className="stroke-slate-200" strokeWidth={1.5} />
      <rect x={14} y={barY + 6} width={92} height={24} rx={7} className="fill-slate-100" />
      <g transform={`translate(${28} ${barY + 18})`}>
        <ModeMark mode="Diagram" className="stroke-slate-500" scale={0.5} />
      </g>
      <Label x={40} y={barY + 18} size={11} weight={500} tone="body">
        Overview
      </Label>
      <rect
        x={286}
        y={barY + 6}
        width={116}
        height={24}
        rx={7}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <g transform={`translate(${300} ${barY + 18})`}>
        <ModeMark mode="Draw" className="stroke-brand-600" scale={0.5} />
      </g>
      <Label x={312} y={barY + 18} size={11} weight={600} tone="accent">
        Sketch
      </Label>
      <Label x={392} y={barY + 17} anchor="end" size={12} weight={700} tone="accent">
        ⋯
      </Label>
      <Label x={14} y={30} size={10} tone="muted">
        The tab menu
      </Label>
    </Scene>
  );
}

/** Leaving Pages on a tab with pages: the card hanging from the mode switch beside the menu
 *  button, asking "Switch to Diagram?", with Cancel and Switch (the Diagram mark on it). */
export function LeavePagesScene() {
  const cx = 24;
  const cy = 50;
  const cw = 292;
  const ch = 120;
  // The centre of the mode switch in the top-left card (MenuCard at 12, 8).
  const pointerX = 55;
  return (
    <Scene w={460} h={200}>
      <MenuCard x={12} y={8} mode="Pages" />
      {/* A page on the canvas */}
      <rect x={350} y={40} width={80} height={112} rx={2} className="fill-white stroke-slate-200" />
      <rect x={362} y={70} width={10} height={20} className="fill-brand-200" />
      <rect x={376} y={58} width={10} height={32} className="fill-brand-400" />
      <rect x={390} y={76} width={10} height={14} className="fill-brand-200" />
      <rect x={362} y={102} width={52} height={5} rx={2.5} className="fill-slate-300" />
      <rect x={362} y={114} width={38} height={5} rx={2.5} className="fill-slate-300" />
      <Label x={390} y={170} size={10} tone="muted" anchor="middle">
        A4 · Portrait
      </Label>
      {/* The card, pointing up at the switch */}
      <rect
        x={cx}
        y={cy}
        width={cw}
        height={ch}
        rx={11}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${pointerX - 7} ${cy + 0.8} L${pointerX} ${cy - 6} L${pointerX + 7} ${cy + 0.8}`}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect x={pointerX - 6} y={cy} width={12} height={2} className="fill-white" />
      <circle cx={cx + 26} cy={cy + 26} r={13} className="fill-amber-100" />
      <path
        d={`M${cx + 26} ${cy + 19} l7 12.5 h-14 Z M${cx + 26} ${cy + 24} v3.5 M${cx + 26} ${cy + 29.6} v0.2`}
        fill="none"
        className="stroke-amber-500"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={cx + 48} y={cy + 20} size={12} weight={700} tone="strong">
        Switch to Diagram?
      </Label>
      {[
        "Diagram mode doesn't show pages. Changes",
        'you make there may not fit back onto your',
        'pages when you return to Pages.',
      ].map((line, i) => (
        <Label key={line} x={cx + 48} y={cy + 40 + i * 13} size={10} tone="body">
          {line}
        </Label>
      ))}
      <Button x={cx + cw - 162} y={cy + ch - 36} w={70} label="Cancel" />
      <Button
        x={cx + cw - 84}
        y={cy + ch - 36}
        w={72}
        label="Switch"
        variant="primary"
        icon={
          <g className="help-art-as-drawn">
            <g transform="translate(4 0)">
              <ModeMark mode="Diagram" className="stroke-white" scale={0.45} />
            </g>
          </g>
        }
      />
    </Scene>
  );
}
