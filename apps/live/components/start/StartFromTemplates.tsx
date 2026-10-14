'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start Diagramming on a Diagram tab, Start
// Facilitating on a Facilitate tab, Start Illustrating on an Illustrate tab, each a start panel (StartPanel) as Start
// Planning is Plan's. Recommended (the mode's blank first) and its groups beside a grid of the mode's templates, each its preview over its name and line; a
// search across them; Something Else opens the Quick Start on every mode, and the × starts from nothing. Choosing a
// template lands it on the tab at once.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideClock,
  lucideCode,
  lucideChartPie,
  lucideCoins,
  lucideDices,
  lucideFileText,
  lucideImage,
  lucideGrid3x3,
  lucideLayers,
  lucideLightbulb,
  lucideMap,
  lucideMessagesSquare,
  lucideNetwork,
  lucidePenTool,
  lucideRefreshCw,
  lucideShapes,
  lucideShare2,
  lucideSquareKanban,
  lucideStar,
  lucideUsers,
  lucideVote,
  lucideWorkflow,
} from '@livediagram/icons/lucide';
import { TemplatePreview } from '@livediagram/template-previews';
import type { TemplateKind } from '@livediagram/templates';
import { dismissEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel, type StartPanelCard } from './StartPanel';
import { setStartPanelOpen } from './start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_STARTS, templateOf, type TemplateStartMode } from './start-template-items';
import { StartModeSwitch } from '@/components/start/StartModeSwitch';
import { useStartPalette } from '@/components/start/useStartPalette';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph: Diagram's catalogue categories and Facilitate's session groups.
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  recommended: glyph(lucideStar),
  planning: glyph(lucideSquareKanban),
  finance: glyph(lucideCoins),
  spreadsheets: glyph(lucideGrid3x3),
  meetings: glyph(lucideMessagesSquare),
  mindmaps: glyph(lucideShare2),
  timelines: glyph(lucideClock),
  flowcharts: glyph(lucideWorkflow),
  strategy: glyph(lucideMap),
  hierarchies: glyph(lucideNetwork),
  design: glyph(lucidePenTool),
  presentations: glyph(lucideLayers),
  technical: glyph(lucideCode),
  games: glyph(lucideDices),
  retrospectives: glyph(lucideRefreshCw),
  workshops: glyph(lucideUsers),
  decisions: glyph(lucideVote),
  slides: glyph(lucideLayers),
  infographics: glyph(lucideChartPie),
  articles: glyph(lucideFileText),
  posters: glyph(lucideImage),
  logos: glyph(lucideShapes),
  'visual-notes': glyph(lucidePenTool),
  prototypes: glyph(lucideLayers),
};
const FALLBACK_ICON = glyph(lucideLightbulb);

const COPY: Record<
  TemplateStartMode,
  { title: string; line: string; noMatch: string; help: HelpArticleKey }
> = {
  diagram: {
    title: 'Start Diagramming',
    line: 'Pick a template to build on, or close this to start from a blank canvas.',
    noMatch: 'diagram templates',
    help: 'yourFirstDiagram',
  },
  draw: {
    title: 'Start Drawing',
    line: 'Pick something to sketch on, or close this to start from a blank whiteboard.',
    noMatch: 'drawing templates',
    help: 'drawMode',
  },
  facilitate: {
    title: 'Start Facilitating',
    line: 'Pick a session format to run, or close this to start from a blank session.',
    noMatch: 'session templates',
    help: 'templates',
  },
  illustrate: {
    title: 'Start Illustrating',
    line: 'Pick something to make, or close this to start from a blank page.',
    noMatch: 'illustration templates',
    help: 'templates',
  },
};

// A template as the panel's card: its preview, light-canvas art on a re-lit tile, as the Quick Start draws it.
const toCard = (kind: TemplateKind): StartPanelCard => {
  const t = templateOf(kind);
  return {
    id: t.kind,
    name: t.title,
    line: t.description,
    picture: (
      <span className="preview-art-tile flex h-full w-full items-center justify-center rounded-lg bg-slate-50 [&>svg]:h-full [&>svg]:w-auto">
        <TemplatePreview kind={t.kind} />
      </span>
    ),
  };
};

export function StartFromTemplates({
  mode,
  tabId,
  onTemplate,
  onQuickStart,
}: {
  mode: TemplateStartMode;
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
  onQuickStart: () => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  const start = TEMPLATE_STARTS[mode];
  const copy = COPY[mode];
  const categories = useMemo(
    () =>
      start.groups.map((g) => ({
        id: g.id,
        name: g.name,
        line: g.line,
        icon: RAIL_ICONS[g.id] ?? FALLBACK_ICON,
      })),
    [start],
  );
  // The × starts from nothing: the panel stays closed on this tab in this mode, for this person (empty-card-dismissed.ts),
  // until the palette tray's Show Templates brings it back (StartAgainTray). Remembered per mode: closing Start
  // Diagramming leaves Start Facilitating to show when the tab switches to it.
  const closedKey = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(closedKey);
  // On screen: the tours hold their offer until it goes (start-panel-open.ts).
  useEffect(() => {
    if (closed) return;
    setStartPanelOpen(true);
    return () => setStartPanelOpen(false);
  }, [closed]);
  if (closed) return null;
  const close = () => {
    dismissEmptyCard(closedKey);
  };
  return (
    <StartPanel
      titleId={`start-${mode}-title`}
      title={copy.title}
      line={copy.line}
      searchLabel="Find a template"
      noMatchNoun={copy.noMatch}
      helpArticle={copy.help}
      palette={palette}
      categories={categories}
      initialCategory="recommended"
      cardsIn={(id) => (start.groups.find((g) => g.id === id)?.kinds ?? []).map(toCard)}
      search={(query) =>
        start.search(query).map((g) => ({ category: g.group, cards: g.kinds.map(toCard) }))
      }
      onChoose={(kind) => {
        // The blank leaves the tab empty, so it closes the panel as the × does.
        if (kind === start.blank) close();
        onTemplate(kind as TemplateKind);
      }}
      onQuickStart={onQuickStart}
      lead={<StartModeSwitch />}
      onClose={close}
    />
  );
}
