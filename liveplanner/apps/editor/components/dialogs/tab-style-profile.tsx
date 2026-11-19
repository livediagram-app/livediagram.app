'use client';

// liveplanner's Tab Style profile (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's
// profile"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the parts only this editor knows (its
// looks, themes, finishes, patterns, typefaces, Text Size control and help) and what each surface shows. Every tab
// kind shows every panel and control. The dialog wears ClusterPanel, the frame it shares with a board's Configure, and
// has no Show Me; its typefaces are the faces liveplanner offers (docs/specs/004-interface-design/fonts.md).
// Imported only by CanvasThemeDialog, so it loads with the dialog.

import { PLANNER_FONTS, type BackgroundPattern } from '@liveplanner/project';
import { canvasThemeHeroArt } from '@liveworkspace/ui/dialog-hero-art/canvas-theme';
import {
  TAB_STYLE_PANELS,
  tabStyleCopy,
  type TabStyleProfile,
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
import { getTheme } from '@/lib/themes';
import { TabStylePreview } from './TabStylePreview';

function useViewerAppearance() {
  return useAppearance().appearance;
}

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
    renderPreview: (kind, p) => (
      <TabStylePreview
        finish={p.finish}
        canvasBackground={p.canvasBackground}
        themeId={p.themeId}
        font={p.font}
        textSize={kind === 'text' ? p.textSize : undefined}
        label={
          kind === 'finish'
            ? `A sample diagram drawn in the ${p.finishLabel} finish`
            : `A sample diagram lettered in ${p.fontLabel}`
        }
      />
    ),
    // A plan's tab holds cards, cells and fields as well as elements, so its lines say "everything".
    copy: tabStyleCopy({
      viewLines: {
        theme: 'The colours everything on the tab draws in.',
        finish: 'How everything on the tab is drawn.',
      },
    }),
  },
};
