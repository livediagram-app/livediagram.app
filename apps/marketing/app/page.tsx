import {
  AccountSyncArt,
  ActivityArt,
  AiAssistArt,
  AlignmentGuidesArt,
  AnyDeviceArt,
  ArrowsArt,
  AutosaveArt,
  BorderStyleArt,
  CanvasBackdropArt,
  CommentsArt,
  DarkModeArt,
  DepthArt,
  EasyStartArt,
  ExpiryArt,
  FoldersArt,
  FontsArt,
  FormatPainterArt,
  GroupArt,
  IconsArt,
  ImagesArt,
  LaserArt,
  LinkCardArt,
  NotesArt,
  LockArt,
  MarkdownImportArt,
  MarqueeArt,
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
import dynamic from 'next/dynamic';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PrivacySection } from '@/components/PrivacySection';
import { FeatureGrid, Section } from '@/components/Section';
// Lazy-load UseCaseCarousel: the 470-line `'use client'` rotator
// sits below several feature sections (well below the fold) and
// carries its own state + sketch components, none of which the
// initial paint needs. The static-export HTML still inlines its
// markup (next/dynamic defaults to ssr: true), so SEO and first
// scroll are unchanged; what shrinks is the hydration JS chunk
// the browser fetches before the user has any reason to look at
// the carousel.
const UseCaseCarousel = dynamic(() =>
  import('@/components/UseCaseCarousel').then((m) => m.UseCaseCarousel),
);

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />

        <Section
          id="why"
          title="Simple by design, powerfully deep"
          description="The simple path is the default: open a link and draw. The depth is there the moment you reach for it, and you never trade one for the other."
        >
          <FeatureGrid
            items={[
              {
                art: <EasyStartArt />,
                title: 'Start in one click',
                description:
                  "No install, no account, no blank-canvas dread. Land on a link and you're drawing in seconds.",
              },
              {
                art: <DepthArt />,
                title: 'Looks simple, runs deep',
                description:
                  'A clean canvas hides serious range: groups, locks, the format painter, arrows that track, and links across tabs.',
              },
              {
                art: <MultiplayerArt />,
                title: 'Multiplayer, no setup',
                description:
                  'Share one link and the whole team is on the canvas live, with cursors, presence, comments, and an activity log you can rewind. No seats to buy, no setup.',
              },
              {
                art: <AnyDeviceArt />,
                title: 'Works on any device',
                description:
                  'It runs in the browser, so there is nothing to install. Open the same diagram on your laptop, desktop, or tablet and pick up where you left off.',
              },
              {
                art: <TemplatesArt />,
                title: 'Twenty-four starter templates',
                description:
                  'Blank, mind map, org chart, retrospective, flowchart, Kanban, SWOT and timeline to start, plus Gantt, Venn, user journey, fishbone, pyramid, flywheel, prioritization matrix, comparison table, ER / sequence / system-architecture diagrams, logo design, a live card, and mobile / laptop / slide-deck wireframes. Pick one, edit it, or start blank.',
              },
              {
                art: <ThemesArt />,
                title: 'Twenty-six preset themes',
                description:
                  'Basic, Forest, Ocean, Sunset, Rose, Midnight, Mono and a dozen more — plus multi-colour Rainbow, Pastel, Tropical, Autumn, and Jewel themes that tint each branch a different hue. One click recolours the canvas, every shape, and every arrow.',
              },
              {
                art: <FontsArt />,
                title: 'Eight fonts',
                description:
                  'Set the typeface per element or as a tab-wide default, from eight Google Fonts spanning sans, serif, slab, mono, and handwriting. New tabs inherit it, so a diagram reads consistently.',
              },
              {
                art: <MarkdownImportArt />,
                title: 'Import a Markdown outline',
                description:
                  'Bring an outline in from XMind, Obsidian, or any notes: headings and nested bullets become a tidy, themed node-link tree. Pick Markdown in the import dialog — it builds onto the current tab, and one undo takes it back.',
              },
              {
                art: <ShortcutsArt />,
                title: 'Keyboard shortcuts',
                description:
                  'The moves you repeat have keys: undo and redo, delete, switch tools, and drop a shape, arrow, sticky, or text without reaching for the palette. Hold Cmd and the palette shows each key. A built-in cheat sheet lists them all, and you can switch them off per device.',
              },
            ]}
          />
        </Section>

        <Section
          id="collaboration"
          title="Invite your team to collaborate"
          description="Diagrams stay private until you share. Everyone you invite shows up on the canvas in real time, with live cursors, comments, and presence."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <ShareLinksArt />,
                title: 'Editor or view-only links',
                description:
                  'Create an editor link for collaborators or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side. Any link also embeds read-only in your wiki, Notion, or docs: copy the iframe snippet from the Share dialog.',
              },
              {
                art: <TeamsArt />,
                title: 'Teams with a shared library',
                description:
                  'Create a team, invite people by email, and everyone gets a shared folder of diagrams they can all open and edit. Admins manage membership and roles; members just get to work. Sign in to set one up, the canvas itself never needs an account.',
              },
              {
                art: <PresenceArt />,
                title: 'Live presence',
                description:
                  'See who is in the diagram from the participant avatars on each tab. Status rings show online, away, or stale.',
              },
              {
                art: <RealtimeArt />,
                title: 'Edits land live',
                description:
                  'The moment someone makes a change, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
              },
              {
                art: <SelectionGlowArt />,
                title: 'See what others are working on',
                description:
                  'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner, in real time.',
              },
              {
                art: <CommentsArt />,
                title: 'Comments on any element',
                description:
                  "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
              },
              {
                art: <LaserArt />,
                title: 'Laser pointer for presenting',
                description:
                  'Switch to the laser tool and your cursor leaves a glowing trail everyone can see. Point at the thing you mean while you talk it through. Trails fade on their own.',
              },
              {
                art: <SessionToolsArt />,
                title: 'Run the session: timer + voting',
                description:
                  'Facilitate live from the canvas. Start a countdown or stopwatch the whole room sees, then open dot-voting to surface the group’s priorities. Everyone votes with a budget of dots; results tally in real time. Perfect for retros, workshops, and timeboxed planning.',
              },
              {
                art: <ExpiryArt />,
                title: 'Links that expire on their own',
                description:
                  'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, no cleanup to remember, and you can extend it for another run or delete it for good.',
              },
              {
                art: <RevokeArt />,
                title: 'Stop sharing on demand',
                description:
                  'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The diagram is yours again.',
              },
            ]}
          />
        </Section>

        <UseCaseCarousel />

        <Section
          id="refine"
          title="Keep your work tidy"
          description="Work fast and stay organised: select in bulk, group and lock elements, copy a look from one to the next, and file diagrams into folders."
        >
          <FeatureGrid
            items={[
              {
                art: <MarqueeArt />,
                title: 'Multi-select with marquee',
                description:
                  'Switch to the Select tool, drag a box, and act on everything inside at once: move, duplicate, or delete in one step, one Cmd-Z. Or grab the eraser and wipe out whatever you drag across, the whole sweep undone in a single step.',
              },
              {
                art: <GroupArt />,
                title: 'Group elements together',
                description:
                  'Bundle shapes into a group so they move, lock, and delete as one. Ungroup any time to work on a single piece again.',
              },
              {
                art: <LockArt />,
                title: 'Lock anything in place',
                description:
                  'Lock an element, or a whole tab, and it turns read-only, so a finished part of the diagram cannot be nudged or edited by accident.',
              },
              {
                art: <FormatPainterArt />,
                title: 'Format painter',
                description:
                  "Copy one element's look, its size, colours, text style, opacity, and padding, then brush it onto the next. Consistent diagrams without re-picking every option.",
              },
              {
                art: <FoldersArt />,
                title: 'Organise in folders',
                description:
                  'File diagrams into nested folders in the explorer. Recent diagrams stay one click away; everything else lives where you put it.',
              },
              {
                art: <DarkModeArt />,
                title: 'Light or dark, your call',
                description:
                  'Flip the whole editor to a dark theme with one toggle. Toolbars, panels, dialogs, and menus all come along, and the choice sticks per device. The canvas stays crisp either way.',
              },
              {
                art: <MinimalPanelArt />,
                title: 'Panels your way',
                description:
                  'Prefer floating side panels or a clean canvas? Switch on the minimal layout and the palette and tools collapse into a compact dock with pop-out panels, the same tidy chrome you get on mobile. The choice sticks per device.',
              },
              {
                art: <ZenModeArt />,
                title: 'Zen mode for focus',
                description:
                  'Hit Z, or the zen button by the laser pointer, and every toolbar, panel, and tab bar drops away, leaving just your canvas. Only the zoom controls stay, with an exit button right beside them. Press Z or Esc to bring it all back.',
              },
            ]}
          />
        </Section>

        <Section
          id="tabs"
          title="One diagram, as many tabs as it takes"
          description="Every diagram is a stack of tabs, each its own canvas. Split a big system across them, link between them, copy them between diagrams, and lock the ones that are done."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <UnlimitedTabsArt />,
                title: 'Unlimited tabs per diagram',
                description:
                  'Add as many tabs as a diagram needs. Each is its own canvas with its own theme, and nothing slows down as the stack grows.',
              },
              {
                art: <TabsArt />,
                title: 'Link elements across tabs',
                description:
                  'Point any element at another tab. Click it and you land on that tab, so a sprawling system stays one click to navigate.',
              },
              {
                art: <TabCopyArt />,
                title: 'Reuse a tab in another diagram',
                description:
                  "Copy a tab's full contents into another diagram you own, as a ready-made starting point you can take further.",
              },
              {
                art: <TabLockArt />,
                title: 'Lock a tab',
                description:
                  'Lock a tab and everything on it becomes read-only. Adds, edits, and theme changes are blocked until you unlock it.',
              },
              {
                art: <TabReorderArt />,
                title: 'Reorder and tell them apart',
                description:
                  'Drag tabs into any order. Each one is colour-coded by its theme, so the right canvas is easy to spot.',
              },
              {
                art: <TabFoldersArt />,
                title: 'Group tabs into folders',
                description:
                  'Big diagram, lots of tabs? Group related tabs into named folders along the tab bar and collapse the ones you are not using. Drag a tab in or out, and a folder opens on its own when you work in it.',
              },
            ]}
          />
        </Section>

        <Section
          id="reliability"
          title="Diagrams you can rely on"
          description="Your work saves itself, steps back when you slip, and comes back exactly as you left it. Nothing to remember, nothing to lose."
        >
          <FeatureGrid
            items={[
              {
                art: <AutosaveArt />,
                title: 'Autosave, always on',
                description:
                  'Every change saves on its own as you work, with a status that shows saving, saved, or a problem. There is no save button to remember.',
              },
              {
                art: <UndoRedoArt />,
                title: 'Undo and redo',
                description:
                  'Back out a recent edit with Cmd-Z, or bring it back with Cmd-Shift-Z. For anything older, the activity log can revert a specific change.',
              },
              {
                art: <ActivityArt />,
                title: 'Activity log with one-click revert',
                description:
                  'Every tab keeps a running log of who changed what. Hit revert on any entry to undo just that change, even after later edits, without disturbing the rest.',
              },
              {
                art: <RefreshArt />,
                title: 'Survives a refresh',
                description:
                  'Every save is durable through the API. Close the tab, reload, and your diagram comes back exactly as you left it.',
              },
              {
                art: <AccountSyncArt />,
                title: 'Your diagrams, on every device',
                description:
                  'Sign in for free and your diagrams follow you. Open the same ones on your laptop, tablet, or phone, always up to date.',
              },
              {
                art: <SearchArt />,
                title: 'Find anything, fast',
                description:
                  'Open search and jump straight to any diagram, folder, tab, or element by name. Matches group as you type, and Enter lands you on the first hit.',
              },
            ]}
          />
        </Section>

        <PrivacySection />

        <Section
          id="versatile"
          title="As versatile as your ideas"
          description="A diagram is rarely just boxes and arrows. Reach for the right shape, dress it your way, pin a note, set the backdrop, and drop in real images. The canvas bends to whatever you're making."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <AiAssistArt />,
                title: 'An optional AI assistant',
                description:
                  'Switch it on and describe what you want: Build drafts new elements and edits existing ones, Clean tidies sizes and labels, while Ask and Review answer questions and critique what you have. It works from your selection or the whole tab, and one undo takes it all back. Off by default, and self-hosters bring their own key.',
              },
              {
                art: <ImagesArt />,
                title: 'Images on the canvas',
                description:
                  'Drag, drop, or paste a PNG, JPEG, WebP, or GIF straight onto the canvas. Resize and arrange it like any other element. Everything you add lands in your own gallery, ready to reuse in any diagram without uploading twice.',
              },
              {
                art: <LinkCardArt />,
                title: 'Link cards that unfurl',
                description:
                  'Drop a bookmark and paste a URL: it unfurls into a tidy card with the page title, favicon, and preview image. Click through any time. Turn a reference, a doc, or a related diagram into a card your whole team can follow.',
              },
              {
                art: <RichTextArt />,
                title: 'Rich text in any label',
                description:
                  'Style text right where you type it: bold, italic, underline, and strikethrough, with per-word colours and sizes and bullet or numbered lists. Select a run and a floating toolbar formats just that part, so a label reads exactly how you mean it.',
              },
              {
                art: <TablesArt />,
                title: 'Tables, fully editable',
                description:
                  'Drop a table and double-click any cell to type. Insert or delete rows and columns from the cell menu, toggle a header row and a header column, recolour the headers (or reset them to the theme), drag the dividers to set column widths, and pick the cell padding. It lays out and recolours with the rest of the canvas.',
              },
              {
                art: <ShapesArt />,
                title: 'A shape for everything',
                description:
                  'Fourteen core shapes — flowchart blocks plus an actor, cloud, triangle, star, and speech bubble — a section frame that carries whatever you draw inside it, and six device frames (browser, monitor, laptop, phone, tablet, smartwatch). Click to drop one, or drag to draw it at the exact size you want, snapped to line up with its neighbours. A flowchart one minute, a screen the next.',
              },
              {
                art: <IconsArt />,
                title: 'A library of icons',
                description:
                  'Reach past boxes and arrows: drop a clean single-colour icon, servers, databases, clouds, users, and more, from the icon picker. Each one recolours with the theme and styles like any other shape, so an architecture diagram reads at a glance.',
              },
              {
                art: <TechIconsArt />,
                title: 'Full-colour technology icons',
                description:
                  'Build cloud architecture diagrams with brand-accurate icons for AWS, Azure, Google Cloud, Cloudflare, and Firebase, spanning compute, storage, databases, and networking. Search the Technology picker, drop one in, and it lands labelled with its product name.',
              },
              {
                art: <ArrowsArt />,
                title: 'Arrows that bend your way',
                description:
                  'Connect anything with straight, curved, or angled arrows. Drag the handle on a curve to reshape its bow, or on an elbow to move the bend. Set the thickness, choose the arrowhead shape, filled or hollow triangle, line, circle, or diamond, for UML-style connectors and size it, add a label, and pin an end to a shape so it follows when things move.',
              },
              {
                art: <RotateArt />,
                title: 'Rotate to any angle',
                description:
                  'Grab the rotate handle above a selected shape and turn it. It snaps to neat 15° steps, or hold Shift for free rotation, and pinned arrows keep tracking the shape as it turns.',
              },
              {
                art: <AlignmentGuidesArt />,
                title: 'Guides that line things up',
                description:
                  'Move or resize a shape and faint guide lines light up the moment an edge or centre lines up with a neighbour, so you can see exactly why it snapped and lay things out cleanly on a busy canvas. The lines match your theme and fade the instant you let go. Switch them off in Settings if you want a bare canvas.',
              },
              {
                art: <PencilArt />,
                title: 'Sketch freehand, or let it snap to shape',
                description:
                  "Grab the Pencil, or press F, and draw freehand straight on the canvas; strokes pick up the tab's theme like everything else. Switch on shape recognition and a rough rectangle, circle, diamond, or line becomes a clean shape the moment you lift the pen.",
              },
              {
                art: <NotesArt />,
                title: 'Notes on any element',
                description:
                  'Pin a note to any shape for the context that should not clutter the canvas. It travels with the element and opens when you need it.',
              },
              {
                art: <BorderStyleArt />,
                title: 'Style every border',
                description:
                  'Set border strength, switch between solid, dashed, and dotted, and round the corners as much or as little as the shape calls for.',
              },
              {
                art: <CanvasBackdropArt />,
                title: 'Set the canvas backdrop',
                description:
                  'Switch the canvas background between fourteen backdrops, from grid and lines to crosshatch, waves, isometric, and engineering, or none at all. Each theme and template picks a fitting default.',
              },
            ]}
          />
        </Section>

        <Section
          id="foundations"
          title="Open source. Self-hostable. No lock-in."
          description="MIT-licensed. Static frontend + Cloudflare Workers backend. Run it on your own account in an afternoon. Or use the hosted version, your call."
        >
          <FeatureGrid
            items={[
              {
                art: <MitArt />,
                title: 'MIT licensed',
                description:
                  'The whole thing (editor, API, marketing site) is on GitHub under the MIT license. Fork it, rebrand it, ship your own variant.',
              },
              {
                art: <NoServersArt />,
                title: 'No servers to babysit',
                description:
                  'Static-export frontend deploys to Cloudflare Workers; the API is a Worker with D1 + Durable Objects. No VMs, no containers, no nightly restarts.',
              },
              {
                art: <NoTrackingArt />,
                title: 'No tracking pixels',
                description:
                  'No third-party analytics, no ad pixels, no SDK calls home. The only usage data is anonymous, first-party product events, and they are public: see exactly what we measure on the telemetry page.',
              },
            ]}
          />
        </Section>

        <section id="get-started" className="border-t border-slate-200/70 bg-brand-500">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Time to start
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
              No sign-up wall. No credit card. The editor opens in your browser and remembers the
              diagram next time you visit.
            </p>
            <div className="mt-8">
              <a
                href="/new"
                className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-base font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start drawing
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
