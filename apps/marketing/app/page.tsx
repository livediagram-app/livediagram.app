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
          eyebrow="The canvas"
          title="A real diagram editor, in your browser"
          description="Eight starter templates, twelve themes, every shape you need for flowcharts and process maps. Group, lock, comment, link across tabs — the things that make a diagram useful, not just a sketch."
        >
          <FeatureGrid
            items={[
              {
                title: 'Eight starter templates',
                description:
                  'Blank, Mind map, Org chart, Retrospective, Flowchart, Kanban, SWOT, Timeline. Pick one, edit it. Or start blank and build from scratch.',
              },
              {
                title: 'Twelve preset themes',
                description:
                  'Brand, Slate, Forest, Sunset, Lavender, Mono, Ocean, Crimson, Midnight, Cream, Rose, Sand. Recolours the canvas, every shape, every arrow in one click.',
              },
              {
                title: 'Shapes that match how you think',
                description:
                  'Square, circle, diamond, stadium (start/end), cylinder (DB), parallelogram (I/O), hexagon, document. Plus text and sticky notes for annotations.',
              },
              {
                title: 'Arrows that follow content',
                description:
                  'Drag from an anchor dot to connect two shapes. Move either shape and the arrow tracks. Custom strokes and end-styles per arrow.',
              },
              {
                title: 'Multi-select with marquee',
                description:
                  'Switch to the Select tool, drag a box. Move, duplicate, group, lock, or delete every element inside — one action, one Cmd-Z.',
              },
              {
                title: 'Comments on any element',
                description:
                  "Right-click an element, leave a thread. Replies, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
              },
            ]}
          />
        </Section>

        <Section
          id="collab"
          eyebrow="Real-time when you need it"
          title="Private by default. Shared by link."
          description="Diagrams live on your account until you share. One click in the header generates a short share link; anyone with the link can join the canvas, edit it live, and show up in your presence stack with their own avatar."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                title: 'Live presence',
                description:
                  'See who is in the diagram via the participant avatars in the header. Status rings show online, away, or stale.',
              },
              {
                title: 'See what others are working on',
                description:
                  'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner — in real time.',
              },
              {
                title: 'Realtime edits, last-write-wins',
                description:
                  'Every edit propagates over WebSockets within a beat. No queues, no locks. The latest change is the truth.',
              },
              {
                title: 'Stop sharing on demand',
                description:
                  'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The diagram is yours again.',
              },
              {
                title: 'Pick your collaborator name',
                description:
                  "First time joining a shared canvas, you pick the name people see on your cursor and comments. We generate a fun default if you can't be bothered.",
              },
              {
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
                title: 'MIT licensed',
                description:
                  'The whole thing — editor, API, marketing site — is on GitHub under the MIT license. Fork it, rebrand it, ship your own variant.',
              },
              {
                title: 'No servers to babysit',
                description:
                  'Static-export frontend deploys to Cloudflare Workers; the API is a Worker with D1 + Durable Objects. No VMs, no containers, no nightly restarts.',
              },
              {
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
                Open the editor
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
