// Editor-mode illustrations for the Canvas article on Editor Modes (docs/specs/018-help/help-app.md,
// docs/specs/007-editor/editor-modes.md): the tab menu's Mode section open on the four modes
// (chrome/TabModeMenuSection.tsx), the tab pill leading with the mode icon (TabModeIcon.tsx), and the
// confirmation card that hangs from the mode switch when an editor leaves Illustrate on a tab with
// pages (dialogs/LeaveIllustrateConfirm.tsx). The mode switch itself is `ModeSwitchScene` in
// editor-mode-switch.tsx. Real labels throughout: the modes' names and one-line descriptions from the
// mode catalogue (packages/document/src/editor-mode.ts), and the card's title, sentence and buttons.

import { Scene, Label, Button } from './primitives';
import { MenuCard } from './toolbar-layout';

type Mode = 'Diagram' | 'Draw' | 'Illustrate' | 'Plan';

/** Each mode's mark (packages/ui EDITOR_MODE_ICONS) on its 24-unit grid, centred on (0, 0) and
 *  drawn at `scale`: a flowchart, a marker, a page with a chart over two lines, a board. */
function ModeMark({
  mode,
  className = 'stroke-slate-500',
  scale = 0.6,
}: {
  mode: Mode;
  className?: string;
  scale?: number;
}) {
  const common = {
    fill: 'none',
    className,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const body = (() => {
    switch (mode) {
      case 'Diagram':
        return (
          <>
            <rect x={3} y={3} width={8} height={8} rx={2} {...common} />
            <path d="M7 11v4a2 2 0 0 0 2 2h4" {...common} />
            <rect x={13} y={13} width={8} height={8} rx={2} {...common} />
          </>
        );
      case 'Draw':
        return (
          <>
            <path d="M7 13 L15.5 4.5 L18 7 L9.5 15.5 L6.4 16 Z" {...common} />
            <path d="M4 19.5 H20" {...common} />
          </>
        );
      case 'Illustrate':
        return (
          <>
            <rect x={4.5} y={2.5} width={15} height={19} rx={2} {...common} />
            <path d="M8.5 11V8.5M12 11V6M15.5 11V9" {...common} />
            <path d="M8.5 15H15.5M8.5 18H13" {...common} />
          </>
        );
      default:
        return (
          <>
            <rect x={2.5} y={4} width={19} height={16} rx={2} {...common} />
            <path d="M8.83 4V20M15.17 4V20" {...common} />
            <rect x={10.2} y={6} width={3.6} height={5} rx={0.8} {...common} />
          </>
        );
    }
  })();
  return <g transform={`scale(${scale}) translate(-12 -12)`}>{body}</g>;
}

// The four modes as the tab menu's Mode lists them: name, then the catalogue's description, wrapped.
const OPENS_IN: { mode: Mode; lines: string[] }[] = [
  { mode: 'Diagram', lines: ['Shapes, arrows, the palette and snapping.'] },
  { mode: 'Draw', lines: ['Pens, the eraser and shape recognition.'] },
  { mode: 'Illustrate', lines: ['Pages: infographics to lay out, and', 'articles to write.'] },
  { mode: 'Plan', lines: ['Boards of items: columns, cards and', 'the work moving through them.'] },
];

/** The tab menu with its Mode section open (Content and Cleanup closed around it): the four modes, each with its mark, name and what
 *  it is for, a dot on the one the tab opens in (Draw), above the tab bar whose pill leads with the
 *  same mark. */
export function TabModeMenuScene() {
  const mx = 150;
  const my = 10;
  const mw = 252;
  const sectionH = 22;
  const current: Mode = 'Draw';
  let y = my + 8;
  const rows: { mode: Mode; lines: string[]; y: number; h: number }[] = [];
  const sections = ['Content'];
  const sectionsY = sections.map((s, i) => ({ s, y: y + i * sectionH }));
  y += sections.length * sectionH;
  const headerY = y;
  y += sectionH + 2;
  for (const r of OPENS_IN) {
    const h = 18 + r.lines.length * 12;
    rows.push({ ...r, y, h });
    y += h;
  }
  const cleanupY = y + 4;
  const menuH = cleanupY + sectionH - my;
  const barY = cleanupY + sectionH + 10;
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
      {sectionsY.map(({ s, y: sy }) => (
        <g key={s}>
          <Label x={mx + 14} y={sy + sectionH / 2} size={11} weight={500} tone="body">
            {s}
          </Label>
          <path
            d={`M${mx + mw - 20} ${sy + sectionH / 2 - 2} l4 4 l4 -4`}
            className="fill-none stroke-slate-400"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* Mode, open: its header carries the current mode's mark */}
      <g transform={`translate(${mx + 20} ${headerY + sectionH / 2})`}>
        <ModeMark mode={current} className="stroke-slate-600" scale={0.55} />
      </g>
      <Label x={mx + 32} y={headerY + sectionH / 2} size={11} weight={600} tone="strong">
        Mode
      </Label>
      <path
        d={`M${mx + mw - 20} ${headerY + sectionH / 2 + 2} l4 -4 l4 4`}
        className="fill-none stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
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
      <line
        x1={mx}
        y1={cleanupY - 2}
        x2={mx + mw}
        y2={cleanupY - 2}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={mx + 14} y={cleanupY + sectionH / 2} size={11} weight={500} tone="body">
        Cleanup
      </Label>
      <path
        d={`M${mx + mw - 20} ${cleanupY + sectionH / 2 - 2} l4 4 l4 -4`}
        className="fill-none stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
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

/** Leaving Illustrate on a tab with pages: the card hanging from the mode switch beside the menu
 *  button, asking "Switch to Diagram?", with Cancel and Switch (the Diagram mark on it). */
export function LeaveIllustrateScene() {
  const cx = 24;
  const cy = 50;
  const cw = 292;
  const ch = 120;
  // The centre of the mode switch in the top-left card (MenuCard at 12, 8).
  const pointerX = 55;
  return (
    <Scene w={460} h={200}>
      <MenuCard x={12} y={8} />
      {/* An Illustrate page on the canvas */}
      <rect x={350} y={40} width={80} height={112} rx={2} className="fill-white stroke-slate-200" />
      <rect x={362} y={70} width={10} height={20} className="fill-brand-200" />
      <rect x={376} y={58} width={10} height={32} className="fill-brand-400" />
      <rect x={390} y={76} width={10} height={14} className="fill-brand-200" />
      <rect x={362} y={102} width={52} height={5} rx={2.5} className="fill-slate-300" />
      <rect x={362} y={114} width={38} height={5} rx={2.5} className="fill-slate-300" />
      <Label x={390} y={170} size={10} tone="muted" anchor="middle">
        A4 · Portrait · Infographic
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
        'pages when you return to Illustrate.',
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
