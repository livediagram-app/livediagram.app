'use client';

// livedocuments' Tab Style profile (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's
// profile"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the parts only this editor knows (its
// looks, themes, finishes, patterns, Text Size control, Show Me and help) and what each surface shows. A canvas tab
// shows every panel and control. The popover hangs from the page Style that opened it (lib/tab-style-opener.ts), and
// new text's size runs over a text's range.
// Imported only by CanvasThemeDialog, so it loads with the dialog.

import { textPxRangeFor, type BackgroundPattern } from '@livedocuments/document';
import {
  TAB_STYLE_COPY,
  TAB_STYLE_PANELS,
  type TabStyleProfile,
  type TabStyleTextSizeProps,
} from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { seasonalLooksFor } from '@liveworkspace/workbench/lib/seasonal-looks';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { patternLabel } from '@/components/palette/palette-patterns';
import { TextSizeControl } from '@/components/palette/TextSizeControl';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';
import * as tour from '@/components/tour/TabStyleTour';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { rollMashup } from '@/lib/look-mashup';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import { TAB_LOOKS, activeLookId, lookMatches, type TabLook } from '@/lib/tab-looks';
import { getTheme } from '@/lib/themes';
import { tabStyleOpener } from '@/lib/tab-style-opener';
import { TabStylePreview } from './TabStylePreview';

// New text's size, so a text's range: a document's 24 to 72 px.
const TEXT_RANGE = textPxRangeFor('text');
function NewTextSize(props: TabStyleTextSizeProps) {
  return <TextSizeControl {...props} range={TEXT_RANGE} />;
}

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
  TextSizeControl: NewTextSize,
  useAppearance: useViewerAppearance,
  renderHelp: (article) => <HelpArticleLink size="md" article={article} />,
  frame: { kind: 'modal', tour, opener: tabStyleOpener },
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
            ? `A sample drawn in the ${p.finishLabel} finish`
            : `A sample lettered in ${p.fontLabel}`
        }
      />
    ),
    copy: TAB_STYLE_COPY,
  },
};
