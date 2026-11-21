'use client';

// Knowledgebase Style's profile for the one Tab Style dialog every editor shares (docs/specs/030-knowledgebase/
// page-surface.md "Knowledgebase Style"; liveworkspace/docs/specs/011-workbench/tab-style.md "The profile"): the
// dialog kept whole where it suits writing and cut where it only suits a canvas. Its looks are a theme and a
// typeface, each card a small page of writing; Fine-tune holds Text and Colours, both drawn here. No Canvas panel,
// no Finish panel or filter, no New Page Background, no Apply to All Tabs, and no Show Me (the shared tour walks a
// tab's finish and canvas). Imported only by KnowledgeStyleDialog, so it loads with the dialog.
import { DEFAULT_KNOWLEDGE_STYLE, tint, type KnowledgeStyle } from '@liveknowledge/document';
import {
  tabStyleCopy,
  type TabStyleProfile,
} from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabStyleTourBinding } from '@liveworkspace/workbench/components/tour/tab-style-tour-steps';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useAppearance } from '@/hooks/ui/useAppearance';
import {
  KNOWLEDGE_LOOKS,
  activeKnowledgeLookId,
  knowledgeLookMatches,
  knowledgeSeasonalLooksFor,
  rollKnowledgeMashup,
  withKnowledgeLook,
  type KnowledgeLook,
} from '@/lib/knowledge-style/knowledge-looks';
import { lookPagePreview } from '@/lib/knowledge-style/look-page-preview';
import { knowledgeThemeAccent } from '@/lib/knowledge-style/knowledge-accent';
import { KnowledgeColoursPanel } from './KnowledgeColoursPanel';
import { KnowledgeTextPanel } from './KnowledgeTextPanel';
import {
  COLOURS_LINE,
  STYLE_LINE,
  STYLE_TITLE,
  TEXT_LINE,
  coloursSummary,
  textSummary,
  themeName,
} from '@/lib/knowledge-style/knowledge-style-words';

function useViewerAppearance() {
  return useAppearance().appearance;
}

// No Show Me here: the dialog reads only whether a tour is running, and none ever is.
const NO_TOUR = {
  useTabStyleTour: () => ({ active: false }),
  TabStyleShowMeButton: () => null,
  TabStyleTourStage: () => null,
} as unknown as TabStyleTourBinding;

const nothing = () => null;

// The Colours row's mark: the theme's accent and two tints of it, as chips of colour. Never the editors' theme
// swatch, which is a small diagram.
function AccentChips({ themeId }: { themeId: string }) {
  const accent = knowledgeThemeAccent(themeId);
  return (
    <span className="flex h-5 items-center justify-center gap-0.5">
      {[accent, tint(accent, 0.45), tint(accent, 0.8)].map((colour) => (
        <span key={colour} className="h-4 w-2 rounded-sm" style={{ backgroundColor: colour }} />
      ))}
    </span>
  );
}

/** The profile for a knowledgebase wearing `style`: the Fine-tune rows say what it holds now. */
export function knowledgeStyleProfile(
  style: KnowledgeStyle,
): TabStyleProfile<KnowledgeLook, string> {
  return {
    title: STYLE_TITLE,
    finishFilter: false,
    looks: {
      all: KNOWLEDGE_LOOKS,
      seasonalFor: knowledgeSeasonalLooksFor,
      matches: knowledgeLookMatches,
      activeId: activeKnowledgeLookId,
      // The card is the look alone, on the default size, spacing and heading style: it does not change as the
      // knowledgebase's other settings do, so it is drawn once an appearance.
      preview: (look) => lookPagePreview(withKnowledgeLook(DEFAULT_KNOWLEDGE_STYLE, look)),
      rollMashup: (options) => rollKnowledgeMashup({ previous: options?.previous }),
    },
    themeSummary: (themeId) => ({
      label: themeName(themeId),
      swatch: <AccentChips themeId={themeId} />,
    }),
    ThemeBrowser,
    finishLabels: FINISH_LABELS,
    FinishSwatch,
    patternLabel: () => '',
    TextSizeControl: nothing,
    useAppearance: useViewerAppearance,
    renderHelp: (article) => <HelpArticleLink size="md" article={article} />,
    frame: { kind: 'modal', tour: NO_TOUR },
    base: {
      // Text first: a knowledgebase is its writing.
      panels: ['font', 'theme'],
      hiddenControls: ['defaultTextSize', 'animationSpeed', 'patternScale', 'patternColor'],
      renderCanvasPanel: nothing,
      renderPreview: nothing,
      renderPanel: (panel) =>
        panel === 'font' ? (
          <KnowledgeTextPanel />
        ) : panel === 'theme' ? (
          <KnowledgeColoursPanel />
        ) : null,
      panelValues: { font: textSummary(style), theme: coloursSummary(style) },
      // The Text row's "Aa" in the heading font worn now: a heading face and a body face wear no tab font.
      textFont: style.headingFont,
      copy: tabStyleCopy({
        viewLines: { looks: STYLE_LINE, font: TEXT_LINE, theme: COLOURS_LINE },
      }),
    },
  };
}
