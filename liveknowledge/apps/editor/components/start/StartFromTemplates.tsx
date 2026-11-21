'use client';

// The knowledgebase's start screen (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"), a start panel
// (StartPanel): Start (Blank Knowledgebase) and the catalogue's categories beside a grid of the templates, each its
// preview over its name and line, and a search across them. At the rail's foot Describe to Set Up and Import, then
// Connect File. It cannot be closed by itself: Blank Knowledgebase is the way past it. After each group's templates
// come its Community tiles (@liveworkspace/community-ui/start), the month's most liked posts in that category, badged
// Community; choosing one opens the person's own copy of it.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@liveknowledge/ui';
import {
  lucideBookOpen,
  lucideCircleHelp,
  lucideCode,
  lucideFileDown,
  lucideHandshake,
  lucideLightbulb,
  lucidePackage,
  lucideSquareDashed,
} from '@liveworkspace/icons/lucide';
import type { TemplateKind } from '@liveknowledge/templates';
import {
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartHref,
  findCommunityStartPost,
  useCommunityStart,
  withCommunityStartMatches,
  type CommunityStartTileOptions,
} from '@liveworkspace/community-ui/start';
import { communityImagePath } from '@liveknowledge/api-schema';
import { API_BASE } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { templateCard } from './template-card';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { START_GROUP_ID, TEMPLATE_START } from './start-template-items';
import { SetupSparkleIcon } from '@/components/setup/setup-icons';
import { useStartPalette } from '@/components/start/useStartPalette';
import { useConnectStart } from '@/components/connect/useConnectStart';

// A Community post's live card image: this app's api's, since the document is this app's.
const communityImage = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph (start-template-items.ts OWN_GROUPS): Start, then one per catalogue category
// (packages/templates template-categories.ts).
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  [START_GROUP_ID]: glyph(lucideSquareDashed),
  engineering: glyph(lucideCode),
  handbooks: glyph(lucideBookOpen),
  onboarding: glyph(lucideHandshake),
  product: glyph(lucidePackage),
  support: glyph(lucideCircleHelp),
};
const FALLBACK_ICON = glyph(lucideLightbulb);
const ImportGlyph = glyph(lucideFileDown);

const COPY: { title: string; line: string; noMatch: string; help: HelpArticleKey } = {
  title: 'Start Your Knowledgebase',
  line: 'Start blank, from a template, from a description, or from what you already have.',
  noMatch: 'templates',
  help: 'templates',
};

export function StartFromTemplates({
  onTemplate,
  onDescribe,
  onImport,
  leave = (href) => window.location.assign(href),
}: {
  // A template, or Blank Knowledgebase (`blank`), chosen.
  onTemplate: (kind: TemplateKind) => void;
  // Describe to Set Up, where it is offered (a signed-in Editor, not Offline).
  onDescribe?: (() => void) | undefined;
  // Import, for an Editor.
  onImport?: (() => void) | undefined;
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
  // The page type the start shows (start-diagramming.md "Page type"): All Pages each time it opens.
  // One page kind (docs/specs/002-project-scope/not-in-liveknowledge.md): the start has no page type to filter by.
  const withCommunity = true;
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
  // The Community's tiles: one read the first time a start shows this session.
  const community = useCommunityStart(
    {
      app: 'liveknowledge.app',
      communityApi: process.env.NEXT_PUBLIC_COMMUNITY_API,
      apiBase: API_BASE,
    },
    true,
  );
  const rail = useMemo(() => start.groups.map((g) => g.id), [start]);
  // On screen: the tours hold their offer until it goes (start-panel-open.ts).
  useEffect(() => {
    setStartPanelOpen(true);
    return () => setStartPanelOpen(false);
  }, []);
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
      initialCategory={categories[0]?.id ?? 'product'}
      cardsIn={(id) => [
        ...(start.groups.find((g) => g.id === id)?.kinds ?? []).map(templateCard),
        ...(withCommunity ? communityStartCardsIn(community, id, tiles) : []),
      ]}
      // The rail counts templates: the Community's tiles arriving never change it.
      countIn={(id) => start.groups.find((g) => g.id === id)?.kinds.length ?? 0}
      search={(query) => {
        const own = start
          .search(query)
          .map((g) => ({ category: g.group, cards: g.kinds.map(templateCard) }));
        return withCommunity ? withCommunityStartMatches(own, community, query, rail, tiles) : own;
      }}
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
      // Describe to Set Up then Import, above Connect File (the rail's last entry): each closes the start and opens its
      // dialog over the empty knowledgebase.
      footLead={[
        ...(onDescribe
          ? [
              {
                id: 'describe',
                name: 'Describe to Set Up',
                icon: <SetupSparkleIcon aria-hidden />,
                onPick: onDescribe,
              },
            ]
          : []),
        ...(onImport
          ? [{ id: 'import', name: 'Import', icon: <ImportGlyph aria-hidden />, onPick: onImport }]
          : []),
      ]}
    />
  );
}
