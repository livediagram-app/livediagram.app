import type { HeroSceneKey } from '@/components/hero-scene-data';
import {
  ApiArt,
  ApprovalArt,
  AssignedActionsArt,
  AutomationsArt,
  CommentsArt,
  ComponentsArt,
  ContentsSidebarArt,
  ExpiryArt,
  FollowAlongArt,
  FontsArt,
  InspectArt,
  PrototypeArt,
  LaserArt,
  LibraryArt,
  LiveEmbedArt,
  LiveImageArt,
  LogoLayoutsArt,
  LogoPageArt,
  MakeSizesArt,
  McpArt,
  PagesArt,
  PagesBackgroundsArt,
  PagesExportArt,
  PhotoAdjustArt,
  PhotoLayersArt,
  PhotoPsdArt,
  PhotoRetouchArt,
  PictureMaskArt,
  PresenceArt,
  RealtimeArt,
  RevokeArt,
  SearchPaletteArt,
  SelectionGlowArt,
  ShareLinksArt,
  SnapshotsArt,
  SpotlightArt,
  TeamsArt,
  ThemesArt,
  UndoRedoArt,
  WalkthroughArt,
  WireframePagesArt,
  ZenModeArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@liveworkspace/marketing-site/components/Section';

/**
 * A feature category: one kind of page livedesign makes, or the way people make them together, each
 * a story beat on the landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Photo editing"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, and kept short and verb-led, e.g. "Explore photo editing".
   */
  cta: string;
  /** The scene that plays beside the beat and on the category page (components/hero-scene-data.ts). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: the kinds of page a design is made
 * of (logos and wireframes, then photos), then working on them together. `page.tsx`
 * renders one beat per entry and alternates its background by index; `/features/<id>` renders each
 * one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'logos',
    label: 'Logos & wireframes',
    scene: 'logo',
    cta: 'Explore logos and wireframes',
    title: 'Design a logo, sketch the screens',
    description:
      'A logo page is a square artboard with construction guides: start from a layout, draw with Mirror for a symmetrical mark, then download every size you need. Wireframe pages put a phone, a tablet or a browser round the screens you are planning, link them into a prototype to click through, and Inspect hands their sizes, spacing and colours to whoever builds them.',
    metaDescription:
      'Design a logo with guides and Mirror, download a Logo Kit, wireframe app and website screens, click through them as a prototype and inspect them for handoff.',
    highlights: [
      'Design a logo',
      'Wireframe the screens',
      'Click through the screens',
      'Hand the screens to developers',
    ],
    items: [
      {
        art: <LogoPageArt />,
        href: '/help/pages/logo-pages/',
        group: 'Logos',
        title: 'Design a logo',
        description:
          'A logo page is a square artboard with construction guides to build on. Draw with Mirror and one side mirrors the other, or round the centre; combine shapes into one and refine its points an outline at a time, fill a hand-drawn loop with the paint bucket, and set the name in one of ninety display faces. Bring an SVG in and it lands as shapes you can edit. Then export a Logo Kit: an SVG with its text outlined, PNGs from 16 to 1024 pixels and a favicon, in one .zip.',
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
          'A wireframe page draws a phone, a tablet, a browser, a laptop or a watch round the screen you are planning. Start from a ready-made flow, a sign-in, a feed or a checkout, already linked screen to screen, and Clear Example Content empties its sample words but keeps the layout.',
      },
      {
        art: <ComponentsArt />,
        group: 'Wireframes',
        title: 'Build once with components',
        description:
          'Select a nav bar or a tab bar and Make Component. Place it on every screen of every tab, change the main and each instance redraws, for everyone, live. Override an instance’s text or colours, or Detach it to go your own way.',
      },
      {
        art: <InspectArt />,
        href: '/help/pages/wireframe-pages/inspect/',
        group: 'Wireframes',
        title: 'Hand the screens to developers',
        description:
          'Turn on Inspect and click anything on a wireframe: its size, position, spacing to its neighbours, colours, border and type, in points. Copy it as CSS, export it at 1x, 2x or 3x, and send a link that opens with Inspect on. Viewers get all of it, and nothing can change.',
      },
      {
        art: <PrototypeArt />,
        href: '/help/pages/wireframe-pages/prototypes/',
        group: 'Wireframes',
        title: 'Click through the screens',
        description:
          'Drag an element’s link handle onto another screen, or link it Back, with an Instant, Slide or Dissolve change. Press Prototype to click through in the device frame, or full screen on a phone, and send it with Copy Prototype Link. The Flow view draws every link as an arrow.',
      },
      {
        art: <PagesArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'A page for each logo and screen',
        description:
          'A square artboard for a logo; a phone, tablet, laptop, browser or watch for a screen; a photo the size of its picture. Each page is its own size, and everything on it moves with it.',
      },
      {
        art: <PictureMaskArt />,
        group: 'Pages',
        title: 'Crop and mask your pictures',
        description:
          'Crop a picture in place, cut it to a circle, an arch, a star or one of five more masks, and turn it greyscale. Put a picture behind a page and blur it so the words on top stand out. SVG, PNG and PDF exports keep every cut.',
      },
      {
        art: <ContentsSidebarArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'Every page in the Contents',
        description:
          'A Contents sidebar lists every page with a picture of it, its number and its name, and highlights the one you are on. Press a row to glide there, or type to find a page by its name or any words on it.',
      },
      {
        art: <PagesBackgroundsArt />,
        href: '/help/pages/working-with-pages/',
        group: 'Pages',
        title: 'Backgrounds from your theme',
        description:
          'Paint a page in a tint of your theme, a solid colour or a gradient, with dots, a grid or ruled lines over it. Text keeps reading on a dark page, because the ink follows the page, and the text colour picker warns when words would be too faint to read.',
      },
      {
        art: <PagesExportArt />,
        href: '/help/pages/exporting-pages/',
        group: 'Pages',
        title: 'Every page, print-ready',
        description:
          'Export every page as one vector PDF at true print size, its text real words you can select and search, or one page as a PNG or SVG, and keep any tab as a livedesign JSON file.',
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
    id: 'photos',
    label: 'Photo editing',
    scene: 'photo',
    cta: 'Explore photo editing',
    title: 'Edit the photos in layers',
    description:
      'A photo page is a picture to edit in layers, with masks, blend modes, adjustments and filters, the tools to select, paint and retouch, PSD files in and out, and every social size made from one photo.',
    metaDescription:
      'Edit photos in layers with masks, blend modes, adjustments, 44 filters and retouching, make every social size, then export PNG, JPEG, WebP or PSD.',
    highlights: [
      'Edit a photo in layers',
      'Adjustments and filters',
      'Select, paint and retouch',
      'Open and save PSD files',
    ],
    items: [
      {
        art: <PhotoLayersArt />,
        href: '/help/pages/photo-pages/',
        group: 'Layers',
        title: 'Edit a photo in layers',
        description:
          'Open a picture on a photo page, or start a blank one, and build it up in layers: pixel, text and adjustment layers, each with its own mask, opacity and one of twenty-seven blend modes. Group them, clip one to the layer below, lock or hide any of them.',
      },
      {
        art: <PhotoAdjustArt />,
        href: '/help/pages/photo-pages/',
        group: 'Layers',
        title: 'Adjustments and filters',
        description:
          'Sixteen adjustments, from Levels and Curves to Hue/Saturation and Black & White, sit on their own layers so you can change them later. Forty-four filters, from Gaussian Blur and Unsharp Mask to Oil Paint and Lens Flare, preview live before you apply them.',
      },
      {
        art: <PhotoRetouchArt />,
        href: '/help/pages/photo-pages/',
        group: 'Tools',
        title: 'Select, paint and retouch',
        description:
          'Select with a marquee, a lasso, the Magic Wand or Quick Select, or let Subject find the main thing in the picture and Remove Background cut it out. Paint with brushes and gradients, and heal, clone, dodge and burn away what should not be there.',
      },
      {
        art: <PhotoPsdArt />,
        href: '/help/pages/photo-pages/',
        group: 'Tools',
        title: 'Open and save PSD files',
        description:
          'Drop a PSD onto a photo page and its layers come in with their names, opacity, blend modes and masks. Export the photo as a PNG, a JPEG, a WebP, or a PSD with its layers kept.',
      },
      {
        art: <MakeSizesArt />,
        href: '/help/pages/photo-pages/make-sizes/',
        group: 'Tools',
        title: 'Every social size from one photo',
        description:
          'Make Sizes turns the photo you are on into a page for each format you tick, from an Instagram Story to a YouTube Thumbnail, every layer kept and the picture filling the frame. Export All Sizes downloads them in one .zip.',
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
      'Share a link and your team is on the pages with you: live cursors, comments and walkthroughs. Take a snapshot before a big change, ask for approval when it is done, keep your best parts in a Library, or hand the work to your AI.',
    metaDescription:
      'Work on designs together: live cursors, comments, recorded walkthroughs, snapshots, approvals, a shared Library, expiring links and an MCP server for AI.',
    highlights: [
      'Live presence',
      'Comments on anything',
      'Record a walkthrough',
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
          "Right-click an element, leave a thread. Reply, react with an emoji, resolve or delete. Comments carry the author's name and colour so it's clear who said what.",
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
        art: <UndoRedoArt />,
        href: '/help/canvas/undo/',
        group: 'Work together live',
        title: 'Undo and redo',
        description:
          "Back out a recent edit with Cmd-Z, or bring it back with Cmd-Shift-Z. A whole drag is one step, and your undo rewinds your own edits, not a teammate's.",
      },
      {
        art: <SnapshotsArt />,
        href: '/help/collaboration/snapshots/',
        group: 'Work together live',
        title: 'Snapshots and History',
        description:
          'Open History in Tools to see who changed what. Take a named snapshot before a big change, and revert the whole design to it in one step if the change goes wrong. The latest five are kept, pinned on the timeline.',
      },
      {
        art: <AutomationsArt />,
        href: '/help/tools/automations/',
        group: 'Work together live',
        title: 'Automations for the handoff',
        description:
          'Give a design rules of its own: post feedback and library changes to Slack or Microsoft Teams, email you once every thread is resolved, or take a snapshot every Friday. Rules run on our servers, even with nobody in the design.',
      },
      {
        art: <WalkthroughArt />,
        href: '/help/collaboration/walkthroughs/',
        group: 'Point and focus',
        title: 'Record a walkthrough',
        description:
          'Talk someone through the design without a meeting. Record your voice, and your camera if you like, as you move round the pages, hiding anything private first. They play it over the design itself, and can pause, look around and resume.',
      },
      {
        art: <LaserArt />,
        href: '/help/selection-modes/laser/',
        group: 'Point and focus',
        title: 'Point with the laser',
        description:
          'Switch to the laser and your cursor leaves a glowing trail everyone in the design can see. Point at the thing you mean while you talk it through, on a call or a shared screen. Trails fade on their own.',
      },
      {
        art: <SpotlightArt />,
        href: '/help/selection-modes/spotlight/',
        group: 'Point and focus',
        title: 'Spotlight one thing at a time',
        description:
          'Switch on Spotlight and the page dims under a soft shroud, with only a circle of light around your cursor. Walk people through a busy screen one piece at a time while you share it. Left-click grows the light, right-click shrinks it, and it is a local view aid, so it never gets in a viewer’s way.',
      },
      {
        art: <ZenModeArt />,
        href: '/help/tools/zen-mode/',
        group: 'Point and focus',
        title: 'Zen mode for focus',
        description:
          'Press Z and every toolbar, panel and tab bar drops away, leaving just your pages. Only the zoom controls stay, with an exit button right beside them. Press Z or Esc to bring it all back.',
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
          'Paste a share link into Notion, Medium or Ghost and it unfolds into a live, read-only view, or copy an iframe from the Share dialog for your own site. Where iframes are blocked, like a GitHub README, paste a live image: a picture URL that shows the latest version after every save.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with shared designs',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of designs they can all open and edit. Admins manage membership and roles; members just get to work.',
      },
      {
        art: <LibraryArt />,
        group: 'Share & access',
        title: 'A Library for your best parts',
        description:
          'Select a mark, a lock-up or a screen part and Save to Library. It waits in the palette of every design, in your Personal library or your team’s, sorted into folders, ready to place with a click or a drag. livediagram and livedocuments share the same Library.',
      },
      {
        art: <ApprovalArt />,
        href: '/help/collaboration/sharing/request-approval/',
        group: 'Share & access',
        title: 'Ask for approval',
        description:
          'Name the people who should sign a design off, with a note and a due day. Each answers Approve or Request Changes from a banner, and a badge says where it stands, down to Changed Since Approval.',
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
          'Connect Claude or any MCP client and let it find, read, create, edit and share your designs for you. In Claude, each design it makes or reads opens as a live view beside the answer, to flip through page by page. It runs on a revocable token, read-only if you prefer.',
      },
      {
        art: <LiveEmbedArt />,
        group: 'AI & your tools',
        title: 'Live files from your other apps',
        description:
          'Add a Live Embed and a diagram, a plan or a document from another liveworkspace app sits on your page, live and read-only, each viewer seeing it with their own access. Link a chart to a liveplanner sheet and it redraws as the sheet changes.',
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
