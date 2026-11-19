'use client';

// livehuddle's Tab Style profile (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's
// profile"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the parts only this editor knows (its
// looks, themes, finishes, floors, Text Size control, Show Me and help) and what each surface shows. A Space shows every
// panel; its Canvas panel is the Room one, floor and walls (components/canvas/RoomStyleControls.tsx), and its preview a
// small room (TabStylePreview). It has no tab locks.
// Imported only by CanvasThemeDialog, so it loads with the dialog.

import type { BackgroundPattern } from '@livehuddle/document';
import {
  TAB_STYLE_PANELS,
  tabStyleCopy,
  type TabStyleProfile,
} from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { RoomStyleControls } from '@/components/canvas/RoomStyleControls';
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
import { seasonalLooksFor } from '@/lib/seasonal-looks';
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
  TextSizeControl,
  useAppearance: useViewerAppearance,
  renderHelp: (article) => <HelpArticleLink size="md" article={article} />,
  frame: { kind: 'modal', tour },
  tabLocks: false,
  base: {
    panels: TAB_STYLE_PANELS,
    hiddenControls: [],
    renderCanvasPanel: (canvas) => <RoomStyleControls {...canvas} />,
    renderPreview: (kind, p) => (
      <TabStylePreview
        finish={p.finish}
        canvasBackground={p.canvasBackground}
        themeId={p.themeId}
        font={p.font}
        textSize={kind === 'text' ? p.textSize : undefined}
        label={
          kind === 'finish'
            ? `A sample room drawn in the ${p.finishLabel} finish`
            : `A sample room lettered in ${p.fontLabel}`
        }
      />
    ),
    // A Space is rooms on a floor, so its Canvas panel is the Room.
    copy: tabStyleCopy({
      viewLines: {
        looks: 'Pick a look for the Space, then fine-tune any part of it.',
        canvas: 'The floor under the Space and the walls round its rooms.',
      },
      panelTitles: { canvas: 'Room' },
    }),
  },
};
