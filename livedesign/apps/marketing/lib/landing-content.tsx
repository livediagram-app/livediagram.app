import type { HeroSceneKey } from '@/components/hero-scene-data';
import {
  ApiArt,
  AssignedActionsArt,
  CommentsArt,
  ContentsSidebarArt,
  CustomThemesArt,
  ExpiryArt,
  FollowAlongArt,
  FontsArt,
  FullScreenSlideArt,
  LaserArt,
  LiveImageArt,
  LogoLayoutsArt,
  LogoPageArt,
  McpArt,
  PagesArt,
  PagesBackgroundsArt,
  PagesExportArt,
  PresenceArt,
  PresentLocallyArt,
  PresenterNotesArt,
  RealtimeArt,
  RevokeArt,
  SearchPaletteArt,
  SelectionGlowArt,
  ShareLinksArt,
  SlideTimingArt,
  SpotlightArt,
  TabWindowArt,
  TeamsArt,
  ThemesArt,
  TimelineFeedArt,
  UndoRedoArt,
  WireframePagesArt,
  ZenModeArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@/components/Section';

/**
 * A feature category: one kind of page livedesign makes, or the way people make them together, each
 * a story beat on the landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Slide decks"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, and kept short and verb-led, e.g. "Explore slide decks".
   */
  cta: string;
  /** The scene that plays beside the beat and on the category page (components/hero-scene-data.ts). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: presenting the pages as a deck,
 * the kinds of page a design is made of (logos and wireframes), then working on them together. `page.tsx` renders one beat per entry and alternates its background by index;
 * `/features/<id>` renders each one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'slides',
    label: 'Slide decks',
    scene: 'slides',
    cta: 'Explore slide decks',
    title: 'Build the deck, then present it',
    description:
      'Every page you design joins the deck, then present it full screen on your screen alone, your notes behind a button, with a laser and a spotlight to point the room at what you mean.',
    metaDescription:
      'Slide decks from your pages, presented full screen with private notes, a timer, a laser pointer and a spotlight.',
    highlights: [
      'One deck across every tab',
      'Notes only you open',
      'Laser pointer for presenting',
      'Your screen, not everyone else’s',
    ],
    items: [
      {
        art: <FullScreenSlideArt />,
        href: '/help/selection-modes/slide-deck/building-a-deck/',
        group: 'Build',
        title: 'One deck across every tab',
        description:
          'Any page can be a slide: a logo, a wireframe, a blank page. Order them in the Slide Deck panel: drag to rearrange, rename, duplicate, or hide a slide you might want next week without deleting it. The deck is saved with the design, so a teammate opens it and sees the same talk.',
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
          'Presenting shows the deck on your screen and nowhere else. Nobody is dragged into your slide, nobody’s view moves, and collaborators with the design open carry on working. You share your screen the way you already do. Nothing on a slide can be changed by a stray click, so a projector is safe. To leave a deck running on a screen, set it to advance every 5 to 60 seconds and loop back to the start.',
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
    id: 'logos',
    label: 'Logos & wireframes',
    scene: 'logo',
    cta: 'Explore logos and wireframes',
    title: 'Design a logo, sketch the screens',
    description:
      'A logo page is a square artboard with construction guides: start from a layout, draw with Mirror for a symmetrical mark, then download every size you need. Wireframe pages put a phone, a tablet or a browser round the screens you are planning.',
    metaDescription:
      'Design a logo on an artboard with guides and Mirror, download a logo kit, and sketch app and website screens on wireframe pages.',
    highlights: [
      'Design a logo',
      'Start from a logo layout',
      'Wireframe the screens',
      'Your brand as a theme',
    ],
    items: [
      {
        art: <LogoPageArt />,
        href: '/help/pages/logo-pages/',
        group: 'Logos',
        title: 'Design a logo',
        description:
          'A logo page is a square artboard with construction guides to build on. Draw with Mirror and one side mirrors the other, or round the centre; combine shapes into one, and set the name in wordmark type. Then export a Logo Kit: an SVG, PNGs from 16 to 1024 pixels and a favicon, in one .zip.',
      },
      {
        art: <LogoLayoutsArt />,
        href: '/help/pages/logo-pages/',
        group: 'Logos',
        title: 'Start from a logo layout',
        description:
          'Start from one of twenty-five logo layouts in four kinds, from emblems and monograms to lockups and wordmarks, each painted from your theme. Pick one, then make it yours, or start from a blank board.',
      },
      {
        art: <WireframePagesArt />,
        href: '/help/pages/wireframe-pages/',
        group: 'Wireframes',
        title: 'Wireframe the screens',
        description:
          'A wireframe page draws a phone, a tablet, a browser, a laptop or a watch round the screen you are planning. Start from a ready-made screen, a sign-in, a feed or a checkout, and lay out the flow page by page.',
      },
      {
        art: <PagesArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'A page for each logo and screen',
        description:
          'A square artboard for a logo; a phone, tablet, laptop, browser or watch for a screen. Each page is its own size, and everything on it moves with it.',
      },
      {
        art: <ContentsSidebarArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'Every page in the Contents',
        description:
          'A Contents sidebar lists every page with a picture of it, its number and its name, and highlights the one you are reading. Press a row to glide there, or type to find a page by its name or any words on it.',
      },
      {
        art: <PagesBackgroundsArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'Backgrounds from your theme',
        description:
          'Paint a page in a tint of your theme, a solid colour or a gradient, with dots, a grid or ruled lines over it. Text keeps reading on a dark page, because the ink follows the page.',
      },
      {
        art: <TabWindowArt />,
        href: '/help/pages/tab-windows/',
        group: 'Pages',
        title: 'A live window onto another tab',
        description:
          'Put a window onto another tab on a page. The window follows every change you or a collaborator make there, so there is never a stale copy to paste again. Open jumps straight to the tab.',
      },
      {
        art: <PagesExportArt />,
        href: '/help/pages/exporting-pages/',
        group: 'Pages',
        title: 'Every page, print-ready',
        description:
          'Export every page as one PDF at true print size, or one page as a PNG or SVG. Add pages to a slide deck and present them full screen, one page at a time.',
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
        art: <CustomThemesArt />,
        href: '/help/canvas/themes/custom-themes/',
        group: 'Make it yours',
        title: 'Your brand as a theme',
        description:
          'Build a custom theme from your brand palette, save it to your account, and reuse it across designs just like a built-in one. Edit it any time.',
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
      'Make designs with AI',
    ],
    items: [
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Live presence',
        description:
          'See who is in the design from the participant avatars on each tab. Status rings show online, away, or stale.',
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
          'The Explorer opens on Home: the designs you return to most, and what your teammates commented, edited and assigned you while you were away. The Timeline holds the full feed, and the Inbox gathers the actions and threads still waiting on you.',
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
          'Create an editor link for collaborators, or a view-only link for readers who should look, not touch. Run as many links as you like, side by side, and point one at a single tab to keep the rest of the design private.',
      },
      {
        art: <LiveImageArt />,
        href: '/help/collaboration/sharing/live-image/',
        group: 'Share & access',
        title: 'Live in your wiki, docs or README',
        description:
          'Copy an iframe from the Share dialog and the design sits inside your wiki, Notion or site, live as people edit it. Where iframes are blocked, like a GitHub README, paste a live image instead: a plain picture URL that shows the latest version after every save.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of designs they can all open and edit. Admins manage membership and roles; members just get to work.',
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
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The design is yours again.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'AI & your tools',
        title: 'Make designs with AI',
        description:
          'Connect Claude or any MCP client and let it find, read, create, edit and share your designs for you. It runs on a revocable token, read-only if you prefer.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/cli/',
        group: 'AI & your tools',
        title: 'A command line and an API',
        description:
          'Install the livedesign command-line tool from npm to read, edit, share and export designs from your terminal, or call the same REST API the editor uses with an API token. Signed in, revocable, no lock-in.',
      },
      {
        art: <SearchPaletteArt />,
        href: '/help/search-panel/the-search-panel/command-palette/',
        group: 'AI & your tools',
        title: 'Find or run anything with ⌘K',
        description:
          'One box finds your designs, tabs and pages, and runs commands by name. It jumps to a setting, and opens the help article for whatever you just searched.',
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
