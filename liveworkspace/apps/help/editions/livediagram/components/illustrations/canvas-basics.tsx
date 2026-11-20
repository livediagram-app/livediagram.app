// Canvas basics illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Document template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, the shared Tab Style dialog (TabStyleDialog.tsx, TextPanel.tsx), BackBar.tsx, ThemeBrowser.tsx,
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Dialog, Label } from '@liveworkspace/help-site/art/primitives';
import { EditorFrame } from './editor-chrome';
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

/** The whole editor around a small flow: the logo and the menu with the mode switch top-left, the palette strip across
 *  the top (the selection mode, the categories, Library and Search), Share and Sign In top-right, the corner cluster
 *  bottom-right (Undo and Redo; Cleanup, Layers and Theme & Canvas; zoom) and the bottom bar with the tabs. */
export function CanvasPaletteOverview() {
  return (
    <Scene w={540} h={280}>
      <Shape x={128} y={92} w={84} h={46} label="Start" />
      <Shape x={258} y={84} w={66} h={62} kind="diamond" />
      <Shape x={249} y={176} w={84} h={42} accent label="Done" />
      <Arrow from={[212, 115]} to={[258, 115]} />
      <Arrow from={[291, 146]} to={[291, 176]} />
      <EditorFrame w={540} h={280} />
    </Scene>
  );
}

// --- Selecting many ----------------------------------------------------------------------------

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Save to Library,
 *  Export, Lock and Delete, over the union of the selected elements. */
export function MultiSelectionBar() {
  const bx = 86;
  const by = 46;
  const ink = 'fill-none stroke-slate-500';
  // The toolbar's buttons are icon-only: More, Filter Selection (the funnel), Duplicate,
  // Save to Library, Export, Lock and Delete, in that order.
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
    // Save to Library: a bookmark with a plus on it.
    <g key="library" className={ink} strokeWidth={1.5} strokeLinejoin="round">
      <path d="M-5 -6 H5 V6 L0 3 L-5 6 Z" />
      <path d="M0 -3.5 V0.5 M-2 -1.5 H2" strokeLinecap="round" />
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
      <Panel x={bx} y={by} w={251} h={36}>
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
          strokeWidth={0.75}
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
