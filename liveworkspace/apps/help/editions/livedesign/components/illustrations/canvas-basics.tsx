// Canvas basics illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Design template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, the shared Tab Style dialog (TabStyleDialog.tsx, TextPanel.tsx), BackBar.tsx, ThemeBrowser.tsx
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel } from '@liveworkspace/help-site/art/primitives';
import { EditorFrame } from './editor-chrome';
import { APP_PAGES, AppScreens } from './user-interface';

// The Font tiles and the Text, Colours and Canvas panels are drawn once for every product, in
// packages/help-site (art/illustrations/look-and-feel.tsx and look-and-feel-canvas.tsx).
export {
  ElementFontMenu,
  LookAndFeelFont,
  LookAndFeelTheme,
} from '@liveworkspace/help-site/art/illustrations/look-and-feel';
export { LookAndFeelCanvas } from '@liveworkspace/help-site/art/illustrations/look-and-feel-canvas';

// --- The canvas and its palette ----------------------------------------------------------------

/** The canvas with the Pages rail, the palette strip across the top (the select mode, the categories, the Library
 *  and Search) and the corner controls (Undo and Redo, the Theme palette, then the zoom card). */
export function CanvasPaletteOverview() {
  return (
    <Scene w={640} h={400}>
      <EditorFrame w={640} h={400} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
        <AppScreens x={168} y={84} />
      </EditorFrame>
    </Scene>
  );
}

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Save to Library,
 *  Export, Lock and Delete, over the union of the selected elements. */
export function MultiSelectionBar() {
  const bx = 86;
  const by = 46;
  const ink = 'fill-none stroke-slate-500';
  // The toolbar's buttons are icon-only: More, Filter Selection (the funnel), Duplicate,
  // Save to Library (books on a shelf), Export, Lock and Delete, in that order.
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
    <g key="library" className={ink} strokeWidth={1.5} strokeLinecap="round">
      <path d="M-5 -6 V6 M-1 -6 V6" />
      <path d="M2.5 -5.5 L6 5.5" />
      <path d="M-6.5 6 H6.5" />
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
          strokeWidth={0.75}
        />
      </Panel>
    </Scene>
  );
}
