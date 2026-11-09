'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start Diagramming on a Diagram tab, Start
// a Workshop on a Workshop tab, each a start panel (StartPanel). Recommended (the mode's blank first) and its groups beside a grid of the mode's templates, each its
// preview over its name and line; a search across them and every other mode's templates (otherModeMatches); the × starts
// from nothing. Choosing a template lands it on the tab at once, another mode's switching the tab to that mode. After
// each group's templates come its Community tiles (@liveworkspace/community-ui/start), the month's most liked posts
// in that category, badged Community; choosing one opens the person's own copy of it.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideCalendarRange,
  lucideCode,
  lucideDices,
  lucideGoal,
  lucideGraduationCap,
  lucideLightbulb,
  lucideMap,
  lucideMessagesSquare,
  lucidePenTool,
  lucideRefreshCw,
  lucideStar,
  lucideUsers,
  lucideVote,
  lucideWorkflow,
} from '@liveworkspace/icons/lucide';
import type { EditorMode } from '@livediagram/document';
import type { TemplateCategory, TemplateKind } from '@livediagram/templates';
import {
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartHref,
  findCommunityStartPost,
  useCommunityStart,
  withCommunityStartMatches,
  type CommunityStartTileOptions,
} from '@liveworkspace/community-ui/start';
import { communityImagePath } from '@livediagram/api-schema';
import { API_BASE } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { otherModeMatches } from './other-mode-matches';
import { templateCard } from './template-card';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';
import { StartModeSwitch } from '@/components/start/StartModeSwitch';
import { useStartPalette } from '@/components/start/useStartPalette';
import { useConnectStart } from '@/components/connect/useConnectStart';

// A Community post's live card image: this app's api's, since the document is this app's.
const communityImage = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph: Recommended, then every catalogue category (a Record, so a new category needs one).
const RAIL_ICONS: Readonly<
  Record<'recommended' | TemplateCategory, ReturnType<typeof lucideGlyph>>
> = {
  recommended: glyph(lucideStar),
  ideas: glyph(lucideLightbulb),
  decisions: glyph(lucideVote),
  goals: glyph(lucideGoal),
  meetings: glyph(lucideMessagesSquare),
  people: glyph(lucideUsers),
  planning: glyph(lucideCalendarRange),
  processes: glyph(lucideWorkflow),
  product: glyph(lucidePenTool),
  games: glyph(lucideDices),
  retros: glyph(lucideRefreshCw),
  software: glyph(lucideCode),
  strategy: glyph(lucideMap),
  learning: glyph(lucideGraduationCap),
};

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
  workshop: {
    title: 'Start a Workshop',
    line: 'Pick a session format to run, or close this to start from a blank workshop.',
    noMatch: 'session templates',
    help: 'templates',
  },
};

export function StartFromTemplates({
  mode,
  tabId,
  onTemplate,
  onOtherModeTemplate,
  leave = (href) => window.location.assign(href),
}: {
  mode: TemplateStartMode;
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
  // A template found in another mode (start-diagramming.md "Found in other modes"): it lands, switching the tab there.
  onOtherModeTemplate: (mode: EditorMode, kind: TemplateKind) => void;
  // Leaving for a Community tile's copy (a full navigation; tests watch it instead).
  leave?: (href: string) => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  // Connect File at the rail's foot, where connecting can work (useConnectStart).
  const connect = useConnectStart();
  // How the Community's tiles draw here: this app's card image, the credit in the panel's muted ink.
  const tiles: CommunityStartTileOptions = {
    imageUrl: communityImage,
    note: communityStartCreditNote(palette.muted),
  };
  // Other modes are searched only where the tab's mode may change.
  const canSwitch = useEditorModeState()?.canSwitch === true;
  const start = TEMPLATE_STARTS[mode];
  const copy = COPY[mode];
  const categories = useMemo(
    () =>
      start.groups.map((g) => ({
        id: g.id,
        name: g.name,
        line: g.line,
        icon: RAIL_ICONS[g.id as keyof typeof RAIL_ICONS],
      })),
    [start],
  );
  // The × starts from nothing: the panel stays closed on this tab in this mode, for this person (empty-card-dismissed.ts),
  // until the palette tray's Show Templates brings it back (StartAgainTray). Remembered per mode: closing Start
  // Diagramming leaves Start a Workshop to show when the tab switches to it.
  const closedKey = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(closedKey);
  // The Community's tiles: one read the first time a start shows this session, none while it is closed.
  const community = useCommunityStart(
    {
      app: 'livediagram.app',
      communityApi: process.env.NEXT_PUBLIC_COMMUNITY_API,
      apiBase: API_BASE,
    },
    !closed,
  );
  const rail = useMemo(() => start.groups.map((g) => g.id), [start]);
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
      cardsIn={(id) => [
        ...(start.groups.find((g) => g.id === id)?.kinds ?? []).map(templateCard),
        ...communityStartCardsIn(community, id, tiles),
      ]}
      // The rail counts templates: the Community's tiles arriving never change it.
      countIn={(id) => start.groups.find((g) => g.id === id)?.kinds.length ?? 0}
      search={(query) =>
        withCommunityStartMatches(
          start.search(query).map((g) => ({ category: g.group, cards: g.kinds.map(templateCard) })),
          community,
          query,
          rail,
          tiles,
        )
      }
      onChoose={(kind) => {
        const post = findCommunityStartPost(community, kind);
        if (post) {
          // Your own copy, through the post's community link, as the gallery's Make a Copy (and counted as one).
          track('Community', 'Copied', 'StartWith');
          leave(communityStartHref(post));
          return;
        }
        // The blank leaves the tab empty, so it closes the panel as the × does.
        if (kind === start.blank) close();
        onTemplate(kind as TemplateKind);
      }}
      elsewhere={
        canSwitch
          ? (query) =>
              otherModeMatches(mode, query).map((m) => ({
                mode: m.mode,
                cards: m.kinds.map(templateCard),
              }))
          : undefined
      }
      onChooseElsewhere={(m, kind) => onOtherModeTemplate(m, kind as TemplateKind)}
      lead={<StartModeSwitch />}
      onClose={close}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
      connect={connect}
    />
  );
}
