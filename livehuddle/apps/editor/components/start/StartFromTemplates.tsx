'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start a Space, a start panel
// (StartPanel). Recommended (the blank first) and the catalogue's groups beside a grid of the templates, each its
// preview over its name and line; a search across them and every other mode's templates (otherModeMatches); the × starts
// from nothing. Choosing a template lands it on the tab at once, another mode's switching the tab to that mode. After
// each group's templates come its Community tiles (@liveworkspace/community-ui/start), the month's most liked posts
// in that category, badged Community; choosing one opens the person's own copy of it.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livehuddle/ui';
import {
  lucideBuilding2,
  lucideMap,
  lucidePresentation,
  lucideStar,
  lucideTreePine,
  lucideWine,
} from '@liveworkspace/icons/lucide';
import type { TemplateCategory, TemplateKind } from '@livehuddle/templates';
import {
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartHref,
  findCommunityStartPost,
  useCommunityStart,
  withCommunityStartMatches,
  type CommunityStartTileOptions,
} from '@liveworkspace/community-ui/start';
import { communityImagePath } from '@livehuddle/api-schema';
import { API_BASE } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { templateCard } from './template-card';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';
import { useStartPalette } from '@/components/start/useStartPalette';

// A Community post's live card image: this app's api's, since the document is this app's.
const communityImage = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph: Recommended, then every catalogue category (a Record, so a new category needs one).
const RAIL_ICONS: Readonly<
  Record<'recommended' | TemplateCategory, ReturnType<typeof lucideGlyph>>
> = {
  recommended: glyph(lucideStar),
  campus: glyph(lucideMap),
  office: glyph(lucideBuilding2),
  events: glyph(lucidePresentation),
  outdoor: glyph(lucideTreePine),
  recreation: glyph(lucideWine),
};

const COPY: Record<
  TemplateStartMode,
  { title: string; line: string; noMatch: string; help: HelpArticleKey }
> = {
  workshop: {
    title: 'Start a Space',
    line: 'Walk into an office, a hall, a bar or a garden. Close this to start from a blank space.',
    noMatch: 'templates',
    help: 'templates',
  },
};

export function StartFromTemplates({
  mode,
  tabId,
  onTemplate,
  onStartBlank,
  leave = (href) => window.location.assign(href),
}: {
  mode: TemplateStartMode;
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
  // The × (and Escape, and the phone's drag down) starts from a blank space: it lands the blank's Avatar Pad as
  // choosing the blank does, but is no pick (docs/specs/007-editor/start-diagramming.md "Bringing it back").
  onStartBlank?: (kind: TemplateKind) => void;
  // Leaving for a Community tile's copy (a full navigation; tests watch it instead).
  leave?: (href: string) => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  // How the Community's tiles draw here: this app's card image, the credit in the panel's muted ink.
  const tiles: CommunityStartTileOptions = {
    imageUrl: communityImage,
    note: communityStartCreditNote(palette.muted),
  };
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
  // The × starts from a blank space (its Avatar Pad, onStartBlank): the panel stays closed on this tab in this mode, for
  // this person (empty-card-dismissed.ts), until the palette tray's Show Templates brings it back (StartAgainTray).
  const closedKey = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(closedKey);
  // The Community's tiles: one read the first time a start shows this session, none while it is closed.
  const community = useCommunityStart(
    {
      app: 'livehuddle.app',
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
  const closeToBlank = () => {
    close();
    onStartBlank?.(start.blank);
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
      // Recommended leads (start-diagramming.md "Recommended leads").
      initialCategory={start.initial}
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
        // The blank lands only its Avatar Pad, a tab still blank, so it closes the panel as the × does.
        if (kind === start.blank) close();
        onTemplate(kind as TemplateKind);
      }}
      onClose={closeToBlank}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
    />
  );
}
