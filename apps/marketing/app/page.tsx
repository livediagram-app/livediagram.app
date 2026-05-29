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
          id="product"
          eyebrow="The canvas"
          title="Diagrams and mindmaps in one place"
          description="Flowcharts, system diagrams, process maps, mindmaps, brainstorms — all on the same canvas. Structured primitives keep the output clean; keyboard-first interactions keep you moving."
        >
          <FeatureGrid
            items={[
              {
                title: 'Structured shapes',
                description:
                  'Boxes, arrows, connectors, and text — the primitives you need for clear, professional diagrams.',
              },
              {
                title: 'Mindmap mode',
                description:
                  'Hierarchical nodes and branches with quick keyboard-driven expansion. Capture thinking at the speed it happens.',
              },
              {
                title: 'Auto-layout',
                description:
                  'Snap to grid, distribute evenly, align connectors. Stay focused on the idea, not the pixels.',
              },
            ]}
          />
        </Section>

        <Section
          id="teams"
          eyebrow="Built for teams"
          title="Multiplayer from the first click"
          description="See teammates' cursors, edits, and selections in real time. Workshops, retros, architecture reviews — built together, not handed off."
          variant="tinted"
        >
          <FeatureGrid
            items={[
              {
                title: 'Live cursors',
                description:
                  'Watch teammates work the canvas with you. Presence and intent, not just a final diff.',
              },
              {
                title: 'Conflict-free editing',
                description:
                  'Everyone edits at once. Changes merge cleanly without locks, queues, or "who has it open?"',
              },
              {
                title: 'Team workspaces',
                description:
                  'Diagrams belong to a team. Access, sharing, and history all managed at the team level.',
              },
            ]}
          />
        </Section>

        <Section
          id="how-it-works"
          eyebrow="No bloat"
          title="Fast, focused, in your browser"
          description="A canvas that loads instantly, runs in any modern browser, and stays out of the way. No enterprise drag. No desktop install. Just the diagram and the people building it."
        />

        <section id="get-started" className="border-t border-slate-200/70 bg-brand-500">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start diagramming with your team.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
              Free to try. No credit card. Open a canvas in seconds.
            </p>
            <div className="mt-8">
              <a
                href="#signup"
                className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-base font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started for free
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
