import {
  AccountSyncArt,
  ActivityArt,
  AnyDeviceArt,
  AutosaveArt,
  BorderStyleArt,
  CanvasBackdropArt,
  CommentsArt,
  DarkModeArt,
  DepthArt,
  EasyStartArt,
  FoldersArt,
  FormatPainterArt,
  GroupArt,
  ImagesArt,
  LaserArt,
  NotesArt,
  LockArt,
  MarqueeArt,
  MitArt,
  MultiplayerArt,
  NoServersArt,
  NoTrackingArt,
  PresenceArt,
  RealtimeArt,
  RefreshArt,
  RevokeArt,
  SearchArt,
  SelectionGlowArt,
  ShapesArt,
  ShareLinksArt,
  ShortcutsArt,
  TabCopyArt,
  TabLockArt,
  TabReorderArt,
  TabsArt,
  TemplatesArt,
  ThemesArt,
  UndoRedoArt,
  UnlimitedTabsArt,
} from '@/components/FeatureArt';
import dynamic from 'next/dynamic';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
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
                  'Share one link and the whole team is on the canvas live, with cursors, presence, comments, and an activity log you can rewind. No seats, no admin console.',
              },
              {
                art: <AnyDeviceArt />,
                title: 'Works on any device',
                description:
                  'It runs in the browser, so there is nothing to install. Open the same diagram on your laptop, desktop, or tablet and pick up where you left off.',
              },
              {
                art: <TemplatesArt />,
                title: 'Sixteen starter templates',
                description:
                  'Blank, Mind map, Org chart, Retrospective, Flowchart, Kanban, SWOT, Timeline, plus Venn, User journey, Fishbone, Pyramid, Flywheel, and Mobile / Laptop / Slide-deck wireframes. Pick one, edit it, or start blank.',
              },
              {
                art: <ThemesArt />,
                title: 'Eighteen preset themes',
                description:
                  'Brand, Slate, Forest, Sunset, Ocean, Crimson, Midnight and a dozen more. One click recolours the canvas, every shape, and every arrow.',
              },
              {
                art: <ShortcutsArt />,
                title: 'Keyboard shortcuts',
                description:
                  'The moves you repeat have keys: undo and redo, delete, multi-select, and space-drag to pan. A built-in cheat sheet lists them all, and you can switch them off per device.',
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
                  'Create an editor link for collaborators or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side.',
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
                  'Switch to the Select tool, drag a box, and act on everything inside at once: move, duplicate, or delete in one step, one Cmd-Z.',
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

        <Section
          id="versatile"
          title="As versatile as your ideas"
          description="A diagram is rarely just boxes and arrows. Reach for the right shape, dress it your way, pin a note, set the backdrop, and drop in real images. The canvas bends to whatever you're making."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <ImagesArt />,
                title: 'Images on the canvas',
                description:
                  'Drag, drop, or paste a PNG, JPEG, WebP, or GIF straight onto the canvas. Resize and arrange it like any other element. Everything you add lands in your own gallery, ready to reuse in any diagram without uploading twice.',
              },
              {
                art: <ShapesArt />,
                title: 'A shape for everything',
                description:
                  'Ten core shapes plus browser, monitor, laptop, phone, and tablet frames, all one click from the palette. Sketch a flowchart one minute and a screen the next.',
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
                  'Switch the canvas background between a dozen backdrops, from grid and lines to crosshatch, waves, and stars, or none at all. Each theme picks a fitting default.',
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
                  'The repo is public. There are no SDK calls home, no analytics secrets baked in, no hidden telemetry. What you see is what runs.',
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
                href="/live/new"
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
