// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Document template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx,
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Dialog, Label } from '@liveworkspace/help-site/art/primitives';
import { MenuCard, Strip } from './toolbar-layout';
import { ModeMark } from './mode-mark';

// The Font tiles and the Text, Colours and Canvas panels are drawn once for every product, in
// packages/help-site (art/illustrations/look-and-feel.tsx and look-and-feel-canvas.tsx).
export {
  ElementFontMenu,
  LookAndFeelFont,
  LookAndFeelTheme,
} from '@liveworkspace/help-site/art/illustrations/look-and-feel';
export { LookAndFeelCanvas } from '@liveworkspace/help-site/art/illustrations/look-and-feel-canvas';

// --- The canvas and its palette ----------------------------------------------------------------

/** The canvas with the menu button and tab name top-left, the palette strip across the top
 *  (the canvas-tool and category dropdowns, the tiles, More and Search) and the bottom-right
 *  cluster (Undo and Redo, Layers beside the Theme & canvas paintbrush, then the zoom controls). */
export function CanvasPaletteOverview() {
  const ink = { className: 'stroke-slate-500', strokeWidth: 1.4, fill: 'none' } as const;
  return (
    <Scene w={420} h={240}>
      <MenuCard x={8} y={14} />
      <Strip x={78} y={14} />
      <Shape x={60} y={72} w={76} h={42} label="Start" />
      <Shape x={176} y={66} w={60} h={54} kind="diamond" />
      <Shape x={168} y={146} w={76} h={36} accent label="Done" />
      <Arrow from={[136, 93]} to={[176, 93]} />
      <Arrow from={[206, 120]} to={[206, 146]} />
      {/* Bottom-right cluster: Undo and Redo, Layers and the paintbrush, then the zoom controls. */}
      <rect
        x={150}
        y={198}
        width={60}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={180} y1={204} x2={180} y2={222} className="stroke-slate-200" strokeWidth={1.2} />
      <path d="M170 209 h-8 l3 -3 M162 209 l3 3 M162 209 h5 a4.5 4.5 0 0 1 0 9 h-2" {...ink} />
      <path d="M190 209 h8 l-3 -3 M198 209 l-3 3 M198 209 h-5 a4.5 4.5 0 0 0 0 9 h2" {...ink} />
      <rect
        x={218}
        y={198}
        width={66}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={251} y1={204} x2={251} y2={222} className="stroke-slate-200" strokeWidth={1.2} />
      <path
        d="M228 211 L235 208 L242 211 L235 214 Z M228 215 L235 218 L242 215"
        {...ink}
        strokeLinejoin="round"
      />
      <path
        d="M260 220 c3 0 4 -2 4 -4 l7 -9 a2 2 0 0 1 3 2 l-8 8 c0 2 -2 3 -6 3 Z"
        className="fill-brand-400 stroke-slate-500"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect
        x={292}
        y={198}
        width={114}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={310} y={214} anchor="middle" size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={349} y={214} anchor="middle" size={11} weight={600} tone="body">
        100%
      </Label>
      <Label x={388} y={214} anchor="middle" size={14} weight={700} tone="muted">
        +
      </Label>
    </Scene>
  );
}

// --- Selecting many ----------------------------------------------------------------------------

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Export,
 *  Lock and Delete, over the union of the selected elements. */
export function MultiSelectionBar() {
  const bx = 104;
  const by = 46;
  const ink = 'fill-none stroke-slate-500';
  // The toolbar's buttons are icon-only: More, Filter Selection (the funnel), Duplicate,
  // Export, Lock and Delete, in that order.
  const icons: ReactNode[] = [
    <g key="more" className="fill-slate-500">
      <circle cx={-5} cy={0} r={1.6} />
      <circle cx={0} cy={0} r={1.6} />
      <circle cx={5} cy={0} r={1.6} />
    </g>,
    <path
      key="filter"
      d="M-6 -5 H6 L1.5 1 V6 L-1.5 4 V1 Z"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
    <g key="dup" className={ink} strokeWidth={1.5}>
      <rect x={-6} y={-6} width={8} height={8} rx={1.5} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} />
    </g>,
    <path
      key="export"
      d="M0 3 V-6 M-3.5 -2.5 L0 -6 L3.5 -2.5 M-6 2 V6 H6 V2"
      className={ink}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    <g key="lock" className={ink} strokeWidth={1.5}>
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} />
      <path d="M-3 -1 V-3.5 a3 3 0 0 1 6 0 V-1" />
    </g>,
    <path
      key="delete"
      d="M-6 -4 H6 M-2 -4 V-6 H2 V-4 M-4.5 -4 L-3.5 6 H3.5 L4.5 -4"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
  ];
  return (
    <Scene w={420} h={220}>
      <Shape x={72} y={120} w={70} h={42} />
      <Shape x={176} y={116} w={70} h={50} kind="circle" />
      <Shape x={282} y={120} w={70} h={42} kind="diamond" />
      <Arrow from={[142, 141]} to={[176, 141]} />
      {[
        [72, 120, 70, 42],
        [176, 116, 70, 50],
        [282, 120, 70, 42],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x! - 3}
          y={y! - 3}
          width={w! + 6}
          height={h! + 6}
          rx={8}
          className="fill-none stroke-brand-500"
          strokeWidth={1.8}
        />
      ))}
      <Panel x={bx} y={by} w={216} h={36}>
        {icons.map((icon, i) => (
          <g key={i} transform={`translate(${bx + 20 + i * 35} ${by + 18})`}>
            {icon}
          </g>
        ))}
        <line
          x1={bx + 72}
          y1={by + 8}
          x2={bx + 72}
          y2={by + 28}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
      </Panel>
    </Scene>
  );
}

// --- Templates ---------------------------------------------------------------------------------

/** A start's search finding a template in another mode (docs/specs/007-editor/start-diagramming.md "Found in other
 *  modes"): Start Drawing searched for "sailboat", its own one-line no-match, then In Other Modes with the
 *  Workshop block and its Sailboat retrospective card, which says it opens in Workshop. */
export function StartSearchOtherModes() {
  const card = { x: 36, y: 192, w: 168, h: 90 };
  return (
    <Scene w={420} h={308} bg="plain">
      <Dialog
        x={20}
        y={10}
        w={380}
        h={290}
        title="Start Drawing"
        sceneW={420}
        sceneH={308}
        scrim={false}
      >
        {/* The search box, holding the word typed. */}
        <rect
          x={36}
          y={48}
          width={200}
          height={22}
          rx={7}
          className="fill-white stroke-brand-400"
          strokeWidth={1.5}
        />
        <circle
          cx={49}
          cy={58.5}
          r={4}
          fill="none"
          className="stroke-slate-400"
          strokeWidth={1.4}
        />
        <path
          d="M52 61.5 l3 3"
          className="stroke-slate-400"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Label x={61} y={60} size={10} tone="strong">
          sailboat
        </Label>
        {/* Nothing of Draw's: one line, not an empty state. */}
        <rect x={36} y={80} width={348} height={34} rx={7} className="fill-slate-50" />
        <Label x={46} y={95} size={9} weight={700} tone="strong">
          No drawing templates match “sailboat”.
        </Label>
        <Label x={46} y={107} size={9} tone="muted">
          Found in other modes.
        </Label>
        <Label x={36} y={136} size={12} weight={700} tone="strong">
          In Other Modes
        </Label>
        <Label x={36} y={150} size={9} tone="muted">
          Choosing one switches this tab to its mode.
        </Label>
        {/* The Workshop block: its mark on a soft tile, its name and how many it found. */}
        <rect x={36} y={162} width={18} height={18} rx={4.5} className="fill-brand-50" />
        <g transform="translate(45 171)">
          <ModeMark mode="Workshop" className="stroke-brand-600" scale={0.5} />
        </g>
        <Label x={61} y={174} size={10.5} weight={700} tone="strong">
          Workshop
        </Label>
        <rect x={112} y={165} width={14} height={12} rx={6} className="fill-slate-100" />
        <Label x={119} y={174} anchor="middle" size={8} weight={600} tone="muted">
          1
        </Label>
        {/* The card: its picture, its title, and where it leads. */}
        <rect
          x={card.x}
          y={card.y}
          width={card.w}
          height={card.h}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <rect
          x={card.x + 6}
          y={card.y + 6}
          width={card.w - 12}
          height={40}
          rx={6}
          className="fill-slate-50"
        />
        <path
          d={`M${card.x + 70} ${card.y + 33} h32 l-5 6 h-22 Z`}
          className="fill-brand-200 stroke-brand-400"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <path
          d={`M${card.x + 86} ${card.y + 12} v21 M${card.x + 86} ${card.y + 13} l13 18 h-13`}
          className="fill-white stroke-brand-400"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <path
          d={`M${card.x + 52} ${card.y + 41} q8 -4 16 0 t16 0 t16 0 t16 0`}
          fill="none"
          className="stroke-sky-300"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Label x={card.x + 9} y={card.y + 62} size={10} weight={700} tone="strong">
          Sailboat retrospective
        </Label>
        <rect
          x={card.x + 9}
          y={card.y + 70}
          width={92}
          height={13}
          rx={6.5}
          className="fill-brand-50"
        />
        <g transform={`translate(${card.x + 18} ${card.y + 76.5})`}>
          <ModeMark mode="Workshop" className="stroke-brand-600" scale={0.36} />
        </g>
        <Label x={card.x + 25} y={card.y + 79.5} size={8} weight={600} tone="accent">
          Opens in Workshop
        </Label>
      </Dialog>
    </Scene>
  );
}
