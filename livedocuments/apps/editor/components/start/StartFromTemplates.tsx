'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start Making Pages, a start panel
// (StartPanel). Blank Pages and the catalogue's groups beside a grid of the templates, each its preview over its name and line; a
// search across them. It cannot be closed: the tab holds no page until something is chosen, Blank Pages offering an
// empty page of each kind. Choosing a template lands it on the tab at once. After each group's templates come its
// Community tiles (@liveworkspace/community-ui/start), the month's most liked posts in that category, badged Community;
// choosing one opens the person's own copy of it.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livedocuments/ui';
import {
  lucideBriefcase,
  lucideChartPie,
  lucideFileText,
  lucideGraduationCap,
  lucideHouse,
  lucideLightbulb,
  lucideMegaphone,
  lucideMic,
  lucidePartyPopper,
  lucideRocket,
  lucideSquareDashed,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import type { TemplateKind } from '@livedocuments/templates';
import {
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartHref,
  findCommunityStartPost,
  useCommunityStart,
  withCommunityStartMatches,
  type CommunityStartTileOptions,
} from '@liveworkspace/community-ui/start';
import { communityImagePath } from '@livedocuments/api-schema';
import { API_BASE } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { templateCard } from './template-card';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_START } from './start-template-items';
import { useStartPalette } from '@/components/start/useStartPalette';
import { useConnectStart } from '@/components/connect/useConnectStart';

// A Community post's live card image: this app's api's, since the document is this app's.
const communityImage = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph (start-template-items.ts OWN_GROUPS): Blank Pages, then one per catalogue
// category (docs/specs/008-canvas/canvas-and-palette.md "Template categories").
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  'blank-pages': glyph(lucideSquareDashed),
  careers: glyph(lucideBriefcase),
  events: glyph(lucidePartyPopper),
  home: glyph(lucideHouse),
  learning: glyph(lucideGraduationCap),
  marketing: glyph(lucideMegaphone),
  pitches: glyph(lucideRocket),
  plans: glyph(lucideFileText),
  reports: glyph(lucideChartPie),
  speeches: glyph(lucideMic),
  team: glyph(lucideUsers),
};
const FALLBACK_ICON = glyph(lucideLightbulb);

const COPY: { title: string; line: string; noMatch: string; help: HelpArticleKey } = {
  title: 'Start Making Pages',
  line: 'Pick something to make, or start from a blank page under Blank Pages.',
  noMatch: 'page templates',
  help: 'templates',
};

export function StartFromTemplates({
  tabId,
  onTemplate,
  leave = (href) => window.location.assign(href),
}: {
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
  // Leaving for a Community tile's copy (a full navigation; tests watch it instead).
  leave?: (href: string) => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  // Connect liveworkspace File at the rail's foot, where connecting can work (useConnectStart).
  const connect = useConnectStart();
  // How the Community's tiles draw here: this app's card image, the credit in the panel's muted ink.
  const tiles: CommunityStartTileOptions = {
    imageUrl: communityImage,
    note: communityStartCreditNote(palette.muted),
  };
  const start = TEMPLATE_START;
  const copy = COPY;
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
  // Only an explicit blank (closeStartForBlank) opens with it closed, its page asking What Is This Page For?, until the
  // palette tray's Show Templates brings it back (StartAgainTray).
  const closedKey = startClosedKey(tabId);
  const closed = useEmptyCardDismissed(closedKey);
  // The Community's tiles: one read the first time a start shows this session, none while it is closed.
  const community = useCommunityStart(
    {
      app: 'livedocuments.app',
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
  return (
    <StartPanel
      titleId="start-pages-title"
      title={copy.title}
      line={copy.line}
      searchLabel="Find a template"
      noMatchNoun={copy.noMatch}
      helpArticle={copy.help}
      palette={palette}
      categories={categories}
      initialCategory="blank-pages"
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
        onTemplate(kind as TemplateKind);
      }}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
      connect={connect}
    />
  );
}
