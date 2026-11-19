'use client';

// liveplanner's Tab Style profile (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's
// profile"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the parts only this editor knows (its
// looks, themes, finishes, patterns, typefaces, Text Size control and help) and what each surface shows. A diagram tab
// shows everything; a Board, Sheet, Form or Dashboard tab only what changes how it draws (static patterns, calm looks,
// the size of new text where it reaches), a board as its preview, and links to the settings that style it. The
// dialog wears ClusterPanel, the frame it shares with a board's Configure, and
// has no Show Me; its typefaces are the faces liveplanner offers (docs/specs/004-interface-design/fonts.md).
// Imported only by CanvasThemeDialog, so it loads with the dialog.

import { PLANNER_FONTS, isAnimatedPattern, type BackgroundPattern } from '@liveplanner/project';
import { canvasThemeHeroArt } from '@liveworkspace/ui/dialog-hero-art/canvas-theme';
import {
  TAB_STYLE_PANELS,
  tabStyleCopy,
  type TabStyleProfile,
  type TabStyleSurface,
  type TabStyleSurfaceChanges,
} from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { seasonalLooksFor } from '@liveworkspace/workbench/lib/seasonal-looks';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { ClusterPanel } from '@/components/canvas/ClusterPanel';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { patternLabel } from '@/components/palette/palette-patterns';
import { TextSizeControl } from '@/components/palette/TextSizeControl';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { rollMashup } from '@/lib/look-mashup';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import { TAB_LOOKS, activeLookId, lookMatches, type TabLook } from '@/lib/tab-looks';
import {
  BOARD_CONFIGURE_LINK,
  DASHBOARD_SETTINGS_LINK,
  SHEET_SETTINGS_LINK,
} from '@/lib/tab-style-links';
import { getTheme } from '@/lib/themes';
import { TabStylePreview } from './TabStylePreview';

function useViewerAppearance() {
  return useAppearance().appearance;
}

type Surface = TabStyleSurface<TabLook, BackgroundPattern>;
type Changes = TabStyleSurfaceChanges<TabLook, BackgroundPattern>;

// The sample the Finish and Text panels draw: the diagram, or a board on a plan's tab.
const preview =
  (scene: 'diagram' | 'board'): Surface['renderPreview'] =>
  (kind, p) => (
    <TabStylePreview
      finish={p.finish}
      canvasBackground={p.canvasBackground}
      themeId={p.themeId}
      font={p.font}
      textSize={kind === 'text' ? p.textSize : undefined}
      scene={scene}
      label={
        kind === 'finish'
          ? `A sample ${scene} drawn in the ${p.finishLabel} finish`
          : `A sample ${scene} lettered in ${p.fontLabel}`
      }
    />
  );

// A plan's tab (a board, a Sheet, a form, a dashboard) offers no moving canvas: the static patterns, and the looks
// without an animated one.
const calmLook = (look: TabLook) => !isAnimatedPattern(look.pattern);
const staticCanvas: Surface['renderCanvasPanel'] = (canvas) => (
  <CanvasStyleControls {...canvas} showAllPatterns previewTiles staticOnly />
);
const planTab = (changes: Changes): Changes => ({
  lookFilter: calmLook,
  renderCanvasPanel: staticCanvas,
  renderPreview: preview('board'),
  ...changes,
});

// The page fills the tab with an opaque surface, the canvas only a rim round it: its pattern's size and colour, and
// the size of new text (a sheet's cells are a fixed 13 px, a form has none), change nothing worth a control.
const PAGE_HIDDEN = ['defaultTextSize', 'animationSpeed', 'patternScale', 'patternColor'] as const;

export const TAB_STYLE_PROFILE: TabStyleProfile<TabLook, BackgroundPattern> = {
  looks: {
    all: TAB_LOOKS,
    seasonalFor: seasonalLooksFor,
    matches: lookMatches,
    activeId: activeLookId,
    preview: (look) => ({
      markup: lookPreviewSvg(look),
      paper: lookPreviewTab(look).backgroundColor,
    }),
    rollMashup,
  },
  themeSummary: (themeId) => {
    const theme = getTheme(themeId);
    return { label: theme.label, swatch: <ThemeSwatch theme={theme} heightClass="h-5" /> };
  },
  ThemeBrowser,
  finishLabels: FINISH_LABELS,
  FinishSwatch,
  patternLabel,
  fonts: PLANNER_FONTS,
  TextSizeControl,
  useAppearance: useViewerAppearance,
  renderHelp: (article) => <HelpArticleLink size="md" article={article} />,
  // A popover flying out of the paintbrush, a centred dialog without it, a bottom sheet on a phone (ClusterPanel), under
  // the dialog hero header every app's Tab Style wears.
  frame: {
    kind: 'custom',
    render: ({ subtitle, help, onClose, children }) => (
      <ClusterPanel
        label="Tab style"
        title="Tab Style"
        subtitle={subtitle}
        hero={canvasThemeHeroArt}
        anchorSelector='[data-tour-id="canvas-theme"]'
        onClose={onClose}
        headerEnd={help}
      >
        {children}
      </ClusterPanel>
    ),
  },
  base: {
    panels: TAB_STYLE_PANELS,
    hiddenControls: [],
    renderCanvasPanel: (canvas) => <CanvasStyleControls {...canvas} showAllPatterns previewTiles />,
    renderPreview: preview('diagram'),
    // A plan's tab holds cards, cells and fields as well as elements, so its lines say "everything".
    copy: tabStyleCopy({
      viewLines: {
        theme: 'The colours everything on the tab draws in.',
        finish: 'How everything on the tab is drawn.',
      },
    }),
  },
  surfaces: {
    // A board is see-through: the canvas under it shows, and its cards take the size of new text.
    board: planTab({
      hiddenControls: ['animationSpeed'],
      links: [BOARD_CONFIGURE_LINK],
      copy: {
        viewLines: {
          looks: 'Pick a look for the board, then fine-tune any part of it.',
          font: 'The board’s font, and the size its cards’ text starts at.',
          canvas: 'The pattern and colours the board sits on.',
        },
      },
    }),
    sheet: planTab({
      hiddenControls: PAGE_HIDDEN,
      links: [SHEET_SETTINGS_LINK],
      copy: {
        viewLines: {
          looks: 'Colours, the frame’s finish and the title’s font for the sheet.',
          font: 'The font of the sheet’s title; its cells keep the interface face.',
          canvas: 'The colour and pattern in the rim round the sheet.',
        },
      },
    }),
    form: planTab({
      hiddenControls: PAGE_HIDDEN,
      copy: {
        viewLines: {
          looks: 'Colours, finish and font for the whole form.',
          font: 'The font the whole form is lettered in.',
          canvas: 'The colour and pattern behind the form.',
        },
      },
    }),
    dashboard: planTab({
      hiddenControls: ['defaultTextSize', 'animationSpeed'],
      links: [DASHBOARD_SETTINGS_LINK],
      copy: {
        viewLines: {
          looks: 'Pick a look for the dashboard, then fine-tune any part of it.',
          font: 'The font for the dashboard’s headings; it keeps its own scale.',
          canvas: 'The pattern and colours behind the dashboard.',
        },
      },
    }),
  },
};
