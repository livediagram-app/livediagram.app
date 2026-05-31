import {
  ActivityArt,
  ArrowsArt,
  CommentsArt,
  FoldersArt,
  FormatPainterArt,
  LaserArt,
  MarqueeArt,
  MitArt,
  NameArt,
  NoServersArt,
  NoTrackingArt,
  PresenceArt,
  RealtimeArt,
  RefreshArt,
  RevokeArt,
  SelectionGlowArt,
  ShapesArt,
  ShareLinksArt,
  TabsArt,
  TemplatesArt,
  ThemesArt,
} from '@/components/FeatureArt';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { FeatureGrid, Section } from '@/components/Section';

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />

        <Section
          id="features"
          eyebrow="Draw"
          title="A real diagram editor, in your browser"
          description="Real shapes, connectors that track what they're tied to, and a dozen templates and themes so you never start from a blank page."
        >
          <FeatureGrid
            items={[
              {
                art: <TemplatesArt />,
                title: 'Twelve starter templates',
                description:
                  'Blank, Mind map, Org chart, Retrospective, Flowchart, Kanban, SWOT, Timeline — plus Venn, User journey, Fishbone, and Pyramid. Pick one, edit it. Or start blank.',
              },
              {
                art: <ThemesArt />,
                title: 'Eighteen preset themes',
                description:
                  'Brand, Slate, Forest, Sunset, Ocean, Crimson, Midnight and a dozen more. One click recolours the canvas, every shape, and every arrow.',
              },
              {
                art: <ShapesArt />,
                title: 'Shapes that match how you think',
                description:
                  'Square, circle, diamond, stadium (start/end), cylinder (DB), parallelogram (I/O), hexagon, document. Plus text and sticky notes for annotations.',
              },
              {
                art: <ArrowsArt />,
                title: 'Arrows that follow content',
                description:
                  'Drag from an anchor dot to connect two shapes. Move either shape and the arrow tracks. Straight, curved, or angled, with custom strokes and end-styles per arrow.',
              },
            ]}
          />
        </Section>

        <Section
          id="refine"
          eyebrow="Refine"
          title="Keep a busy diagram tidy"
          description="Edit in bulk, copy a look from one element to the next, talk in context, and split a big system across linked tabs and folders."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <MarqueeArt />,
                title: 'Multi-select with marquee',
                description:
                  'Switch to the Select tool, drag a box. Move, duplicate, group, lock, or delete every element inside — one action, one Cmd-Z.',
              },
              {
                art: <FormatPainterArt />,
                title: 'Format painter',
                description:
                  "Copy one element's look — size, colours, text style, opacity, padding — and brush it onto the next. Consistent diagrams without re-picking every option.",
              },
              {
                art: <CommentsArt />,
                title: 'Comments on any element',
                description:
                  "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
              },
              {
                art: <TabsArt />,
                title: 'Many canvases per diagram',
                description:
                  'Split a system across tabs in one diagram, then link an element to another tab to jump straight there. Rename, duplicate, reorder, or lock each tab.',
              },
              {
                art: <FoldersArt />,
                title: 'Organise in folders',
                description:
                  'File diagrams into nested folders in the explorer. Recent diagrams stay one click away; everything else lives where you put it.',
              },
            ]}
          />
        </Section>

        <Section
          id="collab"
          eyebrow="Together"
          title="Edit the same canvas, live"
          description="Diagrams stay private until you share. Everyone you invite shows up on the canvas in real time — cursors, selections, and all."
        >
          <FeatureGrid
            items={[
              {
                art: <PresenceArt />,
                title: 'Live presence',
                description:
                  'See who is in the diagram via the participant avatars in the header and on each tab. Status rings show online, away, or stale.',
              },
              {
                art: <SelectionGlowArt />,
                title: 'See what others are working on',
                description:
                  'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner — in real time.',
              },
              {
                art: <RealtimeArt />,
                title: 'Realtime edits, last-write-wins',
                description:
                  'Every edit propagates over WebSockets within a beat. No queues, no locks. The latest change is the truth.',
              },
              {
                art: <LaserArt />,
                title: 'Laser pointer for presenting',
                description:
                  'Switch to the laser tool and your cursor leaves a glowing trail everyone can see — point at the thing you mean while you talk it through. Trails fade on their own.',
              },
            ]}
          />
        </Section>

        <Section
          id="sharing"
          eyebrow="Share & control"
          title="Shared by link, yours to revoke"
          description="Hand out editor or view-only links, rewind any change from a full activity trail, and trust that every save survives a refresh."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                art: <ShareLinksArt />,
                title: 'Editor or view-only links',
                description:
                  'Mint an editor link for collaborators or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side.',
              },
              {
                art: <RevokeArt />,
                title: 'Stop sharing on demand',
                description:
                  'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The diagram is yours again.',
              },
              {
                art: <ActivityArt />,
                title: 'Activity log with one-click revert',
                description:
                  'Every tab keeps a running log of who changed what. Hit revert on any entry to undo just that change — even after later edits — without disturbing the rest.',
              },
              {
                art: <NameArt />,
                title: 'Pick your collaborator name',
                description:
                  "First time joining a shared canvas, you pick the name people see on your cursor and comments. We generate a fun default if you can't be bothered.",
              },
              {
                art: <RefreshArt />,
                title: 'Survives a refresh',
                description:
                  'Every save is durable through the API. Close the tab, reload — your diagram and your name come back exactly as you left them.',
              },
            ]}
          />
        </Section>

        <Section
          id="foundations"
          eyebrow="Open and honest"
          title="Open source. Self-hostable. No lock-in."
          description="MIT-licensed. Static frontend + Cloudflare Workers backend. Run it on your own account in an afternoon. Or use the hosted version — your call."
        >
          <FeatureGrid
            items={[
              {
                art: <MitArt />,
                title: 'MIT licensed',
                description:
                  'The whole thing — editor, API, marketing site — is on GitHub under the MIT license. Fork it, rebrand it, ship your own variant.',
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
              Open a canvas. Get to drawing.
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
