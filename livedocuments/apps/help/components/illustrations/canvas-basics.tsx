// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Document template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { MenuCard, Strip } from './toolbar-layout';

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
 *  (the selection mode, the category bar and Search) and the bottom-right
 *  cluster (Undo and Redo, the Style brush, then the zoom controls). */
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
      {/* Bottom-right cluster: Undo and Redo, the Style brush, then the zoom controls. */}
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
        width={33}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* The Style brush: a painter's palette with its paint wells. */}
      <path
        d="M235 206 a7 7 0 1 0 0 14 c1.5 0 2 -1 1.5 -2 s0 -2.5 1.5 -2.5 h2 a2.5 2.5 0 0 0 2.5 -2.5 a7 7 0 0 0 -7.5 -7 Z"
        {...ink}
        strokeLinejoin="round"
      />
      <circle cx={231.5} cy={211} r={1} className="fill-slate-500" />
      <circle cx={235.5} cy={209.5} r={1} className="fill-slate-500" />
      <circle cx={239} cy={211.5} r={1} className="fill-slate-500" />
      <rect
        x={259}
        y={198}
        width={114}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={277} y={214} anchor="middle" size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={316} y={214} anchor="middle" size={11} weight={600} tone="body">
        100%
      </Label>
      <Label x={355} y={214} anchor="middle" size={14} weight={700} tone="muted">
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
