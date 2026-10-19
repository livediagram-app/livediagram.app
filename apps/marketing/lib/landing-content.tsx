import type { HeroSceneKey } from '@/components/hero-scenes';
import {
  AiAssistArt,
  AlignmentGuidesArt,
  AnimatedIconsArt,
  AnimatedShapesArt,
  ApiArt,
  ArrowsArt,
  ArticleFlowArt,
  ArticleLooksArt,
  ArticlePagesArt,
  ArticleWrapArt,
  AssignedActionsArt,
  AvatarModeArt,
  BoardCsvArt,
  BoardImportArt,
  BoardWidgetsArt,
  BorderStyleArt,
  BringFocusArt,
  CanvasBackdropArt,
  CanvasChartsArt,
  CardCommentsArt,
  CardDetailArt,
  CardTypesArt,
  CellCommentsArt,
  CodeBlockArt,
  CommentsArt,
  ComponentsArt,
  ConditionalFormatArt,
  ContentsSidebarArt,
  CustomThemesArt,
  DashboardArt,
  DragDuplicateArt,
  DrawDockArt,
  EmbedArt,
  EntityArt,
  ErasersArt,
  EventStormingArt,
  ExpiryArt,
  ExportArt,
  WorkshopModeArt,
  FacilitatorArt,
  FindCardArt,
  FlowingArrowsArt,
  FollowAlongArt,
  FontsArt,
  FormAlertsArt,
  FormBuilderArt,
  FormResponsesArt,
  FormSectionsArt,
  FormShareArt,
  FormatPainterArt,
  FullScreenSlideArt,
  HiddenVotesArt,
  IconsArt,
  PagesBackgroundsArt,
  PagesExportArt,
  IntoPagesArt,
  PagesArt,
  ImagesArt,
  InfographicLayoutArt,
  IsometricArt,
  LanesArt,
  LaserArt,
  LayersArt,
  LinkCardArt,
  LiveImageArt,
  LivingBackgroundArt,
  LockArt,
  LogoPageArt,
  MarginCommentsArt,
  MarkdownImportArt,
  MarkersArt,
  MarqueeArt,
  McpArt,
  MermaidArt,
  MindMapArt,
  NotesArt,
  PagesGifArt,
  PalmRejectionArt,
  PathToolArt,
  PencilArt,
  PlanBoardArt,
  PlanViewsArt,
  PresenceArt,
  PresentLocallyArt,
  PresenterNotesArt,
  PressureArt,
  RealtimeArt,
  RevokeArt,
  RichTextArt,
  RotateArt,
  SearchPaletteArt,
  SelectionGlowArt,
  SequenceArt,
  SessionToolsArt,
  ShapesArt,
  ShareLinksArt,
  SharedItemsArt,
  SheetTogetherArt,
  SheetValidationArt,
  SheetsArt,
  ShortcutsArt,
  SideBySideArt,
  SlideDeckArt,
  SlideLayoutsArt,
  SlideTimingArt,
  SpotlightArt,
  StickyPhotoArt,
  TabCopyArt,
  TabFoldersArt,
  TabWindowArt,
  TablesArt,
  TabsArt,
  TeamsArt,
  TechIconsArt,
  TemplatesArt,
  ThemesArt,
  TidyPageArt,
  TimelineFeedArt,
  UndoRedoArt,
  UnlimitedTabsArt,
  ZenModeArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@/components/Section';

/**
 * A feature category: one of the app's core features, each a story beat on the
 * landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Whiteboard"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, which read awkwardly ("Explore work on it
   * together, live"). Keep it short and verb-led, e.g. "Explore the whiteboard".
   */
  cta: string;
  /** The hero scene that plays beside the beat and on the category page (components/hero-scenes.tsx). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: collaborate,
 * then each way of working on a tab (Diagram, Draw, Pages mode's infographics, its
 * slide decks and its documents, Plan's boards, then its sheets and forms). `page.tsx` renders one beat per entry and
 * alternates its background by index; `/features/<id>` renders each one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'collaboration',
    label: 'Collaborate',
    scene: 'townhall',
    cta: 'Explore collaboration',
    title: 'Work on it together, live',
    description:
      'Share a link and your team is on the canvas with you: live cursors, comments on any element, actions handed to teammates, and Workshop, a mode for running a workshop, with timers, votes and a spotlight on the thing you mean.',
    metaDescription:
      'Share a link and your team is on the canvas with you: live cursors, comments, assigned actions and workshop tools, from timers and votes to polls.',
    highlights: [
      'Live presence',
      'Comments on any element',
      'Run the session: timer + voting',
      'Assign actions to teammates',
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
        art: <CommentsArt />,
        href: '/help/collaboration/comments/',
        group: 'Work together live',
        title: 'Comments on any element',
        description:
          "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
      },
      {
        art: <CommentsArt />,
        href: '/help/palette/collaborate/',
        group: 'Work together live',
        title: 'Comment panels on the canvas',
        description:
          'For a remark that belongs somewhere rather than to someone, drop a comment panel and join it to an element with an arrow. It is the same thread a comment badge opens, except it stays put: on the canvas, in the export, and in everyone else\u2019s session.',
      },
      {
        art: <AssignedActionsArt />,
        href: '/help/collaboration/assigned-actions/',
        group: 'Work together live',
        title: 'Assign actions to teammates',
        description:
          'Turn any element into a piece of work: name the action, describe it, and hand it to a teammate from any of your teams, with an optional email nudge. An Actions panel tracks everything still open, with your own assignments on top.',
      },
      {
        art: <TimelineFeedArt />,
        href: '/help/explorer/timeline/',
        group: 'Work together live',
        title: 'See what happened while you were away',
        description:
          'The Explorer opens on Home: the documents you return to most, and what your teammates commented, edited and assigned you while you were away. The Timeline holds the full feed, and the Inbox gathers the actions and threads still waiting on you, with a count in the sidebar so you can tell without looking.',
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
        art: <SessionToolsArt />,
        href: '/help/collaboration/session-tools/',
        group: 'Present & workshop',
        title: 'Run the session: timer + voting',
        description:
          'Run the room from the canvas. In Workshop, Timer, Vote and Poll sit in the Session strip at the foot of the canvas: start a countdown or stopwatch the whole room sees, its time on the button, or drop a timer onto the canvas as a session button so a template carries its own running order. Then open dot-voting to surface the group’s priorities. Everyone votes with a budget of dots; results tally in real time, and revealing them starts a guided walkthrough: each top pick lights up and centres on screen while you step through with Next and Previous. Perfect for retros, workshops, and timeboxed planning.',
      },
      {
        art: <WorkshopModeArt />,
        href: '/help/canvas/workshop-mode/',
        group: 'Present & workshop',
        title: 'A mode for running the room',
        description:
          'Switch a tab to Workshop and it brings the session to hand: stickies, timers, votes, polls, reveals, quizzes and the Q&A board on its palette, and the Session strip at the foot of the canvas. Retrospectives, Lean Coffee and town halls open there, and Diagram stays about diagrams.',
      },
      {
        art: <FacilitatorArt />,
        href: '/help/collaboration/facilitator/',
        group: 'Present & workshop',
        title: 'One person runs the room',
        description:
          'Hand someone the facilitator baton and the tools that run the session answer to them alone: the timer, the votes, the polls, the reveals. No two people starting timers over each other. Nobody holds it by default, anybody can be given it, and the owner can always take it back.',
      },
      {
        art: <SessionToolsArt />,
        href: '/help/palette/behaviour/',
        group: 'Present & workshop',
        title: 'Ask the room if they are done',
        description:
          'Drop a Done check and everyone marks themselves finished. The card shows who has and who it is still waiting on, built from whoever is actually in the room, and flashes when the last person marks. Reset it for the next round from its own menu.',
      },
      {
        art: <BringFocusArt />,
        href: '/help/palette/behaviour/bring-focus/',
        group: 'Present & workshop',
        title: 'Ask the room to look here',
        description:
          'Drop a Bring Focus element, press it, and everyone else is offered a jump to it: your tab, the thing you mean, centred on their screen. It asks rather than drags, so nobody loses the place they were working in.',
      },
      {
        art: <FacilitatorArt />,
        href: '/help/palette/collaborate/agendas/',
        group: 'Present & workshop',
        title: 'Keep the record of the meeting',
        description:
          'An agenda holds the run of the session, and pressing a segment starts the timer for it. A roll call freezes who was in the room, a picker chooses someone at random so nobody has to volunteer, and a decision record keeps what was decided, why and when, beside the thing it decided.',
      },
      {
        art: <SpotlightArt />,
        href: '/help/selection-modes/spotlight/',
        group: 'Present & workshop',
        title: 'Spotlight the room on one thing',
        description:
          'Switch on Spotlight and the canvas dims under a soft shroud, with only a circle of light around your cursor. Walk the room through a busy canvas one piece at a time. Left-click grows the light, right-click shrinks it, and it is a local view aid, so it never gets in a viewer’s way.',
      },
      {
        art: <LaserArt />,
        href: '/help/selection-modes/laser/',
        group: 'Present & workshop',
        title: 'Laser pointer for presenting',
        description:
          'Switch to the laser tool and your cursor leaves a glowing trail everyone can see. Point at the thing you mean while you talk it through. Trails fade on their own.',
      },
      {
        art: <FollowAlongArt />,
        href: '/help/canvas/follow-along/',
        group: 'Present & workshop',
        title: 'Follow someone\u2019s view',
        description:
          'Press Follow beside a teammate and your canvas goes where theirs goes: their tab, their pan, their exact zoom. A pill says who you are following, and the moment you move the canvas yourself, you have your own view back. Anyone can follow anyone, even on a view-only link.',
      },
      {
        art: <AvatarModeArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Present & workshop',
        title: 'Walk a character across your canvas',
        description:
          'Avatar mode drops a little pixel character onto the canvas. Click to walk it to whatever you are talking about, steer with the arrow keys, and press Space to hop and wave a flag. Dress it how you like (gender, clothing, hair and size, remembered in your browser), and the box it stands on gets a ring. The canvas is read-only while you walk, and on a shared document everyone sees everyone else walking about in their own colour.',
      },
      {
        art: <AvatarModeArt />,
        href: '/help/palette/behaviour/',
        group: 'Present & workshop',
        title: 'Celebrate on the canvas',
        description:
          'Reaction pads throw confetti, sparkles, hearts, applause or fireworks over the canvas for everyone in the room. Press one, or walk an Avatar-mode character onto it. Nothing is saved: a reaction is a moment, not a mark on the canvas. For a mark that stays, drop one of around 190 emoji stickers or 32 word badges like APPROVED and BLOCKED.',
      },
      {
        art: <ShareLinksArt />,
        href: '/help/collaboration/sharing/',
        group: 'Share & access',
        title: 'Editor, participant or view-only links',
        description:
          'Create an editor link for collaborators, a participant link for a team who should add stickies, write and vote without reshaping the board, or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side, and point one at a single tab to keep the rest of the document private.',
      },
      {
        art: <LiveImageArt />,
        href: '/help/collaboration/sharing/live-image/',
        group: 'Share & access',
        title: 'Live in your wiki, docs or README',
        description:
          'Copy an iframe from the Share dialog and the document sits inside your wiki, Notion or site, live as people edit it. Where iframes are blocked, like a GitHub README, paste a live image instead: a plain picture URL that shows the latest version after every save, of whichever tab you pick.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of documents they can all open and edit. Admins manage membership and roles; members just get to work. Sign in to set one up, the canvas itself never needs an account.',
      },
      {
        art: <ExpiryArt />,
        href: '/help/collaboration/sharing/share-link-expiry/',
        group: 'Share & access',
        title: 'Links that expire on their own',
        description:
          'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, no cleanup to remember, and you can extend it for another run or delete it for good.',
      },
      {
        art: <RevokeArt />,
        href: '/help/privacy-and-security/share-link-security/',
        group: 'Share & access',
        title: 'Stop sharing on demand',
        description:
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The document is yours again.',
      },
    ],
  },
  {
    id: 'diagrams',
    label: 'Diagrams',
    scene: 'diagram',
    cta: 'Explore diagrams',
    title: 'Diagrams that look designed, not dragged',
    description:
      'Shapes that snap into line, arrows that follow them, and icons, tables and components when boxes are not enough. Start from a template, recolour it with a theme, or describe it to your AI and let it build the diagram for you.',
    metaDescription:
      'Shapes that snap into line, arrows that follow them, templates and one-click themes, and an AI that can build the diagram from a description.',
    highlights: [
      'Arrows that bend your way',
      'Guides that line things up',
      'Mind maps from the keyboard',
      'Build diagrams with AI',
    ],
    items: [
      {
        art: <ShapesArt />,
        href: '/help/palette/shapes/',
        group: 'Shapes & connectors',
        title: 'A shape for everything',
        description:
          'Fourteen core shapes (flowchart blocks plus an actor, cloud, triangle, star, and speech bubble), a section frame that carries whatever you draw inside it, and seven device frames (browser, monitor, laptop, phone, tablet, foldable, smartwatch). Click to drop one, or drag to draw it at the exact size you want, snapped to line up with its neighbours. A flowchart one minute, a screen the next. Import a draw.io library and its shapes join the palette as a shape library of your own, under My shapes.',
      },
      {
        art: <ArrowsArt />,
        href: '/help/palette/arrows/',
        group: 'Shapes & connectors',
        title: 'Arrows that bend your way',
        description:
          'Connect anything with straight, curved, or angled arrows. Drag the handle on a curve to reshape its bow, or on an elbow to move the bend. Set the thickness, choose the arrowhead shape, filled or hollow triangle, line, circle, or diamond, for UML-style connectors and size it, add a label, and pin an end to a shape so it follows when things move. When several arrows meet at the same point, the heads fan out side by side instead of piling up.',
      },
      {
        art: <BorderStyleArt />,
        href: '/help/palette/shapes/',
        group: 'Shapes & connectors',
        title: 'Style every border',
        description:
          'Set border strength, switch between solid, dashed, and dotted, and round the corners as much or as little as the shape calls for.',
      },
      {
        art: <RichTextArt />,
        href: '/help/canvas/text-and-fonts/',
        group: 'Shapes & connectors',
        title: 'Rich text in any label',
        description:
          'Style text right where you type it: bold, italic, underline, and strikethrough, with per-word colours and sizes and bullet or numbered lists. Select a run and a floating toolbar formats just that part, so a label reads exactly how you mean it.',
      },
      {
        art: <NotesArt />,
        href: '/help/canvas/annotations/',
        group: 'Shapes & connectors',
        title: 'Notes on any element',
        description:
          'Pin a note to any shape for the context that should not clutter the canvas. It travels with the element and opens when you need it.',
      },
      {
        art: <MindMapArt />,
        href: '/help/palette/mind-maps/',
        group: 'More than boxes and arrows',
        title: 'Mind maps from the keyboard',
        description:
          'Type a thought, press Tab for a child or Enter for a sibling, and keep typing. Every node arrives already connected, already selected, and ready for the next word, so a whole branch goes down at the speed you can say it. Nothing re-flows underneath you; tidy it with Auto Layout when you are done, or open Edit Outline to rename, nest and reorder the whole map as an indented list and save it back in one step.',
      },
      {
        art: <LanesArt />,
        href: '/help/palette/lanes/',
        group: 'More than boxes and arrows',
        title: 'Swimlanes that hold their contents',
        description:
          'Drop a lane for each role, team, or system, and lay the flow inside it. Drag the band and everything fully inside comes along, so reordering a process is one gesture rather than a careful multi-select. The title lives in its own gutter, clear of the work.',
      },
      {
        art: <EntityArt />,
        href: '/help/palette/entities/',
        group: 'More than boxes and arrows',
        title: 'Class and entity boxes',
        description:
          'A title bar over a list of name and type rows: the box at the heart of a UML class diagram and an ER model alike. Edit the fields from its menu, join them with the hollow triangle and diamond arrowheads UML expects, and skip building one out of stacked tables.',
      },
      {
        art: <SequenceArt />,
        href: '/help/palette/sequence-diagrams/',
        group: 'More than boxes and arrows',
        title: 'Sequence diagrams you type',
        description:
          'List who talks to whom and it draws the lifelines, arrows, activation bars and loops for you. Type a conversation straight down, one message per line, or paste it as text (A -> B: words). Calls, async messages and dashed replies, numbered on request so a review can say \u201cstep 4\u201d.',
      },
      {
        art: <CanvasChartsArt />,
        href: '/help/palette/tools/data-elements/',
        group: 'More than boxes and arrows',
        title: 'Charts and meters on the canvas',
        description:
          'Show the number, not just the box: column, bar, line, area and scatter charts from an editable grid or a CSV, a pie, progress bars and rings, a star rating and a timeline rail. They take the theme\u2019s colours and move, lock and export like any other element.',
      },
      {
        art: <CodeBlockArt />,
        href: '/help/palette/tools/code-blocks/',
        group: 'More than boxes and arrows',
        title: 'Code blocks with highlighting',
        description:
          'Put the payload beside the API arrow and the query under the database. A code block highlights TypeScript, JavaScript, Python, JSON, Bash, SQL, HTML, CSS and YAML, wraps long lines if you like, and keeps its own colour scheme whatever the theme.',
      },
      {
        art: <EventStormingArt />,
        href: '/help/canvas/event-storming-boards/',
        group: 'Event storming',
        title: 'Event storming boards',
        description:
          'A board built for the workshop: the eight note kinds of the notation one click away, written in marker capitals on paper that keeps its size and colour. Notes snap to timeline lanes, and holding Alt over a gap slides the rest of the wall along to make room for the step you missed.',
      },
      {
        art: <StickyPhotoArt />,
        href: '/help/canvas/event-storming-boards/',
        group: 'Event storming',
        title: 'Bring the paper wall in from a photo',
        description:
          'Ran the session on a real wall? Take a photo and every sticky comes in as a note: its words read from the handwriting, its kind from the paper\u2019s colour, laid out where it was. Untick what is not a note, fix a misreading, then add them as a draft you check in place.',
      },
      {
        art: <IconsArt />,
        href: '/help/palette/icons/',
        group: 'More than boxes and arrows',
        title: 'A library of icons',
        description:
          'Reach past boxes and arrows: drop a clean single-colour icon, servers, databases, clouds, users, and more, from the icon picker. Each one recolours with the theme and styles like any other shape, so an architecture diagram reads at a glance.',
      },
      {
        art: <TechIconsArt />,
        href: '/help/palette/technology/',
        group: 'More than boxes and arrows',
        title: 'Full-colour technology icons',
        description:
          'Build cloud architecture diagrams with brand-accurate icons for AWS, Azure, Cloudflare, and Firebase, plus a vendor-neutral set (Kubernetes, Docker, PostgreSQL, Redis and more), spanning compute, storage, databases, and networking. Search the Technology picker, drop one in, and it lands labelled with its product name.',
      },
      {
        art: <TablesArt />,
        href: '/help/palette/tools/tables/',
        group: 'More than boxes and arrows',
        title: 'Tables, fully editable',
        description:
          'Drop a table and double-click any cell to type. Insert or delete rows and columns from the cell menu, toggle a header row and a header column, recolour the headers (or reset them to the theme), drag the dividers to set column widths, and pick the cell padding. It lays out and recolours with the rest of the canvas.',
      },
      {
        art: <ImagesArt />,
        href: '/help/palette/tools/images/',
        group: 'More than boxes and arrows',
        title: 'Images on the canvas',
        description:
          'Drag, drop, or paste a PNG, JPEG, WebP, or GIF straight onto the canvas. Resize and arrange it like any other element. Everything you add lands in your own gallery, ready to reuse in any document without uploading twice.',
      },
      {
        art: <LinkCardArt />,
        href: '/help/canvas/links/link-cards/',
        group: 'More than boxes and arrows',
        title: 'Link cards that unfurl',
        description:
          'Drop a bookmark and paste a URL: it unfurls into a tidy card with the page title, favicon, and preview image. Click through any time. Turn a reference, a doc, or a related diagram into a card your whole team can follow.',
      },
      {
        art: <EmbedArt />,
        href: '/help/palette/embed-elements/',
        group: 'More than boxes and arrows',
        title: 'Videos, Figma, Docs, or any website',
        description:
          'Paste a YouTube or Vimeo link, a Loom recording, a Figma file, a Google Doc, or any web address at all, and it sits on the canvas where the discussion is. Nothing loads until somebody presses play, and the player never steals the pointer, so the board stays draggable while it runs.',
      },
      {
        art: <ComponentsArt />,
        href: '/help/palette/components/',
        group: 'More than boxes and arrows',
        title: 'Ready-made components',
        description:
          'Drop in a polished component and skip the busywork: a banner, a hero, a website-style header, an annotated callout, a row of KPI stats, or numbered process steps. Tap to place it or drag to size it; each one is a single element that follows the tab theme, re-flows as you resize it, and lets you retype any line in place.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/canvas/templates/',
        group: 'Templates & themes',
        title: 'A hundred and forty starter templates',
        description:
          'Start from a board that already makes sense: flowcharts and mind maps, retrospectives and Kanban, roadmaps and org charts, meeting agendas and risk matrices, pub quizzes and icebreakers, budgets and invoices, wireframes, architecture and UML, even a to-scale floor plan. Browse them by the job to be done in the picker, edit one, or start blank.',
      },
      {
        art: <ThemesArt />,
        href: '/help/canvas/themes/changing-theme/',
        group: 'Templates & themes',
        title: 'Twenty-six preset themes',
        description:
          'Default, Forest, Ocean, Sunset, Rose, Midnight, Mono and a dozen more, plus multi-colour Rainbow, Pastel and Tropical schemes that tint each branch a different hue. One click recolours the canvas, every shape, and every arrow. Every theme has a light and a dark half, and follows your own appearance.',
      },
      {
        art: <CustomThemesArt />,
        href: '/help/canvas/themes/custom-themes/',
        group: 'Templates & themes',
        title: 'Build your own theme',
        description:
          'Need your brand palette, a house style, or a notation that is not in the list? Build a custom theme, save it to your account, and reuse it across documents just like a built-in one. Edit it any time, and guests get them too.',
      },
      {
        art: <CanvasBackdropArt />,
        href: '/help/canvas/the-canvas/changing-the-background/',
        group: 'Templates & themes',
        title: 'Set the canvas backdrop',
        description:
          'Switch the canvas background between fourteen backdrops, from plain, grid, and lines to crosshatch, waves, isometric, and engineering. Each theme and template picks a fitting default.',
      },
      {
        art: <FontsArt />,
        href: '/help/canvas/text-and-fonts/choosing-fonts/',
        group: 'Templates & themes',
        title: 'Eleven fonts',
        description:
          'Set the typeface per element or as a tab-wide default, from eleven Google Fonts spanning sans, serif, slab, display, mono, and handwriting. New tabs inherit it, so every canvas reads consistently.',
      },
      {
        art: <AlignmentGuidesArt />,
        href: '/help/palette/alignment-guides/',
        group: 'Neat without trying',
        title: 'Guides that line things up',
        description:
          'Move or resize a shape and faint guide lines light up the moment an edge or centre lines up with a neighbour, so you can see exactly why it snapped and lay things out cleanly on a busy canvas. The lines match your theme and fade the instant you let go. Switch them off in Settings if you want a bare canvas.',
      },
      {
        art: <RotateArt />,
        href: '/help/canvas/the-canvas/',
        group: 'Neat without trying',
        title: 'Size anything to the pixel',
        description:
          'Type a width and a height rather than nudging a handle until it looks right. Lock the aspect ratio and one dimension carries the other. It is what drawing a floorplan to scale needs, and what a drag handle can never give you.',
      },
      {
        art: <RotateArt />,
        href: '/help/canvas/rotation/',
        group: 'Neat without trying',
        title: 'Rotate to a preset angle',
        description:
          'Tilt a selected shape to a preset 45° angle from the right-click Rotation menu, or type "rotate" in the search palette for quick 90°/180°/270° turns. Fixed steps keep tilted elements consistent, and pinned arrows keep tracking the shape as it turns.',
      },
      {
        art: <MarqueeArt />,
        href: '/help/canvas/selecting-and-grouping/multi-select/',
        group: 'Neat without trying',
        title: 'Multi-select with marquee',
        description:
          'Switch to the Select tool, drag a box, and act on everything inside at once: move, duplicate, or delete in one step, one Cmd-Z. Or grab the eraser and wipe out whatever you drag across, the whole sweep undone in a single step.',
      },
      {
        art: <DragDuplicateArt />,
        href: '/help/tips-and-tricks/keyboard-shortcuts/',
        group: 'Neat without trying',
        title: 'Shift-drag to duplicate',
        description:
          'Hold Shift and drag any element, or a whole selection, to peel off a copy: the original stays put, a translucent ghost follows your cursor, and the copy lands where you release, arrows and all.',
      },
      {
        art: <FormatPainterArt />,
        href: '/help/selection-modes/format-painter/',
        group: 'Neat without trying',
        title: 'Format painter',
        description:
          "Copy one element's look, its size, colours, text style, opacity, and padding, then brush it onto the next. Consistent diagrams without re-picking every option.",
      },
      {
        art: <LayersArt />,
        href: '/help/canvas/layers/',
        group: 'Neat without trying',
        title: 'Photoshop-style layers',
        description:
          'Split a tab into stacking layers with live previews: hide a slice, lock it, dim it, or merge it down, and keep review notes out of the export. Bring to Front quietly does the layering for you.',
      },
      {
        art: <LockArt />,
        href: '/help/canvas/locking/',
        group: 'Neat without trying',
        title: 'Lock anything in place',
        description:
          'Lock an element, or a whole tab, and it turns read-only, so a finished part of the canvas cannot be nudged or edited by accident.',
      },
      {
        art: <ShortcutsArt />,
        href: '/help/tips-and-tricks/keyboard-shortcuts/',
        group: 'Neat without trying',
        title: 'Keyboard shortcuts',
        description:
          'The moves you repeat have keys: undo and redo, delete, switch tools, and drop a shape, arrow, sticky, or text without reaching for the palette. Hold Cmd and the palette shows each key. A built-in cheat sheet lists them all, and you can switch them off per device. The canvas itself is a stop in the Tab order: move through its elements from the keyboard, with the selection announced to screen readers.',
      },
      {
        art: <SearchPaletteArt />,
        href: '/help/search-panel/the-search-panel/command-palette/',
        group: 'Neat without trying',
        title: 'Find or run anything with \u2318K',
        description:
          'One box finds your documents, tabs and elements, even text inside table cells, and runs commands by name: type \u201ctidy\u201d for Auto Layout or \u201claser\u201d for the pointer. It adds a shape or icon by name, jumps to a setting, and opens the help article for whatever you just searched.',
      },
      {
        art: <UnlimitedTabsArt />,
        href: '/help/tabs/using-tabs/',
        group: 'Tabs',
        title: 'Unlimited tabs per document',
        description:
          'Add as many tabs as a document needs. Each is its own canvas with its own theme, and nothing slows down as the stack grows.',
      },
      {
        art: <TabsArt />,
        href: '/help/tabs/linking-tabs/',
        group: 'Tabs',
        title: 'Link elements across tabs',
        description:
          'Point any element at another tab. Click it and you land on that tab, so a sprawling system stays one click to navigate.',
      },
      {
        art: <TabFoldersArt />,
        href: '/help/tabs/tab-folders/',
        group: 'Tabs',
        title: 'Group tabs into folders',
        description:
          'Big document, lots of tabs? Group related tabs into named folders along the tab bar and collapse the ones you are not using. Drag a tab in or out, and a folder opens on its own when you work in it.',
      },
      {
        art: <SideBySideArt />,
        href: '/help/tabs/side-by-side/',
        group: 'Tabs',
        title: 'Two tabs side by side',
        description:
          'Drag a tab to the right edge of the screen and it opens beside the one you are on, so the overview and the detail, or the retro and its actions, sit on screen together and you can work in either.',
      },
      {
        art: <TabCopyArt />,
        href: '/help/tabs/add-to-document/',
        group: 'Tabs',
        title: 'Reuse a tab in another document',
        description:
          "Copy a tab's full contents into another document you own, as a ready-made starting point you can take further.",
      },
      {
        art: <AnimatedShapesArt />,
        href: '/help/canvas/animations/',
        group: 'Bring it to life',
        title: 'Animate any shape',
        description:
          'Give a shape a looping animation to draw the eye or signal status: pulse an attention ring, glow a soft halo, blink a status light, trace the outline, breathe, shimmer, or a heartbeat for gentle emphasis. Pick one of four speeds, choose whether it repeats or plays once, and the format painter copies the motion to the next shape.',
      },
      {
        art: <FlowingArrowsArt />,
        href: '/help/canvas/animations/',
        group: 'Bring it to life',
        title: 'Arrows that show the flow',
        description:
          'Set an arrow flowing and its line comes alive: marching dashes, travelling dots, a row of beads, a breathing pulse, a soft glow, or a signal packet racing the line, all running toward the target so a data or process diagram reads its own direction. Each flow can repeat or fire once.',
      },
      {
        art: <LivingBackgroundArt />,
        href: '/help/canvas/the-canvas/changing-the-background/',
        group: 'Bring it to life',
        title: 'A backdrop with motion',
        description:
          'Swap the static grid for a living pattern: Flow streams diagonal lines, Drift floats rising motes, Aurora drifts colour glows, Ripple expands gentle rings, and Ribbons sweeps curved lines. Each matches the theme, scales with the size slider, runs as fast or as slow as you set the speed slider, and settles when reduced-motion is on.',
      },
      {
        art: <AnimatedIconsArt />,
        href: '/help/palette/icons/',
        group: 'Bring it to life',
        title: 'Animated icons',
        description:
          'Some icons move on their own: a spinner and gear turn, a heartbeat beats, a signal pulses. Pick one from the Animated set of the icon palette and drop it like any other glyph; it doubles as its own still frame.',
      },
      {
        art: <IsometricArt />,
        href: '/help/selection-modes/isometric-mode/',
        group: 'Bring it to life',
        title: 'Tilt the canvas into 3D',
        description:
          'Isometric view tips the whole canvas onto an angle and lifts each layer off the one below, so a stack that reads as flat boxes becomes a scene you can see the depth of. Orbit it from the zoom cluster. It is a way of LOOKING at the canvas, not a change to it: nothing moves, and everyone else still sees it flat.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'AI & your tools',
        title: 'Build diagrams with AI',
        description:
          'Hook livediagram up to Claude or any MCP client at mcp.livediagram.app and let it find, read, create, edit, and share your documents for you. Point it at a system and ask for the diagram; it lands in your account. Signed in, and it runs on the same revocable token (read-only if you prefer), so you can disconnect any time.',
      },
      {
        art: <AiAssistArt />,
        href: '/help/tools/ai/',
        group: 'AI & your tools',
        title: 'An optional AI assistant',
        description:
          'Switch it on for a hand on the active tab: Ask answers questions about the diagram without changing it, and Clean tidies sizes, labels, and layout. It works from your selection or the whole tab, and one undo takes it all back. Off by default, and self-hosters bring their own key.',
      },
      {
        art: <MermaidArt />,
        href: '/help/tabs/import-tabs/',
        group: 'AI & your tools',
        title: 'Works with Mermaid',
        description:
          'Paste or open a Mermaid flowchart and livediagram lays it out on the canvas, keeping every connection, not just the outline. Export a diagram tab back to Mermaid to copy or download. It is the diagram-as-code format your READMEs, issues, and AI tools already use, so your diagrams travel.',
      },
      {
        art: <MarkdownImportArt />,
        href: '/help/tools/markdown-import/',
        group: 'AI & your tools',
        title: 'Import a Markdown outline',
        description:
          'Bring an outline in from XMind, Obsidian, or any notes: headings and nested bullets become a tidy, themed node-link tree. Pick Markdown in the import dialog: it replaces the current tab’s contents, and one undo puts them back.',
      },
      {
        art: <BoardImportArt />,
        href: '/help/explorer/drawio-import/',
        group: 'AI & your tools',
        title: 'Bring your boards from other tools',
        description:
          'Import draw.io diagrams, Excalidraw scenes and Microsoft Whiteboard boards from the Explorer, a whole folder at a time, and each lands as a document you can edit: shapes, arrows, ink, notes and images, with a tab per draw.io page.',
      },
      {
        art: <ExportArt />,
        href: '/help/tabs/export-tabs/',
        group: 'AI & your tools',
        title: 'Export as PNG, SVG, or PDF',
        description:
          'Take any tab out as an image for a doc, a PDF to print, or JSON to move it elsewhere. A diagram or whiteboard tab also goes out as Markdown or Excalidraw. What you exported is what you drew: same sizes, same colours, same marks, in the same places.',
      },
      {
        art: <ApiArt />,
        href: '/help/account-and-data/api-tokens/',
        group: 'AI & your tools',
        title: 'Write your own integrations',
        description:
          'Create an API token and call the same REST API the editor uses, under your account, from your own scripts and integrations, or install the livediagram command-line tool from npm to read, edit, share and export documents from your terminal. Signed in, revocable, six-month tokens, no lock-in. Link a repository to your documents and coding agents find your diagrams by name, or keep the editor open beside your agent in a workbench.',
      },
    ],
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    scene: 'draw',
    cta: 'Explore the whiteboard',
    title: 'A whiteboard that feels like paper',
    description:
      'Switch a tab to Draw and the canvas becomes a whiteboard: three markers in hand, a pen that answers to pressure, and erasers that take a whole stroke or just a smudge. Sketch it rough, and let it snap to shape when you want it neat.',
    metaDescription:
      'Switch a tab to Draw for a whiteboard that feels like paper: three pressure-sensitive markers, smart erasers, and rough shapes that snap neat.',
    highlights: [
      'Three markers in hand',
      'Pressure-sensitive pens',
      'Sketch freehand, or let it snap to shape',
      'Two erasers',
    ],
    items: [
      {
        art: <MarkersArt />,
        href: '/help/canvas/draw-mode/',
        title: 'Three markers in hand',
        description:
          'Keys 1, 2 and 3 pick up three markers, each in six widths from Fine to Broad. Marker 1 is ink; the other two take any of nine stock colours or a colour of your own.',
      },
      {
        art: <DrawDockArt />,
        href: '/help/canvas/draw-mode/',
        title: 'Shapes and text in the dock',
        description:
          'Draw mode swaps the palette for a dock across the top: select, the three markers, text, the Path tool and the eraser, each on its own key, then the shapes you use. Pin up to seven favourites, an arrow and a rectangle to start, and the Shapes button offers the ones you pick most.',
      },
      {
        art: <PressureArt />,
        href: '/help/canvas/draw-mode/',
        title: 'Pressure-sensitive pens',
        description:
          'Draw with a stylus and the line thins and swells with how hard you press, the way ink does. A mouse or a finger keeps the width you chose.',
      },
      {
        art: <PencilArt />,
        href: '/help/canvas/draw-mode/#shape-recognition',
        title: 'Sketch freehand, or let it snap to shape',
        description:
          'Switch on shape recognition and a rough circle, rectangle, triangle, diamond or line becomes a clean shape the moment you lift the pen. Hold still for half a second to preview it first. It starts off, so a sketch stays a sketch until you ask.',
      },
      {
        art: <ErasersArt />,
        href: '/help/canvas/draw-mode/#the-two-erasers',
        title: 'Two erasers',
        description:
          'The stroke eraser lifts a whole stroke in one touch; the partial eraser rubs out only what it passes over. Stickies, text and shapes are never cut in half.',
      },
      {
        art: <PathToolArt />,
        href: '/help/canvas/draw-mode/#the-path-tool',
        title: 'Clean curves with the Path tool',
        description:
          'Press P for a vector pen, like the one in your design tool: draw a smooth curve, then edit any point as a corner, mirrored or aligned. For the line that has to be exact.',
      },
      {
        art: <PalmRejectionArt />,
        href: '/help/canvas/draw-mode/#pen-finger-and-mouse',
        title: 'Rest your palm on the screen',
        description:
          'Once you pick up a stylus, a single finger pans rather than draws, so a resting palm leaves no mark. Two fingers always pan and zoom.',
      },
      {
        art: <CanvasBackdropArt />,
        href: '/help/canvas/draw-mode/#backgrounds',
        title: 'A board in light or dark',
        description:
          'Put Plain, Dots or Grid behind your ink, a choice that is yours alone. Ink and the stock marker colours adjust so they read on a light board and a dark one.',
      },
    ],
  },
  {
    id: 'infographics',
    label: 'Infographics',
    scene: 'infographic',
    cta: 'Explore infographics',
    title: 'Posters, social posts and logos',
    description:
      'Switch a tab to Pages and lay out pages: start from a ready-made layout, paint it from your theme, fill it with stats, charts and quotes, then export it print-ready or post it. Or design a logo on an artboard of its own.',
    metaDescription:
      'Lay out posters, one-pagers and social posts from ready-made layouts, design a logo on its own artboard, then export them print-ready.',
    highlights: [
      'Pages for print and social',
      'Start a page from a layout',
      'Design a logo',
      'Every page, print-ready',
    ],
    items: [
      {
        art: <PagesArt />,
        href: '/help/canvas/pages-mode/',
        title: 'Pages for print and social',
        description:
          'A4, US Letter and A3 for print; square, portrait post and story or slide for social; a square artboard for a logo. Each page has its own size and orientation, and everything on it moves with it.',
      },
      {
        art: <InfographicLayoutArt />,
        href: '/help/canvas/pages-mode/infographic-layouts/',
        title: 'Start a page from a layout',
        description:
          'Ninety-two ready-made pages in eight categories, from a magazine cover and a gig poster to a KPI dashboard, a SWOT and a cheat sheet. Hover one to preview it on your page, press it to place it, then make it yours.',
      },
      {
        art: <TidyPageArt />,
        href: '/help/canvas/pages-mode/',
        title: 'Tidy a page in one press',
        description:
          'Press the broom on a page and it straightens itself: anything poking past the margins comes back inside, edges that nearly line up do, and gaps that are nearly even become even. It keeps your layout and never moves anything far.',
      },
      {
        art: <PagesBackgroundsArt />,
        href: '/help/canvas/pages-mode/',
        title: 'Backgrounds from your theme',
        description:
          'Paint a page in a tint of your theme, a solid colour or a gradient, with dots, a grid or ruled lines over it. Text keeps reading on a dark page, because the ink follows the page.',
      },
      {
        art: <IntoPagesArt />,
        href: '/help/canvas/pages-mode/',
        title: 'Turn any diagram into pages',
        description:
          'Switch a diagram, mind map or sketch to Pages mode and it lands on a page made around it, nothing moved or shrunk. Split it into a page for each part whenever you like.',
      },
      {
        art: <TabWindowArt />,
        href: '/help/canvas/pages-mode/tab-windows/',
        title: 'A live window onto another tab',
        description:
          'Draw the diagram on its own tab, then put a window onto it on a slide or a poster. The window follows every change you or a collaborator make, so there is never a stale copy to paste again. Open jumps straight to the tab.',
      },
      {
        art: <LogoPageArt />,
        href: '/help/canvas/pages-mode/logo-pages/',
        title: 'Design a logo',
        description:
          'A logo page is a square artboard with construction guides to build on. Start from twenty-five logo layouts or a blank board, draw with Mirror for a symmetrical mark, combine shapes into one, set the name in wordmark type, then download a logo kit: SVG, PNGs from 16 to 1024 pixels and a favicon.',
      },
      {
        art: <PagesExportArt />,
        href: '/help/canvas/pages-mode/exporting-pages/',
        title: 'Every page, print-ready',
        description:
          'Export every page as one PDF at true print size, or one page as a PNG or SVG. Add pages to a slide deck and present them full screen, one page at a time.',
      },
      {
        art: <PagesGifArt />,
        href: '/help/canvas/pages-mode/exporting-pages/',
        title: 'Pages as an animated GIF',
        description:
          'Export the pages as one animated GIF for a chat, an email, a README or a social post. Every animation on a page plays in it, each page holds for 1 to 20 seconds, and it comes in three sizes up to 1440 pixels.',
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
      'Start a slide from one of 61 ready-made layouts, or make one from what you drew, then present the deck full screen on your screen alone, your notes behind a button. Slides reference your diagram, so they never drift from it.',
    metaDescription:
      'Slide decks from 61 ready-made layouts or from what you drew, presented full screen with private notes. Slides stay in step with your diagram.',
    highlights: [
      'Slide pages, ready-made layouts',
      'Slides made from what you drew',
      'Notes only you open',
      'Your screen, not everyone else’s',
    ],
    items: [
      {
        art: <SlideLayoutsArt />,
        href: '/help/canvas/pages-mode/exporting-pages/#turning-pages-into-slides',
        title: 'Slide pages, ready-made layouts',
        description:
          'Add a 16:9 or classic 4:3 slide page and start it from one of 61 layouts: a keynote title, an agenda, three big numbers, a roadmap, a call to action and more. One press puts it in the deck, and it presents edge to edge.',
      },
      {
        art: <SlideDeckArt />,
        href: '/help/selection-modes/slide-deck/',
        title: 'Slides made from what you drew',
        description:
          'A slide is simply the elements you picked, from one tab. Select a cluster on the canvas and make it a slide; the arrows between them come along on their own. Slides reference your elements rather than copying them, so editing a shape updates every slide it appears on and the deck can never drift from the diagram.',
      },
      {
        art: <FullScreenSlideArt />,
        href: '/help/selection-modes/slide-deck/',
        title: 'One deck across every tab',
        description:
          'Slide one can come from your architecture tab and slide two from the roadmap. Order them however you like in the Slide Deck panel: drag to rearrange, rename, duplicate, or hide a slide you might want next week without deleting it. The deck is saved with the document, so a teammate opens it and sees the same talk.',
      },
      {
        art: <PresenterNotesArt />,
        href: '/help/selection-modes/slide-deck/',
        title: 'Notes only you open',
        description:
          'Write what you mean to say over each slide. During the presentation they sit behind a button in the corner, so nothing about your script is on screen until you ask for it. Clicking any element shows its note, comments and assigned action too, for the question you did not plan for.',
      },
      {
        art: <SlideTimingArt />,
        href: '/help/selection-modes/slide-deck/presenter-controls/',
        title: 'Keep the talk on time',
        description:
          'Give each slide a few minutes when you build the deck. While you present, an elapsed clock counts up and the slide\u2019s budget turns amber when you run over, on your screen only. Both are off until you want them, and running over never moves the deck on for you.',
      },
      {
        art: <PresentLocallyArt />,
        href: '/help/selection-modes/slide-deck/',
        title: 'Your screen, not everyone else’s',
        description:
          'Presenting shows the deck on your screen and nowhere else. Nobody is dragged into your slide, nobody’s view moves, and collaborators with the document open carry on working. You share your screen the way you already do. Nothing on a slide can be changed by a stray click, so a projector is safe. To leave a deck running on a screen, set it to advance every 5 to 60 seconds and loop back to the start.',
      },
      {
        art: <ZenModeArt />,
        href: '/help/tools/zen-mode/',
        title: 'Zen mode for focus',
        description:
          'Hit Z, or the zen button by the laser pointer, and every toolbar, panel, and tab bar drops away, leaving just your canvas. Only the zoom controls stay, with an exit button right beside them. Press Z or Esc to bring it all back.',
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    scene: 'article',
    cta: 'Explore documents',
    title: 'Write it up, diagram and all',
    description:
      'Write on pages like a doc, with the diagram right there in the text: pictures that wrap, comments in the margin, and five looks to match your house style. The write-up and the diagram stay one document.',
    metaDescription:
      'Write on pages like a doc, with the diagram in the text: pictures that wrap, margin comments and five looks. The write-up and diagram stay one document.',
    highlights: [
      'Write like a doc',
      'Pages that grow',
      'Pictures and drawings in the text',
      'Comments in the margin',
    ],
    items: [
      {
        art: <ArticlePagesArt />,
        href: '/help/canvas/pages-mode/articles/',
        group: 'Write',
        title: 'Write like a doc',
        description:
          'Type straight onto a page with Markdown shortcuts and a / menu for every block, and paste cleanly from web pages, Google Docs and Word. A formatting toolbar sits on the page for styles, colour, links and lists.',
      },
      {
        art: <ArticleFlowArt />,
        href: '/help/canvas/pages-mode/articles/#pages-that-grow',
        group: 'Write',
        title: 'Pages that grow',
        description:
          'Writing flows onto a new page as it grows, and empty pages tidy themselves away. A heading never strands alone at the foot of a page, and a page break is there when you want one.',
      },
      {
        art: <ContentsSidebarArt />,
        href: '/help/canvas/pages-mode/',
        title: 'Every page in the Contents',
        description:
          'A Contents sidebar lists every page with a picture of it, its number and its name, and highlights the one you are reading. Press a row to glide there, or type to find a page by its name or any words on it.',
      },
      {
        art: <ArticleWrapArt />,
        href: '/help/canvas/pages-mode/articles/',
        group: 'Write',
        title: 'Pictures and drawings in the text',
        description:
          'Pictures, charts and tables sit in the line, wrap left or right, or float free. Drop a shape into the writing and a drawing area opens right there in the text.',
      },
      {
        art: <MarginCommentsArt />,
        href: '/help/canvas/pages-mode/articles/#comments-and-actions-on-words',
        group: 'Write',
        title: 'Comments in the margin',
        description:
          'Select words to comment on them or hand them to a teammate as an action. A marker in the margin keeps pace with the text as it moves.',
      },
      {
        art: <ArticleLooksArt />,
        href: '/help/canvas/pages-mode/articles/#the-article-s-style',
        group: 'Write',
        title: 'Five looks for an article',
        description:
          'Clean, Classic, Report, Notebook or Bold, then set the accent colour, margins, fonts and page numbers to match your house style.',
      },
    ],
  },
  {
    id: 'plan',
    label: 'Plans & boards',
    scene: 'plan',
    cta: 'Explore plans and boards',
    title: 'Plan the work, then watch it move',
    description:
      'Switch a tab to Plan and the work moves onto boards of cards: columns with WIP limits, swimlanes, card types with fields of your own, live charts of every card, and dashboards that bring it all onto one page, right beside the diagram that explains it.',
    metaDescription:
      'Plan mode puts the work on boards of cards: WIP limits, swimlanes, your own card types, live charts, Sheets with real formulas and dashboards.',
    highlights: [
      'Boards with WIP limits',
      'One card, every board',
      'Card types and fields of your own',
      'Dashboards on one page',
    ],
    items: [
      {
        art: <PlanBoardArt />,
        href: '/help/canvas/plan-mode/',
        title: 'Boards with WIP limits',
        description:
          'Drag cards through columns, split into swimlanes by assignee, type, priority or any field. Give a column a WIP limit and its count turns amber the moment it goes over.',
      },
      {
        art: <SharedItemsArt />,
        href: '/help/canvas/plan-mode/items/',
        title: 'One card, every board',
        description:
          'A card is one item, not a copy, so the same card can sit on the sprint board and the roadmap. Move it on one and it moves on both.',
      },
      {
        art: <CardDetailArt />,
        href: '/help/canvas/plan-mode/cards/',
        title: 'Cards that hold the detail',
        description:
          'Open a card for everything about it: a rich-text description, a checklist that counts down to done, status, assignee, priority, labels and dates, and the project it belongs to. Flag one for attention, and follow the trail between a project and its tasks without losing your place.',
      },
      {
        art: <CardCommentsArt />,
        href: '/help/canvas/plan-mode/cards/',
        title: 'Talk it through on the card',
        description:
          'Every card has its own thread. @mention a teammate and they get an email that opens the card, resolve the thread when it is settled, and see the comment count on the card from the board.',
      },
      {
        art: <CardTypesArt />,
        href: '/help/canvas/plan-mode/card-types/',
        title: 'Card types and fields of your own',
        description:
          'Five built-in types (Project, Task, Note, Idea and Action), or make your own with the fields your team tracks: text, number, date, choice, a link to another card and more.',
      },
      {
        art: <PlanViewsArt />,
        href: '/help/canvas/plan-mode/#metrics-and-visualisations',
        title: 'Live charts of every card',
        description:
          'A Gantt chart, due and start calendars you can drag cards across, cards by any field and priority by status, all drawn from the cards themselves, so a chart is never out of date. Give one a tab of its own and it fills the page, with a Chart Settings cog for which cards it shows and how it groups them.',
      },
      {
        art: <DashboardArt />,
        href: '/help/canvas/plan-mode/dashboards/',
        title: 'Dashboards on one page',
        description:
          'Lay a tab out as rows of slots and put one thing in each, live: a board you can work on, a Sheet you can edit, a chart, a figure like Completion or a column total, a diagram from another tab, or a note, a checklist or a key date. Start from a layout such as Overview or Report, then add, move and resize slots as you go.',
      },
      {
        art: <SheetsArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Sheets with real formulas',
        description:
          'Put a spreadsheet on a Plan tab: cells, over 150 functions, number formats, sort, filter and freeze, live for everyone. Formulas can read the cards on the board, or list the cards as rows that stay linked both ways. Select some cells and chart them as bars, lines or a pie that sits in the Sheet over its cells. Copy and paste works with Google Sheets and Excel, CSV files come in and go out, and cells come Compact, Default or Roomy and zoom from 50% to 200%.',
      },
      {
        art: <BoardWidgetsArt />,
        href: '/help/canvas/plan-mode/#widgets-in-the-header',
        title: 'Widgets that narrow the board',
        description:
          'Pin widgets to a board header (Completion, Due Soon, WIP Alerts, Top Voted, Stale Cards and more) and press one to narrow the board to just those cards.',
      },
      {
        art: <FindCardArt />,
        href: '/help/canvas/plan-mode/cards/',
        title: 'Find any card',
        description:
          'The Cards list searches every card in the document by number, title or description, newest change first. Add up to eight filters, such as Type: Bug or Assignee: No assignee, or show only the cards no board is showing.',
      },
      {
        art: <BoardCsvArt />,
        href: '/help/canvas/plan-mode/boards/',
        title: 'Boards in and out as CSV',
        description:
          'Import a CSV or TSV and each row becomes a card, landing in the column its Status names and with the person its Assignee names; only a title is required, and one undo takes it all back. Export any board as CSV, an image, a PDF or a Markdown outline.',
      },
      {
        art: <HiddenVotesArt />,
        href: '/help/canvas/plan-mode/boards/',
        title: 'Retros that keep a secret',
        description:
          'Cards stay face down while the team writes, so nobody anchors on the first idea. Press Reveal, then vote for what matters most.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/canvas/plan-mode/#plan-templates',
        title: 'Ten plans, twelve spreadsheets',
        description:
          'Project Planner, Kanban Board, Bug Tracker, Team Retro, Weekly Planner, Content Calendar, Hiring Pipeline, OKRs, Product Launch and Feedback Board, each set up with its boards; twelve spreadsheets, from a Budget Planner and an Invoice to a Sales Pipeline, a Grade Book and a Loan Calculator, many with charts already in; or a blank plan. Start Planning lays them out by kind, with search.',
      },
      {
        art: <McpArt />,
        href: '/help/canvas/plan-mode/items/',
        title: 'Agents that move the cards',
        description:
          'Your AI tools can read the plan and add, edit and move cards over MCP, the API or the CLI, naming columns and fields the way the board shows them.',
      },
    ],
  },
  {
    id: 'sheets',
    label: 'Sheets',
    scene: 'sheet',
    cta: 'Explore sheets',
    title: 'Spreadsheets that sit beside the work',
    description:
      'Put a spreadsheet on a Plan tab: real formulas, number formats, sort and filter, live for everyone. Read the cards on the board, or list them as rows that stay linked both ways, and chart any cells in a click.',
    metaDescription:
      'Spreadsheets on a Plan tab: real formulas, live for everyone, reading the board’s cards or listing them as linked rows, with charts from any cells.',
    highlights: [
      'Sheets with real formulas',
      'Cards as rows, linked both ways',
      'Charts from your cells',
      'Twelve ready-made spreadsheets',
    ],
    items: [
      {
        art: <SheetsArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Sheets with real formulas',
        description:
          'Cells, over 150 functions, number formats, sort, filter and freeze, live for everyone on the document. Formulas fill down, and a cell can read a card on the board.',
      },
      {
        art: <SharedItemsArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Cards as rows, linked both ways',
        description:
          'List the board’s cards as rows: change a cell and the card changes, move the card and its row follows. The sheet and the board are one set of work.',
      },
      {
        art: <PlanViewsArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Charts from your cells',
        description:
          'Select some cells and chart them as bars, lines or a pie that sits in the Sheet over its cells, redrawn the moment a number changes.',
      },
      {
        art: <SheetValidationArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Dropdowns and checkboxes',
        description:
          'Turn cells into coloured dropdown chips, a list from other cells, or tick boxes a formula can count. Number, date and text rules refuse a value that does not fit, or only warn, and say why in the cell.',
      },
      {
        art: <ConditionalFormatArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Colour cells by their values',
        description:
          'Conditional formatting paints a cell when it meets a rule (text contains, greater than, a date before, or a formula of your own) or shades a whole column on a colour scale. You see each rule on the cells while you set it.',
      },
      {
        art: <CellCommentsArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Named ranges and cell comments',
        description:
          'Name a cell TaxRate and write =B2*TaxRate in any row. Leave a comment on a single cell: it carries an amber corner, opens as a thread, and is listed with every other open thread in the document.',
      },
      {
        art: <SheetTogetherArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Edit together, cell by cell',
        description:
          'Everyone sees each change as it is made, with each person\u2019s selection outlined in their colour and name. Two people typing in different cells never overwrite each other, and a participant link can fill in cells without changing the rules.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/canvas/plan-mode/#plan-templates',
        title: 'Twelve ready-made spreadsheets',
        description:
          'A Budget Planner, an Invoice, a Sales Pipeline, a Grade Book, a Loan Calculator and more, many with charts already in, or a blank spreadsheet to type into.',
      },
      {
        art: <BoardImportArt />,
        href: '/help/canvas/plan-mode/sheets/',
        title: 'Paste from Sheets and Excel, CSV in and out',
        description:
          'Copy and paste works with Google Sheets and Excel, CSV files come in and go out, and cells come Compact, Default or Roomy and zoom from 50% to 200%.',
      },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    scene: 'form',
    cta: 'Explore forms',
    title: 'Collect answers straight into your board or sheet',
    description:
      'Build a form where it sits, share one link, and each response lands the moment it is sent: a row in a sheet, or a card on a board ready to work through. No account needed to answer, and nothing else of yours to see.',
    metaDescription:
      'Build a form, share one link, and each response lands as a row in a sheet or a card on a board. No account needed to answer.',
    highlights: [
      'Build it where it sits',
      'One link to share',
      'Every answer lands',
      'Seven forms to start from',
    ],
    items: [
      {
        art: <FormBuilderArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'Build it where it sits',
        description:
          'Click a question to word it, pick its type (short answer, paragraph, number, email, link, date, choices, rating or a checkbox) and mark it required, right in the form. Sections can show only on an earlier answer.',
      },
      {
        art: <FormSectionsArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'Pages, a cover and your look',
        description:
          'Split a form into sections people answer a page at a time, with Next, Back and a progress bar, and show a section only to those who answered a certain way. Add a cover band, and the form wears its tab\u2019s theme and font on its link too.',
      },
      {
        art: <FormShareArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'One link to share',
        description:
          'Publish the form to get a link anyone can fill in, with no sign-in. They see the form and nothing else of yours, and you can close it, set a closing date or a response limit at any time.',
      },
      {
        art: <FormResponsesArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'Every answer lands',
        description:
          'Each response becomes a row in a sheet, a column per question, or a card on a board with its answers in the card’s fields, ready to move along. The count on the form says how many are new.',
      },
      {
        art: <FormAlertsArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'New answers find you',
        description:
          'Each response shows New until you open it, the form counts what is new to you, and your Inbox lists every form with fresh answers. The owner also gets an email, at most one every 15 minutes per form, and can switch it off in Settings.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/canvas/plan-mode/forms/',
        title: 'Seven forms to start from',
        description:
          'A Bug Report, Feedback, a Feature Request, an Event RSVP, a Job Application, a Contact form, or a blank one, each sending its answers to the board or sheet that suits it.',
      },
    ],
  },
];

/**
 * The section ids, in render order. The `/features/<id>` detail route's
 * `generateStaticParams` and the sitemap both map over this, so adding a
 * section to `LANDING_SECTIONS` automatically gives it a page + a sitemap
 * entry with no second list to keep in sync.
 */
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
