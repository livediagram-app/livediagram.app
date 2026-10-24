import type { HeroSceneKey } from '@/components/hero-scene-data';
import {
  ApiArt,
  ArticleFlowArt,
  ArticleLooksArt,
  ArticlePagesArt,
  ArticleWrapArt,
  AssignedActionsArt,
  CommentsArt,
  ContentsSidebarArt,
  ExpiryArt,
  FollowAlongArt,
  FontsArt,
  FullScreenSlideArt,
  InfographicLayoutArt,
  LaserArt,
  LiveImageArt,
  MarginCommentsArt,
  McpArt,
  PagesArt,
  PagesBackgroundsArt,
  PagesExportArt,
  PagesGifArt,
  PresenceArt,
  PresentLocallyArt,
  PresenterNotesArt,
  RealtimeArt,
  RevokeArt,
  SearchPaletteArt,
  SelectionGlowArt,
  ShareLinksArt,
  SlideLayoutsArt,
  SlideTimingArt,
  SpotlightArt,
  TabWindowArt,
  TeamsArt,
  ThemesArt,
  TidyPageArt,
  TimelineFeedArt,
  UndoRedoArt,
  ZenModeArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@liveworkspace/marketing-site/components/Section';

/**
 * A feature category: one kind of page livedocuments makes, or the way people make them together, each
 * a story beat on the landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Articles"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, and kept short and verb-led, e.g. "Explore articles".
   */
  cta: string;
  /** The scene that plays beside the beat and on the category page (components/hero-scene-data.ts). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: the three kinds of page a
 * document is made of (articles, slide decks, then infographics), then working
 * on them together. `page.tsx` renders one beat per entry and alternates its background by index;
 * `/features/<id>` renders each one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'articles',
    label: 'Articles',
    scene: 'article',
    cta: 'Explore articles',
    title: 'Write it up on pages',
    description:
      'Write on pages like a doc: headings, lists and quotes from the keyboard, pictures and charts in the text, comments in the margin, and five looks to match your house style. The writing flows onto a new page as it grows.',
    metaDescription:
      'Write articles on pages like a doc: Markdown shortcuts, pictures and charts in the text, margin comments and five looks for your house style.',
    highlights: [
      'Write like a doc',
      'Pages that grow',
      'Pictures and charts in the text',
      'Comments in the margin',
    ],
    items: [
      {
        art: <ArticlePagesArt />,
        href: '/help/pages/articles/',
        group: 'Write',
        title: 'Write like a doc',
        description:
          'Type straight onto a page with Markdown shortcuts and a / menu for every block, and paste cleanly from web pages, Google Docs and Word. A formatting toolbar sits on the page for styles, colour, links and lists.',
      },
      {
        art: <ArticleFlowArt />,
        href: '/help/pages/articles/#pages-that-grow',
        group: 'Write',
        title: 'Pages that grow',
        description:
          'Writing flows onto a new page as it grows, and empty pages tidy themselves away. A heading never strands alone at the foot of a page, and a page break is there when you want one.',
      },
      {
        art: <ArticleWrapArt />,
        href: '/help/pages/articles/',
        group: 'Write',
        title: 'Pictures and charts in the text',
        description:
          'Pictures, charts and tables sit in the line, wrap left or right, or float free. Drop a shape into the writing and a drawing area opens right there in the text.',
      },
      {
        art: <ArticleLooksArt />,
        href: '/help/pages/articles/#the-article-s-style',
        group: 'Write',
        title: 'Five looks for an article',
        description:
          'Clean, Classic, Report, Notebook or Bold, then set the accent colour, margins, fonts and page numbers to match your house style.',
      },
      {
        art: <MarginCommentsArt />,
        href: '/help/pages/articles/#comments-and-actions-on-words',
        group: 'Review',
        title: 'Comments in the margin',
        description:
          'Select words to comment on them or hand them to a teammate as an action. A marker in the margin keeps pace with the text as it moves.',
      },
      {
        art: <ContentsSidebarArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Review',
        title: 'Every page in the Contents',
        description:
          'A Contents sidebar lists every page with a picture of it, its number and its name, and highlights the one you are reading. Press a row to glide there, or type to find a page by its name or any words on it.',
      },
      {
        art: <PagesExportArt />,
        href: '/help/pages/exporting-pages/',
        group: 'Review',
        title: 'A PDF at true page size',
        description:
          'Export the article as one PDF, each page exactly its sheet, ready to print or attach. A single page goes out as a PNG or SVG.',
      },
    ],
  },
  {
    id: 'slides',
    label: 'Slide decks',
    scene: 'slides',
    cta: 'Explore slide decks',
    title: 'Build the deck, then present it',
    description:
      'Start a slide from one of 61 ready-made layouts and fill it in, then present the deck full screen on your screen alone, your notes behind a button, with a laser and a spotlight to point the room at what you mean.',
    metaDescription:
      'Slide decks from 61 ready-made layouts, presented full screen with private notes, a timer, a laser pointer and a spotlight.',
    highlights: [
      'Slide pages, ready-made layouts',
      'Notes only you open',
      'Laser pointer for presenting',
      'Your screen, not everyone else’s',
    ],
    items: [
      {
        art: <SlideLayoutsArt />,
        href: '/help/pages/slide-pages/',
        group: 'Build',
        title: 'Slide pages, ready-made layouts',
        description:
          'Add a 16:9 or classic 4:3 slide page and start it from one of 61 layouts: a keynote title, an agenda, three big numbers, a roadmap, a call to action and more. One press puts it in the deck, and it presents edge to edge.',
      },
      {
        art: <FullScreenSlideArt />,
        href: '/help/selection-modes/slide-deck/building-a-deck/',
        group: 'Build',
        title: 'One deck across every tab',
        description:
          'Any page can be a slide: a slide page, an infographic, a page of an article. Order them in the Slide Deck panel: drag to rearrange, rename, duplicate, or hide a slide you might want next week without deleting it. The deck is saved with the document, so a teammate opens it and sees the same talk.',
      },
      {
        art: <PresenterNotesArt />,
        href: '/help/selection-modes/slide-deck/presenting/',
        group: 'Present',
        title: 'Notes only you open',
        description:
          'Write what you mean to say over each slide. During the presentation they sit behind a button in the corner, so nothing about your script is on screen until you ask for it.',
      },
      {
        art: <SlideTimingArt />,
        href: '/help/selection-modes/slide-deck/presenter-controls/',
        group: 'Present',
        title: 'Keep the talk on time',
        description:
          'Give each slide a few minutes when you build the deck. While you present, an elapsed clock counts up and the slide’s budget turns amber when you run over, on your screen only. Both are off until you want them, and running over never moves the deck on for you.',
      },
      {
        art: <PresentLocallyArt />,
        href: '/help/selection-modes/slide-deck/presenting/',
        group: 'Present',
        title: 'Your screen, not everyone else’s',
        description:
          'Presenting shows the deck on your screen and nowhere else. Nobody is dragged into your slide, nobody’s view moves, and collaborators with the document open carry on working. You share your screen the way you already do. Nothing on a slide can be changed by a stray click, so a projector is safe. To leave a deck running on a screen, set it to advance every 5 to 60 seconds and loop back to the start.',
      },
      {
        art: <LaserArt />,
        href: '/help/selection-modes/laser/',
        group: 'Point the room',
        title: 'Laser pointer for presenting',
        description:
          'Switch to the laser and your cursor leaves a glowing trail everyone can see. Point at the thing you mean while you talk it through. Trails fade on their own.',
      },
      {
        art: <SpotlightArt />,
        href: '/help/selection-modes/spotlight/',
        group: 'Point the room',
        title: 'Spotlight one thing at a time',
        description:
          'Switch on Spotlight and the page dims under a soft shroud, with only a circle of light around your cursor. Walk the room through a busy slide one piece at a time. Left-click grows the light, right-click shrinks it, and it is a local view aid, so it never gets in a viewer’s way.',
      },
      {
        art: <ZenModeArt />,
        href: '/help/tools/zen-mode/',
        group: 'Point the room',
        title: 'Zen mode for focus',
        description:
          'Press Z and every toolbar, panel and tab bar drops away, leaving just your pages. Only the zoom controls stay, with an exit button right beside them. Press Z or Esc to bring it all back.',
      },
    ],
  },
  {
    id: 'infographics',
    label: 'Infographics',
    scene: 'infographic',
    cta: 'Explore infographics',
    title: 'Posters, one-pagers and social posts',
    description:
      'Lay out a page from a ready-made layout, paint it from your theme, fill it with stats, charts and quotes, then export it print-ready or post it. Every page has its own size, from A4 to a story.',
    metaDescription:
      'Lay out posters, one-pagers and social posts from 92 ready-made layouts, fill them with stats and charts, then export them print-ready.',
    highlights: [
      'Pages for print and social',
      'Start a page from a layout',
      'Backgrounds from your theme',
      'Every page, print-ready',
    ],
    items: [
      {
        art: <PagesArt />,
        href: '/help/pages/working-with-pages/',
        title: 'Pages for print and social',
        description:
          'A4, US Letter and A3 for print; square, portrait post and story for social. Each page has its own size and orientation, and everything on it moves with it.',
      },
      {
        art: <InfographicLayoutArt />,
        href: '/help/pages/infographic-layouts/',
        title: 'Start a page from a layout',
        description:
          'Ninety-two ready-made pages in eight categories, from a magazine cover and a gig poster to a KPI dashboard, a SWOT and a cheat sheet. Hover one to preview it on your page, press it to place it, then make it yours.',
      },
      {
        art: <TidyPageArt />,
        href: '/help/pages/working-with-pages/',
        title: 'Tidy a page in one press',
        description:
          'Press the broom on a page and it straightens itself: anything poking past the margins comes back inside, edges that nearly line up do, and gaps that are nearly even become even. It keeps your layout and never moves anything far.',
      },
      {
        art: <PagesBackgroundsArt />,
        href: '/help/pages/working-with-pages/',
        title: 'Backgrounds from your theme',
        description:
          'Paint a page in a tint of your theme, a solid colour or a gradient, with dots, a grid or ruled lines over it. Text keeps reading on a dark page, because the ink follows the page.',
      },
      {
        art: <TabWindowArt />,
        href: '/help/pages/tab-windows/',
        title: 'A live window onto another tab',
        description:
          'Put a window onto another tab on a slide or a poster. The window follows every change you or a collaborator make there, so there is never a stale copy to paste again. Open jumps straight to the tab.',
      },
      {
        art: <PagesExportArt />,
        href: '/help/pages/exporting-pages/',
        title: 'Every page, print-ready',
        description:
          'Export every page as one PDF at true print size, or one page as a PNG or SVG. Add pages to a slide deck and present them full screen, one page at a time.',
      },
      {
        art: <PagesGifArt />,
        href: '/help/pages/exporting-pages/',
        title: 'Pages as an animated GIF',
        description:
          'Export the pages as one animated GIF for a chat, an email, a README or a social post. Every animation on a page plays in it, each page holds for 1 to 20 seconds, and it comes in three sizes up to 1440 pixels.',
      },
      {
        art: <ThemesArt />,
        href: '/help/canvas/themes/changing-theme/',
        group: 'Make it yours',
        title: 'Preset themes',
        description:
          'One click recolours every page, shape and line. Every theme has a light and a dark half, and multi-colour themes tint each part a different hue.',
      },
      {
        art: <FontsArt />,
        href: '/help/canvas/text-and-fonts/choosing-fonts/',
        group: 'Make it yours',
        title: 'Fonts for every voice',
        description:
          'Set the typeface per element or as a default for the tab, from Google Fonts spanning sans, serif, slab, display, mono and handwriting.',
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaborate',
    scene: 'together',
    cta: 'Explore collaboration',
    title: 'Work on it together, live',
    description:
      'Share a link and your team is on the pages with you: live cursors, comments on anything, actions handed to teammates, and a timeline of what changed while you were away. Or hand the work to your AI.',
    metaDescription:
      'Share a link and your team is on the pages with you: live cursors, comments, assigned actions, expiring links, teams and an MCP server for AI.',
    highlights: [
      'Live presence',
      'Comments on anything',
      'Assign actions to teammates',
      'Make documents with AI',
    ],
    items: [
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Live presence',
        description:
          'See who is in the document from the participant avatars on each tab. Status rings show online, away, or stale.',
      },
      {
        art: <RealtimeArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Edits land live',
        description:
          'The moment someone makes a change, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
      },
      {
        art: <SelectionGlowArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'See what others are working on',
        description:
          'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner, in real time.',
      },
      {
        art: <FollowAlongArt />,
        href: '/help/canvas/follow-along/',
        group: 'Work together live',
        title: 'Follow someone’s view',
        description:
          'Press Follow beside a teammate and your view goes where theirs goes: their tab, their page, their exact zoom. A pill says who you are following, and the moment you move yourself, you have your own view back.',
      },
      {
        art: <CommentsArt />,
        href: '/help/collaboration/comments/',
        group: 'Work together live',
        title: 'Comments on anything',
        description:
          "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
      },
      {
        art: <AssignedActionsArt />,
        href: '/help/collaboration/assigned-actions/',
        group: 'Work together live',
        title: 'Assign actions to teammates',
        description:
          'Turn anything on a page into a piece of work: name the action, describe it, and hand it to a teammate from any of your teams, with an optional email nudge. An Actions panel tracks everything still open, with your own assignments on top.',
      },
      {
        art: <TimelineFeedArt />,
        href: '/help/explorer/timeline/',
        group: 'Work together live',
        title: 'See what happened while you were away',
        description:
          'The Explorer opens on Home: the documents you return to most, and what your teammates commented, edited and assigned you while you were away. The Timeline holds the full feed, and the Inbox gathers the actions and threads still waiting on you.',
      },
      {
        art: <UndoRedoArt />,
        href: '/help/canvas/undo/',
        group: 'Work together live',
        title: 'Undo and redo',
        description:
          "Back out a recent edit with Cmd-Z, or bring it back with Cmd-Shift-Z. A whole drag is one step, and your undo rewinds your own edits, not a teammate's.",
      },
      {
        art: <ShareLinksArt />,
        href: '/help/collaboration/sharing/',
        group: 'Share & access',
        title: 'Editor or view-only links',
        description:
          'Create an editor link for collaborators, or a view-only link for readers who should look, not touch. Run as many links as you like, side by side, and point one at a single tab to keep the rest of the document private.',
      },
      {
        art: <LiveImageArt />,
        href: '/help/collaboration/sharing/live-image/',
        group: 'Share & access',
        title: 'Live in your wiki, docs or README',
        description:
          'Copy an iframe from the Share dialog and the document sits inside your wiki, Notion or site, live as people edit it. Where iframes are blocked, like a GitHub README, paste a live image instead: a plain picture URL that shows the latest version after every save.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of documents they can all open and edit. Admins manage membership and roles; members just get to work.',
      },
      {
        art: <ExpiryArt />,
        href: '/help/collaboration/sharing/share-link-expiry/',
        group: 'Share & access',
        title: 'Links that expire on their own',
        description:
          'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, and you can extend it for another run or delete it for good.',
      },
      {
        art: <RevokeArt />,
        href: '/help/privacy-and-security/share-link-security/',
        group: 'Share & access',
        title: 'Stop sharing on demand',
        description:
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The document is yours again.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'AI & your tools',
        title: 'Make documents with AI',
        description:
          'Connect Claude or any MCP client and let it find, read, create, edit and share your documents for you. Ask for a brief and it writes an article from Markdown; ask for a deck and it adds the slides. It runs on a revocable token, read-only if you prefer.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/cli/',
        group: 'AI & your tools',
        title: 'A command line and an API',
        description:
          'Install the livedocuments command-line tool from npm to read, edit, share and export documents from your terminal, or call the same REST API the editor uses with an API token. Signed in, revocable, no lock-in.',
      },
      {
        art: <SearchPaletteArt />,
        href: '/help/search-panel/the-search-panel/command-palette/',
        group: 'AI & your tools',
        title: 'Find or run anything with ⌘K',
        description:
          'One box finds your documents, tabs and pages, and runs commands by name. It jumps to a setting, and opens the help article for whatever you just searched.',
      },
    ],
  },
];

export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((section) => section.id);

/** Look up a single section by id (the `/features/<id>` page's source). */
export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((section) => section.id === id);
}

type FeatureGroup = { title: string; items: FeatureProps[] };

/**
 * Split a section's features into ordered, captioned sub-groups for the
 * detail page. Groups appear in first-seen order; items keep their order
 * within a group. Returns `null` when the section has no `group` tags at all,
 * so the caller renders one flat grid (only the larger categories opt in to
 * grouping; see the `group` field on `FeatureProps`).
 */
export function groupSectionFeatures(section: LandingSection): FeatureGroup[] | null {
  if (!section.items.some((item) => item.group)) return null;
  const order: string[] = [];
  const byGroup = new Map<string, FeatureProps[]>();
  for (const item of section.items) {
    const key = item.group ?? 'More';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(item);
  }
  return order.map((title) => ({ title, items: byGroup.get(title)! }));
}

/** The features a section's beat lists, in order. Throws on a title no item has (a test pins them). */
export function sectionHighlights(section: LandingSection): FeatureProps[] {
  return section.highlights.map((title) => {
    const item = section.items.find((i) => i.title === title);
    if (!item) throw new Error(`Section "${section.id}" highlights unknown feature "${title}"`);
    return item;
  });
}
