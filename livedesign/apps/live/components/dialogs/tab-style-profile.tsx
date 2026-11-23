'use client';

// livedesign's Tab Style profile (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's
// profile"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the parts only this editor knows (its
// looks, themes, finishes, patterns, Text Size control, Show Me and help) and what each surface shows. Every surface
// shows every panel, the New Page Background in the Canvas panel's place and Element Colours on the home; a logo or a
// photo page leaves out the hand-drawn looks.
// Imported only by CanvasThemeDialog, so it loads with the dialog.

import type { BackgroundPattern } from '@livedesign/design';
import {
  TAB_STYLE_PANELS,
  tabStyleCopy,
  type TabStyleProfile,
  type TabStyleSurfaceChanges,
} from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { seasonalLooksFor } from '@liveworkspace/workbench/lib/seasonal-looks';
import {
  FINISH_LABELS,
  FinishSwatch,
} from '@liveworkspace/workbench/components/palette/FinishSection';
import { patternLabel } from '@/components/palette/palette-patterns';
import { TextSizeControl } from '@/components/palette/TextSizeControl';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';
import * as tour from '@/components/tour/TabStyleTour';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { rollMashup } from '@/lib/look-mashup';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import {
  TAB_LOOKS,
  activeLookId,
  lookMatches,
  suitsFinishedArt,
  type TabLook,
} from '@/lib/tab-looks';
import { getTheme } from '@/lib/themes';
import { ElementColoursRow } from './ElementColoursRow';
import { NewPageBackgroundPanel } from './NewPageBackgroundPanel';
import { TabStylePreview } from './TabStylePreview';

function useViewerAppearance() {
  return useAppearance().appearance;
}

// A logo's or a photo's art is finished work: the looks drawn by hand (Sketch, Marker) are left out there
// (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's profile").
const finishedArt: TabStyleSurfaceChanges<TabLook, BackgroundPattern> = {
  lookFilter: suitsFinishedArt,
};

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
  TextSizeControl,
  useAppearance: useViewerAppearance,
  renderHelp: (article) => <HelpArticleLink size="md" article={article} />,
  frame: { kind: 'modal', tour },
  base: {
    panels: TAB_STYLE_PANELS,
    hiddenControls: [],
    renderCanvasPanel: (canvas) => <NewPageBackgroundPanel canvas={canvas} />,
    renderHomeExtra: () => <ElementColoursRow />,
    renderPreview: (kind, p) => (
      <TabStylePreview
        finish={p.finish}
        canvasBackground={p.canvasBackground}
        themeId={p.themeId}
        font={p.font}
        textSize={kind === 'text' ? p.textSize : undefined}
        label={
          kind === 'finish'
            ? `A sample frame drawn in the ${p.finishLabel} finish`
            : `A sample frame lettered in ${p.fontLabel}`
        }
      />
    ),
    copy: tabStyleCopy({
      viewLines: {
        looks: 'Pick a look for the tab’s pages, then fine-tune any part of it.',
        canvas: 'The background new pages start on, and the canvas around the pages.',
      },
      panelTitles: { canvas: 'New Page Background' },
    }),
  },
  surfaces: { logo: finishedArt, photo: finishedArt },
};
