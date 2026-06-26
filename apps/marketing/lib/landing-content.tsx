import {
  AccountSyncArt,
  ActivityArt,
  AiAssistArt,
  AlignmentGuidesArt,
  AnimatedIconsArt,
  AnimatedShapesArt,
  AnyDeviceArt,
  ApiArt,
  ArrowsArt,
  AutosaveArt,
  BorderStyleArt,
  CanvasBackdropArt,
  CommentsArt,
  ComponentsArt,
  CustomThemesArt,
  DarkModeArt,
  DepthArt,
  EasyStartArt,
  ExpiryArt,
  FlowingArrowsArt,
  FoldersArt,
  FontsArt,
  FormatPainterArt,
  GroupArt,
  IconsArt,
  ImagesArt,
  LaserArt,
  LinkCardArt,
  LivingBackgroundArt,
  NotesArt,
  LockArt,
  MarkdownImportArt,
  MarqueeArt,
  McpArt,
  MinimalPanelArt,
  PencilArt,
  MitArt,
  MultiplayerArt,
  NoServersArt,
  NoTrackingArt,
  PresenceArt,
  RealtimeArt,
  RefreshArt,
  RevokeArt,
  RichTextArt,
  RotateArt,
  SearchArt,
  SelectionGlowArt,
  SessionToolsArt,
  ShapesArt,
  ShareLinksArt,
  ShortcutsArt,
  SpotlightArt,
  TabCopyArt,
  TabFoldersArt,
  TabLockArt,
  TabReorderArt,
  TablesArt,
  TabsArt,
  TechIconsArt,
  TeamsArt,
  TemplatesArt,
  ThemesArt,
  UndoRedoArt,
  UnlimitedTabsArt,
  ZenModeArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@/components/Section';

export type LandingSection = {
  id: string;
  title: string;
  description: string;
  /**
   * The label for the landing-page advertising block's "Explore" button. Hand
   * written per section rather than derived from the title: deriving it ("Explore
   * {title}") duplicated the heading and read awkwardly for the longer titles
   * (e.g. "Explore simple by design, powerfully deep"). Keep it short, natural,
   * and verb-led, e.g. "Explore how we keep it simple".
   */
  cta: string;
  items: FeatureProps[];
};

/**
 * The landing page's feature sections, in render order. `page.tsx` maps over
 * this and derives each section's tinted/plain background from its index, so
 * the white/tinted rhythm stays correct automatically as sections are added,
 * removed, or reordered. The two non-feature interludes (the use-case carousel
 * and the privacy section) are slotted in by `page.tsx` after their anchor ids.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'why',
    cta: 'Explore how we keep it simple',
    title: 'Simple by design, powerfully deep',
    description:
      'The simple path is the default: open a link and draw. The depth is there the moment you reach for it, and you never trade one for the other.',
    items: [
      {
        art: <EasyStartArt />,
        href: '/help/getting-started/your-first-diagram/',
        title: 'Start in one click',
        description:
          "No install, no account, no blank-canvas dread. Land on a link and you're drawing in seconds.",
      },
      {
        art: <AnyDeviceArt />,
        href: '/help/supported-devices/',
        title: 'Works on any device',
        description:
          'It runs in the browser, so there is nothing to install. Open the same diagram on your laptop, desktop, or tablet and pick up where you left off.',
      },
      {
        art: <DepthArt />,
        title: 'Looks simple, runs deep',
        description:
          'A clean canvas hides serious range: groups, locks, the format painter, arrows that track, and links across tabs.',
      },
      {
        art: <MultiplayerArt />,
        href: '/help/collaboration/sharing/',
        title: 'Multiplayer, no setup',
        description:
          'Share one link and the whole team is on the canvas live, with cursors, presence, comments, and an activity log you can rewind. No seats to buy, no setup.',
      },
      {
        art: <MarkdownImportArt />,
        href: '/help/tools/markdown-import/',
        title: 'Import a Markdown outline',
        description:
          'Bring an outline in from XMind, Obsidian, or any notes: headings and nested bullets become a tidy, themed node-link tree. Pick Markdown in the import dialog — it builds onto the current tab, and one undo takes it back.',
      },
      {
        art: <ShortcutsArt />,
        href: '/help/tips-and-tricks/keyboard-shortcuts/',
        title: 'Keyboard shortcuts',
        description:
          'The moves you repeat have keys: undo and redo, delete, switch tools, and drop a shape, arrow, sticky, or text without reaching for the palette. Hold Cmd and the palette shows each key. A built-in cheat sheet lists them all, and you can switch them off per device.',
      },
    ],
  },
  {
    id: 'collaboration',
    cta: 'Explore collaboration',
    title: 'Invite your team to collaborate',
    description:
      'Diagrams stay private until you share. Everyone you invite shows up on the canvas in real time, with live cursors, comments, and presence.',
    items: [
      {
        art: <ShareLinksArt />,
        href: '/help/collaboration/sharing/',
        title: 'Editor or view-only links',
        description:
          'Create an editor link for collaborators or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side. Any link also embeds read-only in your wiki, Notion, or docs: copy the iframe snippet from the Share dialog.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of diagrams they can all open and edit. Admins manage membership and roles; members just get to work. Sign in to set one up, the canvas itself never needs an account.',
      },
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        title: 'Live presence',
        description:
          'See who is in the diagram from the participant avatars on each tab. Status rings show online, away, or stale.',
      },
      {
        art: <RealtimeArt />,
        href: '/help/collaboration/live-presence/',
        title: 'Edits land live',
        description:
          'The moment someone makes a change, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
      },
      {
        art: <SelectionGlowArt />,
        href: '/help/collaboration/live-presence/',
        title: 'See what others are working on',
        description:
          'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner, in real time.',
      },
      {
        art: <CommentsArt />,
        href: '/help/collaboration/comments/',
        title: 'Comments on any element',
        description:
          "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
      },
      {
        art: <LaserArt />,
        href: '/help/palette/laser/',
        title: 'Laser pointer for presenting',
        description:
          'Switch to the laser tool and your cursor leaves a glowing trail everyone can see. Point at the thing you mean while you talk it through. Trails fade on their own.',
      },
      {
        art: <SpotlightArt />,
        href: '/help/palette/spotlight/',
        title: 'Spotlight the room on one thing',
        description:
          'Switch on Spotlight and the canvas dims under a soft shroud, with only a circle of light around your cursor. Walk the room through a busy diagram one piece at a time. Left-click grows the light, right-click shrinks it, and it is a local view aid, so it never gets in a viewer’s way.',
      },
      {
        art: <SessionToolsArt />,
        href: '/help/collaboration/session-tools/',
        title: 'Run the session: timer + voting',
        description:
          'Facilitate live from the canvas. Start a countdown or stopwatch the whole room sees, then open dot-voting to surface the group’s priorities. Everyone votes with a budget of dots; results tally in real time. Perfect for retros, workshops, and timeboxed planning.',
      },
      {
        art: <ExpiryArt />,
        href: '/help/collaboration/sharing/share-link-expiry/',
        title: 'Links that expire on their own',
        description:
          'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, no cleanup to remember, and you can extend it for another run or delete it for good.',
      },
      {
        art: <RevokeArt />,
        href: '/help/privacy-and-security/share-link-security/',
        title: 'Stop sharing on demand',
        description:
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The diagram is yours again.',
      },
    ],
  },
  {
    id: 'customise',
    cta: 'Explore customisation',
    title: 'Customise it your way',
    description:
      'Make every diagram yours: start from a template, recolour with a theme, set the type and the backdrop, and shape every border, arrow, and block the way you want it.',
    items: [
      {
        art: <TemplatesArt />,
        href: '/help/canvas/templates/',
        title: 'Twenty-four starter templates',
        description:
          'Blank, mind map, org chart, retrospective, flowchart, Kanban, SWOT and timeline to start, plus Gantt, Venn, user journey, fishbone, pyramid, flywheel, prioritization matrix, comparison table, ER / sequence / system-architecture diagrams, logo design, a live card, and mobile / laptop / slide-deck wireframes. Pick one, edit it, or start blank.',
      },
      {
        art: <ThemesArt />,
        href: '/help/canvas/themes/changing-theme/',
        title: 'Twenty-seven preset themes',
        description:
          'Basic, Forest, Ocean, Sunset, Rose, Midnight, Mono and a dozen more — plus multi-colour Rainbow, Pastel, Tropical, Autumn, and Jewel themes that tint each branch a different hue. One click recolours the canvas, every shape, and every arrow.',
      },
      {
        art: <CustomThemesArt />,
        href: '/help/canvas/themes/custom-themes/',
        title: 'Build your own theme',
        description:
          'Need your brand palette, a house style, or a notation that is not in the list? Build a custom theme, save it to your account, and reuse it across diagrams just like a built-in one. Edit it any time, and guests get them too.',
      },
      {
        art: <CanvasBackdropArt />,
        href: '/help/canvas/the-canvas/changing-the-background/',
        title: 'Set the canvas backdrop',
        description:
          'Switch the canvas background between fourteen backdrops, from grid and lines to crosshatch, waves, isometric, and engineering, or none at all. Each theme and template picks a fitting default.',
      },
      {
        art: <FontsArt />,
        href: '/help/canvas/text-and-fonts/choosing-fonts/',
        title: 'Eight fonts',
        description:
          'Set the typeface per element or as a tab-wide default, from eight Google Fonts spanning sans, serif, slab, mono, and handwriting. New tabs inherit it, so a diagram reads consistently.',
      },
      {
        art: <ShapesArt />,
        href: '/help/palette/shapes/',
        title: 'A shape for everything',
        description:
          'Fourteen core shapes — flowchart blocks plus an actor, cloud, triangle, star, and speech bubble — a section frame that carries whatever you draw inside it, and six device frames (browser, monitor, laptop, phone, tablet, smartwatch). Click to drop one, or drag to draw it at the exact size you want, snapped to line up with its neighbours. A flowchart one minute, a screen the next.',
      },
      {
        art: <ArrowsArt />,
        href: '/help/palette/arrows/',
        title: 'Arrows that bend your way',
        description:
          'Connect anything with straight, curved, or angled arrows. Drag the handle on a curve to reshape its bow, or on an elbow to move the bend. Set the thickness, choose the arrowhead shape, filled or hollow triangle, line, circle, or diamond, for UML-style connectors and size it, add a label, and pin an end to a shape so it follows when things move.',
      },
      {
        art: <BorderStyleArt />,
        href: '/help/palette/shapes/',
        title: 'Style every border',
        description:
          'Set border strength, switch between solid, dashed, and dotted, and round the corners as much or as little as the shape calls for.',
      },
      {
        art: <FoldersArt />,
        href: '/help/explorer/my-work/',
        title: 'Organise in folders',
        description:
          'File diagrams into nested folders in the explorer. Recent diagrams stay one click away; everything else lives where you put it.',
      },
    ],
  },
  {
    id: 'motion',
    cta: 'Explore animation',
    title: 'Bring the canvas to life',
    description:
      'A diagram does not have to sit still. Animate a shape to signal status, send the flow marching along an arrow, let the backdrop drift, and reach for a spotlight when you present. Every animation is purely decorative motion: it freezes to a clean still frame when exported and respects reduced-motion.',
    items: [
      {
        art: <AnimatedShapesArt />,
        href: '/help/canvas/animations/',
        title: 'Animate any shape',
        description:
          'Give a shape a looping animation to draw the eye or signal status: pulse an attention ring, glow a soft halo, blink a status light, trace the outline, or bob and wobble. Pick a speed, and the format painter copies the motion to the next shape.',
      },
      {
        art: <FlowingArrowsArt />,
        href: '/help/canvas/animations/',
        title: 'Arrows that show the flow',
        description:
          'Set an arrow flowing and its line comes alive: marching dashes, travelling dots, a row of beads, a breathing pulse, or a soft glow, all running toward the target so a data or process diagram reads its own direction.',
      },
      {
        art: <LivingBackgroundArt />,
        href: '/help/canvas/the-canvas/changing-the-background/',
        title: 'A backdrop with motion',
        description:
          'Swap the static grid for a living pattern: Flow streams diagonal lines, Drift floats rising motes, Aurora drifts colour glows, Ripple expands gentle rings, and Ribbons sweeps curved lines. Each matches the theme, scales with the size slider, and settles when reduced-motion is on.',
      },
      {
        art: <AnimatedIconsArt />,
        href: '/help/palette/icons/',
        title: 'Animated icons',
        description:
          'Some icons move on their own: a spinner and gear turn, a heartbeat beats, a signal pulses. Pick one from the Animated set of the icon palette and drop it like any other glyph; it doubles as its own still frame.',
      },
    ],
  },
  {
    id: 'refine',
    cta: 'Explore the organising tools',
    title: 'Keep your work tidy',
    description:
      'Work fast and stay organised: select in bulk, group and lock elements, copy a look from one to the next, and keep your canvas focused.',
    items: [
      {
        art: <MarqueeArt />,
        href: '/help/canvas/selecting-and-grouping/multi-select/',
        title: 'Multi-select with marquee',
        description:
          'Switch to the Select tool, drag a box, and act on everything inside at once: move, duplicate, or delete in one step, one Cmd-Z. Or grab the eraser and wipe out whatever you drag across, the whole sweep undone in a single step.',
      },
      {
        art: <GroupArt />,
        href: '/help/canvas/selecting-and-grouping/groups/',
        title: 'Group elements together',
        description:
          'Bundle shapes into a group so they move, lock, and delete as one. Ungroup any time to work on a single piece again.',
      },
      {
        art: <LockArt />,
        href: '/help/canvas/locking/',
        title: 'Lock anything in place',
        description:
          'Lock an element, or a whole tab, and it turns read-only, so a finished part of the diagram cannot be nudged or edited by accident.',
      },
      {
        art: <FormatPainterArt />,
        href: '/help/palette/format-painter/',
        title: 'Format painter',
        description:
          "Copy one element's look, its size, colours, text style, opacity, and padding, then brush it onto the next. Consistent diagrams without re-picking every option.",
      },
      {
        art: <DarkModeArt />,
        href: '/help/tools/dark-mode/',
        title: 'Light or dark, your call',
        description:
          'Flip the whole editor to a dark theme with one toggle. Toolbars, panels, dialogs, and menus all come along, and the choice sticks per device. The canvas stays crisp either way.',
      },
      {
        art: <MinimalPanelArt />,
        href: '/help/palette/minimal-panels/',
        title: 'Panels your way',
        description:
          'Prefer floating side panels or a clean canvas? Switch on the minimal layout and the palette and tools collapse into a compact dock with pop-out panels, the same tidy chrome you get on mobile. The choice sticks per device.',
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
    id: 'tabs',
    cta: 'Explore tabs',
    title: 'Work across tabs',
    description:
      'Every diagram is a stack of tabs, each its own canvas. Split a big system across them, link between them, copy them between diagrams, and lock the ones that are done.',
    items: [
      {
        art: <UnlimitedTabsArt />,
        href: '/help/tabs/using-tabs/',
        title: 'Unlimited tabs per diagram',
        description:
          'Add as many tabs as a diagram needs. Each is its own canvas with its own theme, and nothing slows down as the stack grows.',
      },
      {
        art: <TabsArt />,
        href: '/help/tabs/linking-tabs/',
        title: 'Link elements across tabs',
        description:
          'Point any element at another tab. Click it and you land on that tab, so a sprawling system stays one click to navigate.',
      },
      {
        art: <TabReorderArt />,
        href: '/help/tabs/using-tabs/',
        title: 'Reorder and tell them apart',
        description:
          'Drag tabs into any order. Each one is colour-coded by its theme, so the right canvas is easy to spot.',
      },
      {
        art: <TabFoldersArt />,
        href: '/help/tabs/tab-folders/',
        title: 'Group tabs into folders',
        description:
          'Big diagram, lots of tabs? Group related tabs into named folders along the tab bar and collapse the ones you are not using. Drag a tab in or out, and a folder opens on its own when you work in it.',
      },
      {
        art: <TabCopyArt />,
        href: '/help/tabs/add-to-diagram/',
        title: 'Reuse a tab in another diagram',
        description:
          "Copy a tab's full contents into another diagram you own, as a ready-made starting point you can take further.",
      },
      {
        art: <TabLockArt />,
        href: '/help/tabs/locking-tabs/',
        title: 'Lock a tab',
        description:
          'Lock a tab and everything on it becomes read-only. Adds, edits, and theme changes are blocked until you unlock it.',
      },
    ],
  },
  {
    id: 'reliability',
    cta: 'Explore what keeps work safe',
    title: 'Diagrams you can rely on',
    description:
      'Your work saves itself, steps back when you slip, and comes back exactly as you left it. Nothing to remember, nothing to lose.',
    items: [
      {
        art: <AutosaveArt />,
        title: 'Autosave, always on',
        description:
          'Every change saves on its own as you work, with a status that shows saving, saved, or a problem. There is no save button to remember.',
      },
      {
        art: <RefreshArt />,
        title: 'Survives a refresh',
        description:
          'Every save is durable through the API. Close the tab, reload, and your diagram comes back exactly as you left it.',
      },
      {
        art: <UndoRedoArt />,
        href: '/help/activity-panel/undo/',
        title: 'Undo and redo',
        description:
          'Back out a recent edit with Cmd-Z, or bring it back with Cmd-Shift-Z. For anything older, the activity log can revert a specific change.',
      },
      {
        art: <ActivityArt />,
        href: '/help/activity-panel/reverting-changes/',
        title: 'Activity log with one-click revert',
        description:
          'Every tab keeps a running log of who changed what. Hit revert on any entry to undo just that change, even after later edits, without disturbing the rest.',
      },
      {
        art: <AccountSyncArt />,
        href: '/help/account-and-data/signing-in/',
        title: 'Your diagrams, on every device',
        description:
          'Sign in for free and your diagrams follow you. Open the same ones on your laptop, tablet, or phone, always up to date.',
      },
      {
        art: <SearchArt />,
        href: '/help/search-panel/the-search-panel/',
        title: 'Find anything, fast',
        description:
          'Open search and jump straight to any diagram, folder, tab, or element by name. Matches group as you type, and Enter lands you on the first hit.',
      },
    ],
  },
  {
    id: 'content',
    cta: 'Explore richer content',
    title: 'More than boxes and arrows',
    description:
      'A diagram is rarely just shapes. Drop in real images, unfurl a link into a card, lay out a table, and reach past boxes for a whole library of icons. The canvas takes whatever you bring it.',
    items: [
      {
        art: <ImagesArt />,
        href: '/help/palette/tools/images/',
        title: 'Images on the canvas',
        description:
          'Drag, drop, or paste a PNG, JPEG, WebP, or GIF straight onto the canvas. Resize and arrange it like any other element. Everything you add lands in your own gallery, ready to reuse in any diagram without uploading twice.',
      },
      {
        art: <LinkCardArt />,
        href: '/help/canvas/links/link-cards/',
        title: 'Link cards that unfurl',
        description:
          'Drop a bookmark and paste a URL: it unfurls into a tidy card with the page title, favicon, and preview image. Click through any time. Turn a reference, a doc, or a related diagram into a card your whole team can follow.',
      },
      {
        art: <TablesArt />,
        href: '/help/palette/tools/tables/',
        title: 'Tables, fully editable',
        description:
          'Drop a table and double-click any cell to type. Insert or delete rows and columns from the cell menu, toggle a header row and a header column, recolour the headers (or reset them to the theme), drag the dividers to set column widths, and pick the cell padding. It lays out and recolours with the rest of the canvas.',
      },
      {
        art: <IconsArt />,
        href: '/help/palette/icons/',
        title: 'A library of icons',
        description:
          'Reach past boxes and arrows: drop a clean single-colour icon, servers, databases, clouds, users, and more, from the icon picker. Each one recolours with the theme and styles like any other shape, so an architecture diagram reads at a glance.',
      },
      {
        art: <TechIconsArt />,
        href: '/help/palette/technology/',
        title: 'Full-colour technology icons',
        description:
          'Build cloud architecture diagrams with brand-accurate icons for AWS, Azure, Cloudflare, and Firebase, plus a vendor-neutral set (Kubernetes, Docker, PostgreSQL, Redis and more), spanning compute, storage, databases, and networking. Search the Technology picker, drop one in, and it lands labelled with its product name.',
      },
      {
        art: <ComponentsArt />,
        href: '/help/palette/components/',
        title: 'Ready-made components',
        description:
          'Drop in a polished composite and skip the busywork: a banner, a hero, a website-style header, an annotated callout, a row of KPI stats, or numbered process steps. Tap to place it or drag to size it; each one follows the tab theme, then ungroups into plain shapes you can edit like anything else.',
      },
    ],
  },
  {
    id: 'express',
    cta: 'Explore drawing and text',
    title: 'Draw, write, and annotate',
    description:
      'Say it your way on the canvas: sketch freehand, format text down to the word, and tuck the extra context into a note that travels with the element.',
    items: [
      {
        art: <PencilArt />,
        href: '/help/palette/tools/drawing/',
        title: 'Sketch freehand, or let it snap to shape',
        description:
          "Grab the Pencil, or press F, and draw freehand straight on the canvas; strokes pick up the tab's theme like everything else. Switch on shape recognition and a rough rectangle, circle, diamond, or line becomes a clean shape the moment you lift the pen.",
      },
      {
        art: <RichTextArt />,
        href: '/help/canvas/text-and-fonts/',
        title: 'Rich text in any label',
        description:
          'Style text right where you type it: bold, italic, underline, and strikethrough, with per-word colours and sizes and bullet or numbered lists. Select a run and a floating toolbar formats just that part, so a label reads exactly how you mean it.',
      },
      {
        art: <NotesArt />,
        href: '/help/canvas/annotations/',
        title: 'Notes on any element',
        description:
          'Pin a note to any shape for the context that should not clutter the canvas. It travels with the element and opens when you need it.',
      },
    ],
  },
  {
    id: 'assist',
    cta: 'Explore the smart assists',
    title: 'The canvas does the fiddly parts',
    description:
      'Lean on the editor for the precise bits: rotation that snaps to clean angles, and guides that line everything up so a busy canvas stays tidy.',
    items: [
      {
        art: <RotateArt />,
        href: '/help/canvas/rotation/',
        title: 'Rotate to a preset angle',
        description:
          'Tilt a selected shape to a preset 45° angle from the right-click Rotation menu, or type "rotate" in the search palette for quick 90°/180°/270° turns. Fixed steps keep tilted elements consistent, and pinned arrows keep tracking the shape as it turns.',
      },
      {
        art: <AlignmentGuidesArt />,
        href: '/help/palette/alignment-guides/',
        title: 'Guides that line things up',
        description:
          'Move or resize a shape and faint guide lines light up the moment an edge or centre lines up with a neighbour, so you can see exactly why it snapped and lay things out cleanly on a busy canvas. The lines match your theme and fade the instant you let go. Switch them off in Settings if you want a bare canvas.',
      },
    ],
  },
  {
    id: 'connect',
    cta: 'Explore connecting your tools',
    title: 'Connect your tools and AI',
    description:
      'livediagram is open at the edges. Drive it programmatically from your own scripts, or hand it to an AI that reads and builds your diagrams with full context, all on the same account, all revocable.',
    items: [
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        title: 'Build diagrams with AI',
        description:
          'Hook livediagram up to Claude or any MCP client and let it find, read, create, and edit your diagrams for you. Point it at a system and ask for the diagram; it lands in your account. Signed in, and it runs on the same revocable token, so you can disconnect any time.',
      },
      {
        art: <ApiArt />,
        href: '/help/account-and-data/api-tokens/',
        title: 'Write your own integrations',
        description:
          'Create an API token and call the same REST API the editor uses, under your account, from your own scripts and integrations. Signed in, revocable, six-month tokens, no lock-in.',
      },
      {
        art: <AiAssistArt />,
        href: '/help/tools/ai/',
        title: 'An optional AI assistant',
        description:
          'Switch it on for a hand on the active tab: Ask answers questions about the diagram without changing it, and Clean tidies sizes, labels, and layout. It works from your selection or the whole tab, and one undo takes it all back. Off by default, and self-hosters bring their own key.',
      },
    ],
  },
  {
    id: 'foundations',
    cta: 'Explore the open foundations',
    title: 'Open source. Self-hostable. No lock-in.',
    description:
      'MIT-licensed. Static frontend + Cloudflare Workers backend. Run it on your own account in an afternoon. Or use the hosted version, your call.',
    items: [
      {
        art: <MitArt />,
        href: '/help/about/what-is-open-source/',
        title: 'MIT licensed',
        description:
          'The whole thing (editor, API, marketing site) is on GitHub under the MIT license. Fork it, rebrand it, ship your own variant.',
      },
      {
        art: <NoServersArt />,
        href: '/help/self-hosting/self-hosting-overview/',
        title: 'No servers to babysit',
        description:
          'Static-export frontend deploys to Cloudflare Workers; the API is a Worker with D1 + Durable Objects. No VMs, no containers, no nightly restarts.',
      },
      {
        art: <NoTrackingArt />,
        href: '/help/privacy-and-security/what-we-collect/',
        title: 'No tracking pixels',
        description:
          'No third-party analytics, no ad pixels, no SDK calls home. The only usage data is anonymous, first-party product events, and they are public: see exactly what we measure on the telemetry page.',
      },
    ],
  },
];

/**
 * The section ids, in render order. The `/features/<id>` detail route's
 * `generateStaticParams`, the `/features` hub, and the sitemap all map over
 * this, so adding a section to `LANDING_SECTIONS` automatically gives it a
 * page + a sitemap entry with no second list to keep in sync.
 */
export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((section) => section.id);

/** Look up a single section by id (the `/features/<id>` page's source). */
export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((section) => section.id === id);
}
