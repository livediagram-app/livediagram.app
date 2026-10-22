// Editor-mode illustrations for the Canvas article on editor modes (docs/specs/018-help/help-app.md):
// the mode switch at the top of an empty tab's start with its menu open, the list of modes and the
// preview of one (chrome/editor-mode/ModeMenu.tsx). Real labels throughout: the five modes, a mode's
// description and tools, ⇧D in the preview.

import { Scene, Label } from './primitives';
import { ModeMark, type Mode } from './mode-mark';

// The modes in the switch's order (the catalogue's), each with its tint in the menu.
const MODES: { mode: Mode; tile: string; mark: string }[] = [
  { mode: 'Diagram', tile: 'fill-sky-100', mark: 'stroke-sky-700' },
  { mode: 'Draw', tile: 'fill-orange-100', mark: 'stroke-orange-700' },
  { mode: 'Workshop', tile: 'fill-violet-100', mark: 'stroke-violet-700' },
  { mode: 'Pages', tile: 'fill-pink-100', mark: 'stroke-pink-700' },
  { mode: 'Plan', tile: 'fill-emerald-100', mark: 'stroke-emerald-700' },
];

/** The mode switch leading Start Diagramming's rail (start/StartModeSwitch.tsx), its menu open: the
 *  list of the five modes (the current one checked; the tab is empty, so Plan is a plain switch) and
 *  the preview of the one under the pointer, Draw: its picture, name with ⇧D, description and tools. */
export function ModeSwitchScene() {
  const mx = 13;
  const my = 54;
  const listW = 118;
  const pw = 210;
  const rowH = 28;
  const menuH = MODES.length * rowH + 12;
  const shown = 1;
  const px = mx + listW;
  return (
    <Scene w={420} h={my + menuH + 14}>
      {/* The start's top edge: the rail's named switch, then the panel's title */}
      <rect
        x={12}
        y={8}
        width={396}
        height={40}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={13} y={9} width={listW + 12} height={38} rx={9} className="fill-slate-50" />
      <g transform="translate(29 28)">
        <ModeMark mode="Diagram" className="stroke-brand-600" scale={0.5} />
      </g>
      <Label x={42} y={28} size={11} weight={500} tone="strong">
        Diagram
      </Label>
      <path
        d={`M${listW - 2} 26 l3.5 3.5 l3.5 -3.5`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={listW + 40} y={23} size={11.5} weight={600} tone="strong">
        Start Diagramming
      </Label>
      <Label x={listW + 40} y={37} size={9} tone="muted">
        Pick a template, or close this to start blank.
      </Label>
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
        A whiteboard look for sketching.
      </Label>
    </Scene>
  );
}
