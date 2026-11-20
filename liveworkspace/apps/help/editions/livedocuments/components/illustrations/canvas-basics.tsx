// Canvas basics illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Document template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, the shared Tab Style dialog (TabStyleDialog.tsx, TextPanel.tsx), BackBar.tsx, ThemeBrowser.tsx
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import {
  lucideCopy,
  lucideEllipsis,
  lucideFunnel,
  lucideLock,
  lucideTrash2,
  lucideDownload,
} from '@liveworkspace/icons/lucide';
import { Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar, Card, CLUSTER_W, CornerCluster, Icon, TopRow } from './editor-chrome';
import { Page, SlideContent } from './doc-page';

// The Font tiles and the Text, Colours and Canvas panels are drawn once for every product, in
// packages/help-site (art/illustrations/look-and-feel.tsx and look-and-feel-canvas.tsx).
export {
  ElementFontMenu,
  LookAndFeelFont,
  LookAndFeelTheme,
} from '@liveworkspace/help-site/art/illustrations/look-and-feel';
export { LookAndFeelCanvas } from '@liveworkspace/help-site/art/illustrations/look-and-feel-canvas';

// --- The canvas and its palette ----------------------------------------------------------------

/** The editor's whole screen, `w` by `h` from the origin, without the scene around it: the top row, two slides, the
 *  corner cluster and the bottom bar. A device frame draws it scaled into its screen. */
export function EditorView({ w = 470, h = 272 }: { w?: number; h?: number }) {
  const py = Math.round((h - BAR_H - 99) / 2) + 6;
  return (
    <g>
      <TopRow w={w} />
      <Page x={w / 2 - 191} y={py} w={176} h={99} name="Cover">
        <SlideContent
          x={w / 2 - 191}
          y={py}
          w={176}
          h={99}
          title="Quarterly Review"
          layout="title"
        />
      </Page>
      <Page x={w / 2 + 11} y={py} w={176} h={99} name="Results">
        <SlideContent x={w / 2 + 11} y={py} w={176} h={99} title="Q3 Results" />
      </Page>
      <CornerCluster x={w - 8 - CLUSTER_W} y={h - BAR_H - 32} level="64%" />
      <BottomBar y={h - BAR_H} w={w} />
    </g>
  );
}

/** The whole editor on a computer: the logo and menu cards top-left, the palette strip across the top, Share and
 *  Sign In top-right, two slides on the canvas with their label and title bar cards, Undo | Redo and zoom
 *  bottom-right, and the bottom bar with the tab, Tools and Settings. */
export function CanvasPaletteOverview() {
  return (
    <Scene w={470} h={272}>
      <EditorView w={470} h={272} />
    </Scene>
  );
}

// --- Selecting many ----------------------------------------------------------------------------

const MULTI_ICONS = [
  lucideEllipsis,
  lucideFunnel,
  lucideCopy,
  lucideDownload,
  lucideLock,
  lucideTrash2,
];

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Export, Lock and Delete, over
 *  the selected heading, chart and picture on a slide. */
export function MultiSelectionBar() {
  const px = 92;
  const py = 70;
  const pw = 236;
  const ph = 133;
  const bw = MULTI_ICONS.length * 22 + 8;
  const bx = px + pw / 2 - bw / 2;
  return (
    <Scene w={420} h={222}>
      <Page x={px} y={py} w={pw} h={ph} name="Results" bare>
        <SlideContent x={px} y={py} w={pw} h={ph} title="Q3 Results" layout="picture" />
      </Page>
      {[
        [px + 17, py + 18, 104, 17],
        [px + 17, py + 37, 96, 26],
        [px + 127, py + 19, 90, 95],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={1.5}
          className="fill-none stroke-brand-500"
          strokeWidth={1.25}
        />
      ))}
      <SelectionBox x={px + 13} y={py + 14} w={208} h={104} />
      <Card x={bx} y={24} w={bw} h={26}>
        {MULTI_ICONS.map((prims, i) => (
          <Icon key={i} prims={prims} x={bx + 15 + i * 22} y={37} size={9} />
        ))}
        <line
          x1={bx + 26}
          y1={30}
          x2={bx + 26}
          y2={44}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />
      </Card>
    </Scene>
  );
}
